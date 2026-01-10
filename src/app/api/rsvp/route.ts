import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendConfirmation, sendRsvpChangeNotification, getEventHostsForNotification } from '@/lib/email';
import { validateGuestLimit } from '@/lib/rsvp-validation';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const rsvpSchema = z.object({
  eventId: z.string(),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  status: z.enum(['ATTENDING', 'NOT_ATTENDING', 'MAYBE']),
  additionalGuests: z.array(z.string().min(1, 'Guest name is required')).optional().default([]),
  dietaryNotes: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = rsvpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { eventId, name, email, phone, status, additionalGuests, dietaryNotes } = parsed.data;

    // Filter out empty guest names
    const validAdditionalGuests = (additionalGuests || []).filter((g: string) => g.trim().length > 0);

    // Check if event exists and get full event details
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        host: true,
        coHosts: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check if RSVP deadline has passed
    if (event.rsvpDeadline && new Date() > new Date(event.rsvpDeadline)) {
      return NextResponse.json(
        { error: 'The RSVP deadline for this event has passed' },
        { status: 400 }
      );
    }

    // Check if guest already exists (by email for this event)
    const existingGuest = await prisma.guest.findUnique({
      where: { eventId_email: { eventId, email } },
      include: { additionalGuests: true },
    });

    // Validate guest limit if status is ATTENDING
    if (status === 'ATTENDING') {
      // Use per-guest limit if set, otherwise use global limit
      const guestMaxGuests = existingGuest?.maxGuests;
      const validation = validateGuestLimit(event.maxGuestsPerInvitee, validAdditionalGuests.length, guestMaxGuests);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }
    }

    let guest;

    if (existingGuest) {
      // Delete existing additional guests
      await prisma.additionalGuest.deleteMany({
        where: { guestId: existingGuest.id },
      });

      // Update existing guest
      guest = await prisma.guest.update({
        where: { id: existingGuest.id },
        data: {
          name,
          phone: phone || existingGuest.phone,
          status,
          dietaryNotes: status === 'ATTENDING' ? dietaryNotes : null,
          notifyBySms: phone ? true : existingGuest.notifyBySms,
          respondedAt: new Date(),
          additionalGuests: {
            create: status === 'ATTENDING'
              ? validAdditionalGuests.map((guestName: string) => ({
                  name: guestName.trim(),
                }))
              : [],
          },
        },
        include: { additionalGuests: true },
      });
    } else {
      // Create new guest
      guest = await prisma.guest.create({
        data: {
          eventId,
          email,
          phone: phone || null,
          name,
          status,
          dietaryNotes: status === 'ATTENDING' ? dietaryNotes : null,
          notifyByEmail: true,
          notifyBySms: !!phone,
          respondedAt: new Date(),
          additionalGuests: {
            create: status === 'ATTENDING'
              ? validAdditionalGuests.map((guestName: string) => ({
                  name: guestName.trim(),
                }))
              : [],
          },
        },
        include: { additionalGuests: true },
      });
    }

    // Send confirmations
    const confirmationPromises = [];

    // Send email confirmation
    if (guest.notifyByEmail) {
      confirmationPromises.push(
        sendConfirmation({
          to: email,
          guestName: name,
          event: {
            title: event.title,
            date: event.date,
            location: event.location,
          },
          status,
          rsvpToken: guest.token,
        }).catch((error) => {
          logger.error('Failed to send confirmation email', error);
        })
      );
    }

    await Promise.all(confirmationPromises);

    // Send notifications to hosts (async, don't block response)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const eventUrl = `${appUrl}/dashboard/events/${eventId}`;
    
    getEventHostsForNotification(eventId)
      .then((hosts) => {
        const notificationPromises = hosts.map((host) =>
          sendRsvpChangeNotification({
            to: host.email,
            hostName: host.name,
            event: {
              title: event.title,
              date: event.date,
              location: event.location,
              description: event.description,
            },
            guest: {
              name: guest.name,
              email: guest.email,
              status: guest.status,
              additionalGuests: guest.additionalGuests,
              dietaryNotes: guest.dietaryNotes,
            },
            changeType: existingGuest ? 'UPDATED' : 'NEW',
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

    return NextResponse.json({ guest });
  } catch (error) {
    logger.error('RSVP error', error);
    return NextResponse.json(
      { error: 'Failed to submit RSVP' },
      { status: 500 }
    );
  }
}
