import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { canManageEvent } from '@/lib/event-access';
import { format } from 'date-fns';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params;
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user can manage this event
    const canManage = await canManageEvent(session.user.id, eventId);
    if (!canManage) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        guests: {
          include: {
            additionalGuests: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Build CSV content
    const headers = [
      'Name',
      'Email',
      'Phone',
      'Status',
      'Additional Guests',
      'Dietary Notes',
      'RSVP Date',
      'Invited Date',
    ];

    const rows = event.guests.map((guest) => {
      const additionalGuestNames = guest.additionalGuests
        .map((ag) => ag.name)
        .join('; ');

      return [
        escapeCSV(guest.name || ''),
        escapeCSV(guest.email),
        escapeCSV(guest.phone || ''),
        guest.status,
        escapeCSV(additionalGuestNames),
        escapeCSV(guest.dietaryNotes || ''),
        guest.respondedAt ? format(new Date(guest.respondedAt), 'yyyy-MM-dd HH:mm') : '',
        format(new Date(guest.invitedAt), 'yyyy-MM-dd HH:mm'),
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    // Generate filename
    const eventSlug = event.slug || 'event';
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const filename = `${eventSlug}-guests-${dateStr}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error('Export guests error', error);
    return NextResponse.json(
      { error: 'Failed to export guests' },
      { status: 500 }
    );
  }
}

// Helper to escape CSV values
function escapeCSV(value: string): string {
  if (!value) return '';
  // If the value contains commas, quotes, or newlines, wrap in quotes and escape internal quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

