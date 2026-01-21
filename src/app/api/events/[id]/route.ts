import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { canManageEvent } from '@/lib/event-access';
import { sendEventChangeEmail } from '@/lib/email';
import { z } from 'zod';
import { format } from 'date-fns';
import { parseReminderSchedule, serializeReminderSchedule, validateReminders } from '@/lib/reminder-utils';
import { logger } from '@/lib/logger';
import { formatAddressOneLine, AddressFields } from '@/lib/address-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user can manage this event (host, co-host, or admin)
    const canManage = await canManageEvent(session.user.id, id);
    if (!canManage) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        guests: {
          include: {
            additionalGuests: true,
          },
        },
        comments: {
          orderBy: { createdAt: 'desc' },
        },
        coHosts: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        updates: {
          orderBy: { sentAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (error) {
    logger.error('Get event error', error);
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

const updateEventSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().nullable().optional(),
  // Structured address fields
  locationName: z.string().nullable().optional(),
  streetAddress1: z.string().nullable().optional(),
  streetAddress2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zipCode: z.string().nullable().optional(),
  date: z.string().transform((val) => {
    const date = new Date(val);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format: ${val}`);
    }
    if (date.getFullYear() < 1900 || date.getFullYear() > 2100) {
      throw new Error(`Invalid year: ${date.getFullYear()}. Date: ${val}`);
    }
    return date;
  }).optional(),
  endDate: z.string().optional().nullable().transform((val) => val && val.trim() !== '' ? new Date(val) : null),
  rsvpDeadline: z.string().optional().nullable().transform((val) => val && val.trim() !== '' ? new Date(val) : null),
  timezone: z.string().optional(),
  coverImage: z.string().nullable().optional(),
  photoAlbumUrl: z.string().nullable().optional(),
  reminderSchedule: z.string().optional().nullable(),
  maxGuestsPerInvitee: z.number().int().min(1).nullable().optional(),
  replyTo: z.string().email().nullable().optional().or(z.literal('')),
  isPublic: z.boolean().optional(),
  notifyGuests: z.boolean().optional().default(false),
});

// Helper to detect significant changes
function detectChanges(
  existing: { title: string; date: Date } & AddressFields,
  updated: { title?: string; date?: Date } & Partial<AddressFields>
): { field: string; oldValue: string; newValue: string }[] {
  const changes: { field: string; oldValue: string; newValue: string }[] = [];

  if (updated.title && updated.title !== existing.title) {
    changes.push({
      field: 'Title',
      oldValue: existing.title,
      newValue: updated.title,
    });
  }

  if (updated.date) {
    const existingDateStr = format(existing.date, 'MMM d, yyyy h:mm a');
    const newDateStr = format(updated.date, 'MMM d, yyyy h:mm a');
    if (existingDateStr !== newDateStr) {
      changes.push({
        field: 'Date & Time',
        oldValue: existingDateStr,
        newValue: newDateStr,
      });
    }
  }

  // Check for location changes (any of the address fields)
  const addressFieldsToCheck: (keyof AddressFields)[] = ['locationName', 'streetAddress1', 'streetAddress2', 'city', 'state', 'zipCode'];
  const hasAddressChange = addressFieldsToCheck.some(field =>
    updated[field] !== undefined && updated[field] !== existing[field]
  );

  if (hasAddressChange) {
    const existingAddress = formatAddressOneLine(existing);
    const newAddressFields: AddressFields = {
      locationName: updated.locationName !== undefined ? updated.locationName : existing.locationName,
      streetAddress1: updated.streetAddress1 !== undefined ? updated.streetAddress1 : existing.streetAddress1,
      streetAddress2: updated.streetAddress2 !== undefined ? updated.streetAddress2 : existing.streetAddress2,
      city: updated.city !== undefined ? updated.city : existing.city,
      state: updated.state !== undefined ? updated.state : existing.state,
      zipCode: updated.zipCode !== undefined ? updated.zipCode : existing.zipCode,
    };
    const newAddress = formatAddressOneLine(newAddressFields);

    if (existingAddress !== newAddress) {
      changes.push({
        field: 'Location',
        oldValue: existingAddress || '(No location)',
        newValue: newAddress || '(No location)',
      });
    }
  }

  return changes;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user can manage this event (host, co-host, or admin)
    const canManage = await canManageEvent(session.user.id, id);
    if (!canManage) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const existingEvent = await prisma.event.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { notifyGuests, photoAlbumUrl: rawPhotoAlbumUrl, reminderSchedule, maxGuestsPerInvitee, replyTo: rawReplyTo, timezone, ...updateData } = parsed.data;

    // Validate end date is not before start date
    const finalDate = updateData.date || existingEvent.date;
    if (updateData.endDate && finalDate && updateData.endDate < finalDate) {
      return NextResponse.json(
        { error: 'End date cannot be before the event start date' },
        { status: 400 }
      );
    }

    // Validate RSVP deadline is not after event date
    if (updateData.rsvpDeadline && finalDate && updateData.rsvpDeadline > finalDate) {
      return NextResponse.json(
        { error: 'RSVP deadline cannot be after the event start date' },
        { status: 400 }
      );
    }

    // Validate and normalize photoAlbumUrl
    let photoAlbumUrl: string | null | undefined = undefined;
    if (rawPhotoAlbumUrl !== undefined) {
      if (!rawPhotoAlbumUrl || rawPhotoAlbumUrl.trim() === '') {
        photoAlbumUrl = null;
      } else {
        try {
          new URL(rawPhotoAlbumUrl);
          photoAlbumUrl = rawPhotoAlbumUrl;
        } catch {
          // Invalid URL, set to null
          photoAlbumUrl = null;
        }
      }
    }

    // Normalize replyTo
    let replyTo: string | null | undefined = undefined;
    if (rawReplyTo !== undefined) {
      replyTo = (!rawReplyTo || rawReplyTo.trim() === '') ? null : rawReplyTo.trim();
    }

    // Parse and validate reminderSchedule (handles both old and new formats)
    let reminderScheduleValue: string | null | undefined = undefined;
    if (reminderSchedule !== undefined) {
      if (!reminderSchedule || reminderSchedule.trim() === '') {
        reminderScheduleValue = null;
      } else {
        try {
          const parsed = parseReminderSchedule(reminderSchedule);
          const validation = validateReminders(parsed);
          if (validation.valid) {
            reminderScheduleValue = serializeReminderSchedule(parsed);
          } else {
            return NextResponse.json(
              { error: `Invalid reminder schedule: ${validation.error}` },
              { status: 400 }
            );
          }
        } catch (error) {
          return NextResponse.json(
            { error: 'Invalid reminder schedule format' },
            { status: 400 }
          );
        }
      }
    }

    // Detect changes before updating
    const changes = detectChanges(existingEvent, updateData);

    // Build the data object for Prisma - only include fields that are being updated
    const updateFields: any = {
      ...updateData,
    };

    // Only include optional fields if they're explicitly provided
    if (updateData.description !== undefined) {
      updateFields.description = updateData.description || null;
    }
    // Structured address fields
    if (updateData.locationName !== undefined) {
      updateFields.locationName = updateData.locationName || null;
    }
    if (updateData.streetAddress1 !== undefined) {
      updateFields.streetAddress1 = updateData.streetAddress1 || null;
    }
    if (updateData.streetAddress2 !== undefined) {
      updateFields.streetAddress2 = updateData.streetAddress2 || null;
    }
    if (updateData.city !== undefined) {
      updateFields.city = updateData.city || null;
    }
    if (updateData.state !== undefined) {
      updateFields.state = updateData.state || null;
    }
    if (updateData.zipCode !== undefined) {
      updateFields.zipCode = updateData.zipCode || null;
    }
    if (updateData.endDate !== undefined) {
      updateFields.endDate = updateData.endDate || null;
    }
    if (updateData.rsvpDeadline !== undefined) {
      updateFields.rsvpDeadline = updateData.rsvpDeadline || null;
    }
    if (updateData.coverImage !== undefined) {
      updateFields.coverImage = updateData.coverImage || null;
    }
    if (photoAlbumUrl !== undefined) {
      updateFields.photoAlbumUrl = photoAlbumUrl;
    }
    // Only include maxGuestsPerInvitee if it's explicitly provided
    if (maxGuestsPerInvitee !== undefined) {
      updateFields.maxGuestsPerInvitee = maxGuestsPerInvitee;
    }
    // Only include replyTo if it's explicitly provided
    if (replyTo !== undefined) {
      updateFields.replyTo = replyTo;
    }
    // Only include reminderSchedule if it's explicitly provided
    if (reminderScheduleValue !== undefined) {
      updateFields.reminderSchedule = reminderScheduleValue;
    }
    // Only include timezone if it's explicitly provided
    if (timezone !== undefined) {
      updateFields.timezone = timezone || null;
    }

    const event = await prisma.event.update({
      where: { id },
      data: updateFields,
    });

    // Send notifications if requested and there are significant changes
    if (notifyGuests && changes.length > 0) {
      const guests = await prisma.guest.findMany({
        where: { eventId: id },
        select: {
          email: true,
          phone: true,
          name: true,
          notifyByEmail: true,
          notifyBySms: true,
          token: true,
        },
      });

      // Send notifications to all guests with proper error handling
      try {
        await Promise.all(
          guests.map(async (guest) => {
            const notificationPromises: Promise<void>[] = [];

            if (guest.notifyByEmail) {
              notificationPromises.push(
                sendEventChangeEmail({
                  to: guest.email,
                  guestName: guest.name,
                  eventTitle: event.title,
                  changes,
                  rsvpToken: guest.token,
                  replyTo: event.replyTo,
                }).catch((error) => {
                  logger.error(`Failed to send email to ${guest.email}`, error);
                  // Don't throw - we want to continue sending to other guests
                })
              );
            }

            await Promise.all(notificationPromises);
          })
        );
        logger.info(`Successfully sent notifications to ${guests.length} guests`);
      } catch (error) {
        logger.error('Error during notification sending', error);
        // Continue execution - notifications are not critical to the update operation
      }

      // Record the update
      await prisma.eventUpdate.create({
        data: {
          eventId: id,
          subject: 'Event Details Changed',
          message: changes.map((c) => `${c.field}: ${c.oldValue} → ${c.newValue}`).join('\n'),
          sentVia: 'BOTH',
          sentTo: guests.length,
          sentBy: session.user.id,
        },
      });
    }

    return NextResponse.json({ event, changesNotified: notifyGuests && changes.length > 0 ? changes.length : 0 });
  } catch (error) {
    logger.error('Update event error', error);
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user can manage this event (host, co-host, or admin)
    const canManage = await canManageEvent(session.user.id, id);
    if (!canManage) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const existingEvent = await prisma.event.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    await prisma.event.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Delete event error', error);
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}

