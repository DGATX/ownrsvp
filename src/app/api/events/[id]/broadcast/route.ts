import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { canManageEvent } from '@/lib/event-access';
import { sendBroadcastEmail } from '@/lib/email';
import { z } from 'zod';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const broadcastSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(1, 'Message is required'),
  filterStatus: z.enum(['ALL', 'ATTENDING', 'NOT_ATTENDING', 'MAYBE', 'PENDING']).optional().default('ALL'),
});

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user can manage this event
    const canManage = await canManageEvent(session.user.id, eventId);
    if (!canManage) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = broadcastSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { subject, message, filterStatus } = parsed.data;

    // Get event with guests
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        guests: {
          where: filterStatus !== 'ALL' ? { status: filterStatus } : undefined,
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const guests = event.guests;
    let sentCount = 0;
    const errors: string[] = [];

    // Send emails
    for (const guest of guests) {
      if (guest.notifyByEmail) {
        try {
          await sendBroadcastEmail({
            to: guest.email,
            guestName: guest.name,
            subject,
            message,
            eventTitle: event.title,
          });
          sentCount++;
        } catch (error) {
          logger.error(`Failed to send to ${guest.email}`, error);
          errors.push(guest.email);
        }
      }
    }

    // Record the update
    await prisma.eventUpdate.create({
      data: {
        eventId,
        subject,
        message,
        sentVia: 'EMAIL',
        sentTo: sentCount,
        sentBy: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      sentTo: sentCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logger.error('Broadcast error', error);
    return NextResponse.json(
      { error: 'Failed to send broadcast' },
      { status: 500 }
    );
  }
}

// GET /api/events/[id]/broadcast - Get broadcast history
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canManage = await canManageEvent(session.user.id, eventId);
    if (!canManage) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updates = await prisma.eventUpdate.findMany({
      where: { eventId },
      orderBy: { sentAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ updates });
  } catch (error) {
    logger.error('Get broadcasts error', error);
    return NextResponse.json(
      { error: 'Failed to fetch broadcasts' },
      { status: 500 }
    );
  }
}
