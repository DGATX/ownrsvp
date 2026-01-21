import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendConfirmation, sendRsvpChangeNotification, getEventHostsForNotification } from '@/lib/email';
import { validateGuestLimit } from '@/lib/rsvp-validation';
import { z } from 'zod';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ token: string }>;
}

const updateRsvpSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  phone: z.string().optional().nullable(),
  status: z.enum(['ATTENDING', 'NOT_ATTENDING', 'MAYBE']).optional(),
  additionalGuests: z.array(z.string().min(1, 'Guest name is required')).optional(),
  dietaryNotes: z.string().optional().nullable(),
});

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { token } = await params;

    const guest = await prisma.guest.findUnique({
      where: { token },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            date: true,
            timezone: true,
            locationName: true,
            streetAddress1: true,
            streetAddress2: true,
            city: true,
            state: true,
            zipCode: true,
            slug: true,
            rsvpDeadline: true,
            maxGuestsPerInvitee: true,
          },
        },
        additionalGuests: true,
      },
    });

    if (!guest) {
      return NextResponse.json({ error: 'RSVP not found' }, { status: 404 });
    }

    // Check if RSVP deadline has passed
    const deadlinePassed = guest.event.rsvpDeadline && new Date() > new Date(guest.event.rsvpDeadline);

    return NextResponse.json({ guest, deadlinePassed });
  } catch (error) {
    logger.error('Get RSVP error', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSVP' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { token } = await params;

    const body = await request.json();
    const parsed = updateRsvpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, phone, status, additionalGuests, dietaryNotes } = parsed.data;

    // Get existing guest with full event details
    const existingGuest = await prisma.guest.findUnique({
      where: { token },
      include: {
        event: {
          include: {
            host: true,
            coHosts: {
              include: {
                user: true,
              },
            },
          },
        },
        additionalGuests: true,
      },
    });

    if (!existingGuest) {
      return NextResponse.json({ error: 'RSVP not found' }, { status: 404 });
    }

    // Check if RSVP deadline has passed
    if (existingGuest.event.rsvpDeadline && new Date() > new Date(existingGuest.event.rsvpDeadline)) {
      return NextResponse.json(
        { error: 'The RSVP deadline for this event has passed' },
        { status: 400 }
      );
    }

    // Filter out empty additional guest names
    const validAdditionalGuests = (additionalGuests || [])
      .filter((g: string) => g.trim().length > 0)
      .map((g: string) => g.trim());

    // Validate guest limit if status is ATTENDING or being changed to ATTENDING
    const finalStatus = status || existingGuest.status;
    if (finalStatus === 'ATTENDING') {
      // Use per-guest limit if set, otherwise use global limit
      const validation = validateGuestLimit(existingGuest.event.maxGuestsPerInvitee, validAdditionalGuests.length, existingGuest.maxGuests);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }
    }

    // Delete existing additional guests if we're updating them
    if (additionalGuests !== undefined) {
      await prisma.additionalGuest.deleteMany({
        where: { guestId: existingGuest.id },
      });
    }

    // Update guest
    const updatedGuest = await prisma.guest.update({
      where: { id: existingGuest.id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(status !== undefined && { status }),
        ...(dietaryNotes !== undefined && { dietaryNotes }),
        ...(phone !== undefined && { notifyBySms: !!phone }),
        respondedAt: new Date(),
        ...(additionalGuests !== undefined && {
          additionalGuests: {
            create: validAdditionalGuests.map((guestName: string) => ({
              name: guestName,
            })),
          },
        }),
      },
      include: {
        additionalGuests: true,
        event: {
          include: {
            host: true,
            coHosts: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    // Get full event details for notifications
    const fullEvent = await prisma.event.findUnique({
      where: { id: existingGuest.eventId },
      include: {
        host: true,
        coHosts: {
          include: {
            user: true,
          },
        },
      },
    });

    // Send confirmations if status changed
    const confirmationPromises = [];

    if (updatedGuest.notifyByEmail) {
      confirmationPromises.push(
        sendConfirmation({
          to: existingGuest.email,
          guestName: updatedGuest.name || existingGuest.email,
          event: {
            title: updatedGuest.event.title,
            date: updatedGuest.event.date,
            locationName: updatedGuest.event.locationName,
            streetAddress1: updatedGuest.event.streetAddress1,
            streetAddress2: updatedGuest.event.streetAddress2,
            city: updatedGuest.event.city,
            state: updatedGuest.event.state,
            zipCode: updatedGuest.event.zipCode,
          },
          status: finalStatus,
          rsvpToken: token,
          replyTo: updatedGuest.event.replyTo,
        }).catch((error) => {
          logger.error('Failed to send confirmation email', error);
        })
      );
    }

    await Promise.all(confirmationPromises);

    // Detect what changed for notifications
    const statusChanged = status !== undefined && status !== existingGuest.status;
    const nameChanged = name !== undefined && name !== existingGuest.name;
    const additionalGuestsChanged = additionalGuests !== undefined;
    const dietaryNotesChanged = dietaryNotes !== undefined && dietaryNotes !== existingGuest.dietaryNotes;
    const phoneChanged = phone !== undefined && phone !== existingGuest.phone;
    
    const hasChanges = statusChanged || nameChanged || additionalGuestsChanged || dietaryNotesChanged || phoneChanged;
    
    // Determine change type
    let changeType: 'NEW' | 'UPDATED' | 'STATUS_CHANGED' = 'UPDATED';
    if (statusChanged) {
      changeType = 'STATUS_CHANGED';
    }

    // Send notifications to hosts (async, don't block response)
    if (hasChanges && fullEvent) {
      const { getAppUrl } = await import('@/lib/config');
      const appUrl = await getAppUrl();
      const eventUrl = `${appUrl}/dashboard/events/${fullEvent.id}`;
      
      getEventHostsForNotification(fullEvent.id)
        .then((hosts) => {
          const notificationPromises = hosts.map((host) =>
            sendRsvpChangeNotification({
              to: host.email,
              hostName: host.name,
              event: {
                title: fullEvent.title,
                date: fullEvent.date,
                locationName: fullEvent.locationName,
                streetAddress1: fullEvent.streetAddress1,
                streetAddress2: fullEvent.streetAddress2,
                city: fullEvent.city,
                state: fullEvent.state,
                zipCode: fullEvent.zipCode,
                description: fullEvent.description,
              },
              guest: {
                name: updatedGuest.name,
                email: updatedGuest.email,
                status: updatedGuest.status,
                additionalGuests: updatedGuest.additionalGuests,
                dietaryNotes: updatedGuest.dietaryNotes,
              },
              changeType,
              previousStatus: statusChanged ? existingGuest.status : null,
              eventUrl,
            }).catch((error) => {
              logger.error(`Failed to send RSVP notification to host ${host.email}`, error);
            })
          );
          return Promise.all(notificationPromises);
        })
        .catch((error) => {
          logger.error('Failed to send host notifications', error);
        });
    }

    return NextResponse.json({ guest: updatedGuest });
  } catch (error) {
    logger.error('Update RSVP error', error);
    return NextResponse.json(
      { error: 'Failed to update RSVP' },
      { status: 500 }
    );
  }
}

