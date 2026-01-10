import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { validateGuestLimit } from '@/lib/rsvp-validation';
import { z } from 'zod';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string; guestId: string }>;
}

const updateGuestSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  email: z.string().email('Invalid email').optional(),
  phone: z.string().optional().nullable(),
  status: z.enum(['PENDING', 'ATTENDING', 'NOT_ATTENDING', 'MAYBE']).optional(),
  additionalGuests: z.array(z.string().min(1, 'Guest name is required')).optional(),
  dietaryNotes: z.string().optional().nullable(),
  notifyByEmail: z.boolean().optional(),
  notifyBySms: z.boolean().optional(),
  maxGuests: z.number().int().min(1).nullable().optional(),
});

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId, guestId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify event ownership
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event || event.hostId !== session.user.id) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Get existing guest
    const existingGuest = await prisma.guest.findUnique({
      where: { id: guestId },
      include: { additionalGuests: true },
    });

    if (!existingGuest || existingGuest.eventId !== eventId) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateGuestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, email, phone, status, additionalGuests, dietaryNotes, notifyByEmail, notifyBySms, maxGuests } = parsed.data;

    // Check email uniqueness if email is being changed
    if (email && email !== existingGuest.email) {
      const emailExists = await prisma.guest.findUnique({
        where: { eventId_email: { eventId, email } },
      });

      if (emailExists) {
        return NextResponse.json(
          { error: 'This email is already used for another guest in this event' },
          { status: 400 }
        );
      }
    }

    // Filter out empty additional guest names
    const validAdditionalGuests = (additionalGuests || [])
      .filter((g: string) => g.trim().length > 0)
      .map((g: string) => g.trim());

    // Validate guest limit if status is ATTENDING or being changed to ATTENDING
    const finalStatus = status !== undefined ? status : existingGuest.status;
    if (finalStatus === 'ATTENDING') {
      // Use per-guest limit if set, otherwise use global limit
      const guestMaxGuests = maxGuests !== undefined ? maxGuests : existingGuest.maxGuests;
      const validation = validateGuestLimit(event.maxGuestsPerInvitee, validAdditionalGuests.length, guestMaxGuests);
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
        where: { guestId },
      });
    }

    // Update guest
    const updatedGuest = await prisma.guest.update({
      where: { id: guestId },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(status !== undefined && { status }),
        ...(dietaryNotes !== undefined && { dietaryNotes }),
        ...(notifyByEmail !== undefined && { notifyByEmail }),
        ...(notifyBySms !== undefined && { notifyBySms: notifyBySms && !!phone }),
        ...(maxGuests !== undefined && { maxGuests }),
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
      },
    });

    return NextResponse.json({ guest: updatedGuest });
  } catch (error) {
    logger.error('Update guest error', error);
    return NextResponse.json(
      { error: 'Failed to update guest' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId, guestId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify event ownership
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event || event.hostId !== session.user.id) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Delete guest
    await prisma.guest.delete({
      where: { id: guestId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Delete guest error', error);
    return NextResponse.json(
      { error: 'Failed to delete guest' },
      { status: 500 }
    );
  }
}

