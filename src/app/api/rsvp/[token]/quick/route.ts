import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendConfirmation } from '@/lib/email';
import { getAppUrl } from '@/lib/config';
import { logger } from '@/lib/logger';
import { isPast } from 'date-fns';

interface RouteParams {
  params: Promise<{ token: string }>;
}

const validStatuses = ['ATTENDING', 'NOT_ATTENDING', 'MAYBE'] as const;
type RsvpStatus = typeof validStatuses[number];

/**
 * Handle one-click RSVP from email
 * GET /api/rsvp/[token]/quick?status=ATTENDING|NOT_ATTENDING|MAYBE
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as RsvpStatus | null;

    // Validate status parameter
    if (!status || !validStatuses.includes(status)) {
      const appUrl = await getAppUrl();
      return NextResponse.redirect(`${appUrl}/rsvp/${token}?error=invalid_status`);
    }

    // Find guest by token
    const guest = await prisma.guest.findUnique({
      where: { token },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            date: true,
            location: true,
            description: true,
            slug: true,
            rsvpDeadline: true,
            replyTo: true,
          },
        },
      },
    });

    if (!guest) {
      const appUrl = await getAppUrl();
      return NextResponse.redirect(`${appUrl}?error=invalid_token`);
    }

    const appUrl = await getAppUrl();

    // Check RSVP deadline
    if (guest.event.rsvpDeadline && isPast(new Date(guest.event.rsvpDeadline))) {
      return NextResponse.redirect(
        `${appUrl}/events/${guest.event.slug}?error=deadline_passed`
      );
    }

    // Update guest status
    const previousStatus = guest.status;
    await prisma.guest.update({
      where: { id: guest.id },
      data: {
        status,
        respondedAt: new Date(),
      },
    });

    // Send confirmation email
    try {
      await sendConfirmation({
        to: guest.email,
        guestName: guest.name,
        event: {
          title: guest.event.title,
          date: guest.event.date,
          location: guest.event.location,
          description: guest.event.description,
        },
        status,
        rsvpToken: token,
        replyTo: guest.event.replyTo,
      });
    } catch (emailError) {
      logger.error('Failed to send confirmation email for quick RSVP', emailError);
      // Continue even if email fails - RSVP was recorded
    }

    // Build success message based on status
    let message = 'rsvp_confirmed';
    if (status === 'ATTENDING') {
      message = 'rsvp_attending';
    } else if (status === 'MAYBE') {
      message = 'rsvp_maybe';
    } else if (status === 'NOT_ATTENDING') {
      message = 'rsvp_not_attending';
    }

    // Redirect to event page with token for prefilling and success message
    return NextResponse.redirect(
      `${appUrl}/events/${guest.event.slug}?token=${token}&success=${message}`
    );
  } catch (error) {
    logger.error('Quick RSVP error', error);
    const appUrl = await getAppUrl();
    return NextResponse.redirect(`${appUrl}?error=rsvp_failed`);
  }
}
