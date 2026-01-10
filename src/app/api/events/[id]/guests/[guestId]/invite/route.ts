import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { sendInvitation } from '@/lib/email';
import { sendSmsInvitation } from '@/lib/sms';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const inviteSchema = z.object({
  notifyByEmail: z.boolean().optional().default(true),
  notifyBySms: z.boolean().optional().default(false),
});

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
      include: { host: { select: { name: true } } },
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

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const parsed = inviteSchema.safeParse(body);
    const { notifyByEmail = true, notifyBySms = false } = parsed.success ? parsed.data : {};

    // Send invitations
    const invitationPromises = [];

    if (notifyByEmail) {
      invitationPromises.push(
        sendInvitation({
          to: guest.email,
          guestName: guest.name,
          event: {
            title: event.title,
            date: event.date,
            location: event.location,
            description: event.description,
          },
          rsvpToken: guest.token,
          hostName: event.host.name,
        }).catch((error) => {
          logger.error('Failed to send invitation email', error);
        })
      );
    }

    if (notifyBySms && guest.phone) {
      invitationPromises.push(
        sendSmsInvitation({
          to: guest.phone,
          guestName: guest.name,
          event: {
            title: event.title,
            date: event.date,
            location: event.location,
          },
          rsvpToken: guest.token,
          hostName: event.host.name,
        }).catch((error) => {
          logger.error('Failed to send invitation SMS', error);
        })
      );
    }

    if (invitationPromises.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one delivery method' },
        { status: 400 }
      );
    }

    await Promise.all(invitationPromises);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Send invitation error', error);
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    );
  }
}

