import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { canManageEvent } from '@/lib/event-access';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const bulkDeleteSchema = z.object({
  eventIds: z.array(z.string().min(1)).min(1, 'At least one event ID is required'),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = bulkDeleteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { eventIds } = parsed.data;

    // Verify all events exist
    const events = await prisma.event.findMany({
      where: {
        id: { in: eventIds },
      },
      select: {
        id: true,
        title: true,
        date: true,
      },
    });

    // Check if all requested events exist
    const foundIds = new Set(events.map(e => e.id));
    const missingIds = eventIds.filter(id => !foundIds.has(id));
    
    if (missingIds.length > 0) {
      return NextResponse.json(
        { error: `Some events not found: ${missingIds.join(', ')}` },
        { status: 404 }
      );
    }

    // Verify user can manage each event
    const permissionChecks = await Promise.all(
      events.map(async (event) => {
        const canManage = await canManageEvent(session.user.id, event.id);
        return { event, canManage };
      })
    );

    const unauthorizedEvents = permissionChecks.filter(({ canManage }) => !canManage);
    
    if (unauthorizedEvents.length > 0) {
      return NextResponse.json(
        { 
          error: `You don't have permission to delete some events: ${unauthorizedEvents.map(({ event }) => event.title).join(', ')}`,
          unauthorizedEventIds: unauthorizedEvents.map(({ event }) => event.id),
        },
        { status: 403 }
      );
    }

    // Verify all events are in the past (optional safety check)
    const now = new Date();
    const futureEvents = events.filter(e => new Date(e.date) >= now);
    
    if (futureEvents.length > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete future events: ${futureEvents.map(e => e.title).join(', ')}`,
          futureEventIds: futureEvents.map(e => e.id),
        },
        { status: 400 }
      );
    }

    // Delete events (cascading deletes will handle guests, comments, etc.)
    const results = {
      successCount: 0,
      failedCount: 0,
      errors: [] as string[],
    };

    for (const eventId of eventIds) {
      try {
        await prisma.event.delete({
          where: { id: eventId },
        });
        results.successCount++;
      } catch (error) {
        results.failedCount++;
        const event = events.find(e => e.id === eventId);
        results.errors.push(`Failed to delete "${event?.title || eventId}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (results.failedCount > 0) {
      return NextResponse.json(
        {
          successCount: results.successCount,
          failedCount: results.failedCount,
          errors: results.errors,
        },
        { status: 207 } // Multi-Status
      );
    }

    return NextResponse.json({
      successCount: results.successCount,
      failedCount: 0,
    });
  } catch (error) {
    logger.error('Bulk delete events error', error);
    return NextResponse.json(
      { error: 'Failed to delete events' },
      { status: 500 }
    );
  }
}

