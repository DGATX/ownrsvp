import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isEventHost } from '@/lib/event-access';
import { z } from 'zod';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string; cohostId: string }>;
}

const updateCoHostSchema = z.object({
  role: z.enum(['COHOST', 'VIEWER']),
});

// PATCH /api/events/[id]/cohosts/[cohostId] - Update co-host role
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId, cohostId } = await params;
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only host or admin can update co-hosts
    const isHost = await isEventHost(session.user.id, eventId);
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    
    if (!isHost && user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only the host can update co-hosts' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateCoHostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const coHost = await prisma.eventCoHost.update({
      where: { id: cohostId },
      data: { role: parsed.data.role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ coHost });
  } catch (error) {
    logger.error('Update co-host error', error);
    return NextResponse.json(
      { error: 'Failed to update co-host' },
      { status: 500 }
    );
  }
}

// DELETE /api/events/[id]/cohosts/[cohostId] - Remove co-host
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId, cohostId } = await params;
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only host or admin can remove co-hosts
    const isHost = await isEventHost(session.user.id, eventId);
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    
    if (!isHost && user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only the host can remove co-hosts' },
        { status: 403 }
      );
    }

    // Verify the co-host exists and belongs to this event
    const coHost = await prisma.eventCoHost.findUnique({
      where: { id: cohostId },
    });

    if (!coHost || coHost.eventId !== eventId) {
      return NextResponse.json(
        { error: 'Co-host not found' },
        { status: 404 }
      );
    }

    await prisma.eventCoHost.delete({
      where: { id: cohostId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Remove co-host error', error);
    return NextResponse.json(
      { error: 'Failed to remove co-host' },
      { status: 500 }
    );
  }
}

