import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { canManageEvent } from '@/lib/event-access';
import { sendInvitation } from '@/lib/email';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const addGuestSchema = z.object({
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  name: z.string().optional(),
  notifyByEmail: z.boolean().optional().default(true),
  sendInvite: z.boolean().optional().default(true),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user can manage this event (host, co-host, or admin)
    const canManage = await canManageEvent(session.user.id, eventId);
    if (!canManage) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { host: { select: { name: true } } },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = addGuestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, phone, name, notifyByEmail, sendInvite } = parsed.data;

    // Check if guest already exists
    const existingGuest = await prisma.guest.findUnique({
      where: { eventId_email: { eventId, email } },
    });

    if (existingGuest) {
      return NextResponse.json(
        { error: 'This guest has already been added' },
        { status: 400 }
      );
    }

    // Create guest
    const guest = await prisma.guest.create({
      data: {
        eventId,
        email,
        phone: phone || null,
        name: name || null,
        notifyByEmail,
      },
    });

    // Send invitation if requested
    if (sendInvite && notifyByEmail) {
      try {
        await sendInvitation({
          to: email,
          guestName: name,
          event: {
            title: event.title,
            date: event.date,
            location: event.location,
            description: event.description,
          },
          rsvpToken: guest.token,
          hostName: event.host.name,
        });
      } catch (error) {
        logger.error('Failed to send invitation email', error);
      }
    }

    return NextResponse.json({ guest });
  } catch (error) {
    logger.error('Add guest error', error);
    return NextResponse.json(
      { error: 'Failed to add guest' },
      { status: 500 }
    );
  }
}
