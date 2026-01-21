import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { canManageEvent } from '@/lib/event-access';
import { sendInvitation, sendReminder } from '@/lib/email';
import { z } from 'zod';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const bulkActionSchema = z.object({
  action: z.enum(['invite', 'remind', 'delete', 'changeStatus']),
  guestIds: z.array(z.string()).min(1, 'At least one guest must be selected'),
  status: z.enum(['PENDING', 'ATTENDING', 'NOT_ATTENDING', 'MAYBE']).optional(),
});

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user can manage this event
    const canManage = await canManageEvent(session.user.id, eventId);
    if (!canManage) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        date: true,
        location: true,
        description: true,
        coverImage: true,
        replyTo: true,
        host: { select: { name: true } },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = bulkActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { action, guestIds, status } = parsed.data;

    // Validate status is provided for changeStatus action
    if (action === 'changeStatus' && !status) {
      return NextResponse.json(
        { error: 'Status is required for changeStatus action' },
        { status: 400 }
      );
    }

    // Fetch all guests
    const guests = await prisma.guest.findMany({
      where: {
        id: { in: guestIds },
        eventId,
      },
    });

    if (guests.length === 0) {
      return NextResponse.json(
        { error: 'No valid guests found' },
        { status: 400 }
      );
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Process each guest based on action
    for (const guest of guests) {
      try {
        switch (action) {
          case 'invite': {
            if (guest.notifyByEmail) {
              try {
                await sendInvitation({
                  to: guest.email,
                  guestName: guest.name,
                  event: {
                    title: event.title,
                    date: event.date,
                    location: event.location,
                    description: event.description,
                    coverImage: event.coverImage,
                  },
                  rsvpToken: guest.token,
                  hostName: event.host.name,
                  replyTo: event.replyTo,
                });
                successCount++;
              } catch (error) {
                logger.error(`Failed to send invitation email to ${guest.email}`, error);
                failedCount++;
                errors.push(`${guest.email}: Failed to send invitation`);
              }
            } else {
              successCount++;
            }
            break;
          }

          case 'remind': {
            if (guest.status !== 'PENDING') {
              errors.push(`${guest.email}: Guest has already responded`);
              failedCount++;
              continue;
            }

            if (guest.notifyByEmail && !guest.reminderSentAt) {
              try {
                await sendReminder({
                  to: guest.email,
                  guestName: guest.name,
                  event: {
                    title: event.title,
                    date: event.date,
                    location: event.location,
                    coverImage: event.coverImage,
                  },
                  rsvpToken: guest.token,
                  replyTo: event.replyTo,
                });

                await prisma.guest.update({
                  where: { id: guest.id },
                  data: {
                    reminderSentAt: new Date(),
                  },
                });
                successCount++;
              } catch (error) {
                logger.error(`Failed to send reminder email to ${guest.email}`, error);
                failedCount++;
                errors.push(`${guest.email}: Failed to send reminder`);
              }
            } else {
              successCount++;
            }
            break;
          }

          case 'delete': {
            await prisma.guest.delete({
              where: { id: guest.id },
            });
            successCount++;
            break;
          }

          case 'changeStatus': {
            await prisma.guest.update({
              where: { id: guest.id },
              data: {
                status: status!,
                respondedAt: status !== 'PENDING' ? new Date() : null,
              },
            });
            successCount++;
            break;
          }
        }
      } catch (error) {
        failedCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${guest.email || guest.id}: ${errorMessage}`);
        logger.error(`Bulk action failed for guest ${guest.id}`, error);
      }
    }

    return NextResponse.json({
      success: true,
      successCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logger.error('Bulk guest operation error', error);
    return NextResponse.json(
      { error: 'Failed to process bulk operation' },
      { status: 500 }
    );
  }
}
