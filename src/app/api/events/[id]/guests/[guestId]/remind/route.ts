import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { sendReminder } from '@/lib/email';
import { sendSmsReminder } from '@/lib/sms';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string; guestId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId, guestId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify event ownership and get event details
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event || event.hostId !== session.user.id) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Get guest
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
    });

    if (!guest || guest.eventId !== eventId) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    if (guest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Guest has already responded' },
        { status: 400 }
      );
    }

    const reminderPromises = [];

    // Send email reminder
    if (guest.notifyByEmail) {
      reminderPromises.push(
        sendReminder({
          to: guest.email,
          guestName: guest.name,
          event: {
            title: event.title,
            date: event.date,
            location: event.location,
          },
          rsvpToken: guest.token,
        }).catch((error) => {
          logger.error('Failed to send reminder email', error);
        })
      );
    }

    // Send SMS reminder
    if (guest.notifyBySms && guest.phone) {
      reminderPromises.push(
        sendSmsReminder({
          to: guest.phone,
          guestName: guest.name,
          event: {
            title: event.title,
            date: event.date,
            location: event.location,
          },
          rsvpToken: guest.token,
        }).catch((error) => {
          logger.error('Failed to send reminder SMS', error);
        })
      );
    }

    await Promise.all(reminderPromises);

    // Update reminder sent timestamps
    await prisma.guest.update({
      where: { id: guestId },
      data: {
        reminderSentAt: new Date(),
        smsReminderSentAt: guest.notifyBySms && guest.phone ? new Date() : undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Send reminder error', error);
    return NextResponse.json(
      { error: 'Failed to send reminder' },
      { status: 500 }
    );
  }
}
