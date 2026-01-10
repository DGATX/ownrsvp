import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { canManageEvent, isEventHost } from '@/lib/event-access';
import { z } from 'zod';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const addCoHostSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.enum(['COHOST', 'VIEWER']).optional().default('COHOST'),
});

// GET /api/events/[id]/cohosts - List all co-hosts
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params;
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user can view this event
    const canView = await canManageEvent(session.user.id, eventId);
    if (!canView) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const coHosts = await prisma.eventCoHost.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { invitedAt: 'asc' },
    });

    return NextResponse.json({ coHosts });
  } catch (error) {
    logger.error('Get co-hosts error', error);
    return NextResponse.json(
      { error: 'Failed to fetch co-hosts' },
      { status: 500 }
    );
  }
}

// POST /api/events/[id]/cohosts - Add a co-host
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params;
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only host or admin can add co-hosts
    const isHost = await isEventHost(session.user.id, eventId);
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    
    if (!isHost && user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only the host can add co-hosts' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = addCoHostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, role } = parsed.data;

    // Find user by email
    const userToAdd = await prisma.user.findUnique({
      where: { email },
    });

    if (!userToAdd) {
      return NextResponse.json(
        { error: 'No user found with this email. They must have an account first.' },
        { status: 404 }
      );
    }

    // Check if this user is already the host
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { hostId: true },
    });

    if (event?.hostId === userToAdd.id) {
      return NextResponse.json(
        { error: 'This user is already the host of this event' },
        { status: 400 }
      );
    }

    // Check if already a co-host
    const existing = await prisma.eventCoHost.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId: userToAdd.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'This user is already a co-host' },
        { status: 400 }
      );
    }

    // Add co-host
    const coHost = await prisma.eventCoHost.create({
      data: {
        eventId,
        userId: userToAdd.id,
        role,
      },
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
    logger.error('Add co-host error', error);
    return NextResponse.json(
      { error: 'Failed to add co-host' },
      { status: 500 }
    );
  }
}

