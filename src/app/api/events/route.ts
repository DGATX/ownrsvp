import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { generateSlug } from '@/lib/utils';
import { parseReminderSchedule, serializeReminderSchedule, validateReminders } from '@/lib/reminder-utils';
import { logger } from '@/lib/logger';

const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  location: z.string().optional(),
  date: z.string().transform((val) => {
    const date = new Date(val);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format: ${val}`);
    }
    if (date.getFullYear() < 1900 || date.getFullYear() > 2100) {
      throw new Error(`Invalid year: ${date.getFullYear()}. Date: ${val}`);
    }
    return date;
  }),
  endDate: z.string().optional().transform((val) => val && val.trim() !== '' ? new Date(val) : undefined),
  rsvpDeadline: z.string().optional().nullable().transform((val) => val ? new Date(val) : undefined),
  coverImage: z.string().nullable().optional(),
  photoAlbumUrl: z.string().optional(),
  reminderSchedule: z.string().optional(),
  maxGuestsPerInvitee: z.number().int().min(1).nullable().optional(),
  isPublic: z.boolean().optional().default(true),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createEventSchema.safeParse(body);

    if (!parsed.success) {
      logger.error('Validation error', JSON.stringify(parsed.error.errors, null, 2));
      logger.error('Request body', JSON.stringify(body, null, 2));
      return NextResponse.json(
        { error: parsed.error.errors[0].message, details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { title, description, location, date, endDate, rsvpDeadline, coverImage, photoAlbumUrl: rawPhotoAlbumUrl, reminderSchedule, maxGuestsPerInvitee, isPublic } = parsed.data;

    // Validate end date is not before start date
    if (endDate && endDate < date) {
      return NextResponse.json(
        { error: 'End date cannot be before the event start date' },
        { status: 400 }
      );
    }

    // Validate RSVP deadline is not after event date
    if (rsvpDeadline && rsvpDeadline > date) {
      return NextResponse.json(
        { error: 'RSVP deadline cannot be after the event start date' },
        { status: 400 }
      );
    }

    // Validate and normalize photoAlbumUrl
    let photoAlbumUrl: string | null = null;
    if (rawPhotoAlbumUrl !== undefined && rawPhotoAlbumUrl !== null && rawPhotoAlbumUrl.trim() !== '') {
      try {
        new URL(rawPhotoAlbumUrl);
        photoAlbumUrl = rawPhotoAlbumUrl;
      } catch {
        // Invalid URL format
        return NextResponse.json(
          { error: 'Invalid photo album URL format. Please provide a valid URL (e.g., https://photos.google.com/...)' },
          { status: 400 }
        );
      }
    }

    // Generate unique slug
    const baseSlug = generateSlug(title);
    let slug = baseSlug;
    let counter = 0;

    while (await prisma.event.findUnique({ where: { slug } })) {
      counter++;
      slug = `${baseSlug}-${nanoid(4)}`;
    }

    // Parse and validate reminderSchedule (handles both old and new formats)
    let reminderScheduleValue: string | null = null;
    if (reminderSchedule) {
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

    // Build the data object for Prisma - explicitly set all fields
    // Note: Only include reminderSchedule if it has a value, otherwise omit it
    const eventData: any = {
      title: String(title),
      slug: String(slug),
      description: description ? String(description) : null,
      location: location ? String(location) : null,
      date: date instanceof Date ? date : new Date(date),
      endDate: endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : null,
      rsvpDeadline: rsvpDeadline ? (rsvpDeadline instanceof Date ? rsvpDeadline : new Date(rsvpDeadline)) : null,
      coverImage: coverImage ? String(coverImage) : null,
      photoAlbumUrl: (photoAlbumUrl && photoAlbumUrl.trim() !== '') ? String(photoAlbumUrl) : null,
      maxGuestsPerInvitee: maxGuestsPerInvitee !== undefined ? maxGuestsPerInvitee : null,
      isPublic: Boolean(isPublic ?? true),
      hostId: String(session.user.id),
    };

    // Only include reminderSchedule if it has a value
    if (reminderScheduleValue) {
      eventData.reminderSchedule = String(reminderScheduleValue);
    }

    // Log the data we're about to send to Prisma (without the large base64 image)
    const logData = {
      ...eventData,
      date: eventData.date.toISOString(),
      endDate: eventData.endDate?.toISOString() || null,
      rsvpDeadline: eventData.rsvpDeadline?.toISOString() || null,
      coverImage: eventData.coverImage ? `${eventData.coverImage.substring(0, 50)}...` : null,
    };
    logger.debug('Creating event with data', { data: logData });
    logger.debug('Event data keys', { keys: Object.keys(eventData) });
    logger.debug('Event data types', {
      types: Object.entries(eventData).map(([k, v]) => ({
        key: k,
        type: typeof v,
        isNull: v === null
      }))
    });

    const event = await prisma.event.create({
      data: eventData,
    });

    return NextResponse.json({ event });
  } catch (error) {
    logger.error('Create event error', error, {
      errorType: typeof error,
      errorName: error instanceof Error ? error.name : 'N/A',
      errorStack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    // If it's a Prisma error, extract more details
    let errorMessage = error instanceof Error ? error.message : String(error);
    let prismaErrorCode = null;
    let fullErrorDetails = '';
    
    // Check if it's a Prisma known request error (has code)
    if (error && typeof error === 'object' && 'code' in error) {
      prismaErrorCode = (error as any).code;
      logger.error('Prisma error details', undefined, {
        code: prismaErrorCode,
        meta: (error as any).meta
      });
      
      // Get full error details for validation errors
      if (error instanceof Error) {
        fullErrorDetails = error.message;
      }
      
      // Provide more user-friendly error messages for common Prisma errors
      if (prismaErrorCode === 'P2002') {
        errorMessage = 'An event with this title already exists. Please choose a different title.';
      } else if (prismaErrorCode === 'P2003') {
        errorMessage = 'Invalid reference. Please check your data and try again.';
      } else if (prismaErrorCode === 'P2011') {
        errorMessage = 'A required field is missing.';
      } else if (prismaErrorCode === 'P2012') {
        errorMessage = 'Invalid data format.';
      }
    }
    
    // Handle Prisma validation errors (PrismaClientValidationError)
    if (error instanceof Error && error.name === 'PrismaClientValidationError') {
      logger.error('Prisma validation error detected', error);
      // Try to extract the actual validation issue from the message
      const msg = error.message;
      if (msg.includes('Argument `data`')) {
        // Extract the problematic field if possible
        const fieldMatch = msg.match(/Argument `(\w+)`/);
        if (fieldMatch) {
          errorMessage = `Invalid data for field: ${fieldMatch[1]}. Please check your input.`;
        } else {
          errorMessage = 'Invalid data format. Please check all fields and try again.';
        }
      }
    }
    
    // Truncate very long error messages (like base64 images)
    if (errorMessage.length > 500) {
      errorMessage = errorMessage.substring(0, 500) + '... (truncated)';
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create event', 
        details: fullErrorDetails || errorMessage,
        type: error instanceof Error ? error.name : typeof error,
        prismaErrorCode: prismaErrorCode,
        fullError: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const events = await prisma.event.findMany({
      where: { hostId: session.user.id },
      include: {
        guests: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ events });
  } catch (error) {
    logger.error('Get events error', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

