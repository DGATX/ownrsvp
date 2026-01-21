import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { sendInvitation } from '@/lib/email';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string; guestId: string }>;
}

/**
 * Send or resend invitation link to a guest
 * This endpoint works for guests regardless of their RSVP status.
 * For guests who have already RSVP'd, this allows hosts to resend the invite link
 * if the guest has lost or deleted their original invitation email.
 */
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
      select: {
        id: true,
        hostId: true,
        title: true,
        date: true,
        location: true,
        description: true,
        coverImage: true,
        replyTo: true,
        host: { select: { name: true } },
      },
    });

    if (!event || event.hostId !== session.user.id) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Get guest (works for all guests regardless of RSVP status)
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
    });

    if (!guest || guest.eventId !== eventId) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    // Send invitation email
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
    } catch (error) {
      logger.error('Failed to send invitation email', error);
      return NextResponse.json(
        { error: 'Failed to send invitation email' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Send invitation error', error);
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    );
  }
}
