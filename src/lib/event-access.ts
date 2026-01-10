import { prisma } from './prisma';

/**
 * Check if a user can manage an event (view/edit guests, send invites, etc.)
 * Returns true if user is the host, a co-host, or an admin
 */
export async function canManageEvent(
  userId: string,
  eventId: string
): Promise<boolean> {
  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (user?.role === 'ADMIN') {
    return true;
  }

  // Check if user is host
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { hostId: true },
  });

  if (event?.hostId === userId) {
    return true;
  }

  // Check if user is co-host
  const coHost = await prisma.eventCoHost.findUnique({
    where: {
      eventId_userId: {
        eventId,
        userId,
      },
    },
  });

  return !!coHost;
}

/**
 * Check if user can view an event (host, co-host, admin, or viewer role)
 */
export async function canViewEvent(
  userId: string,
  eventId: string
): Promise<boolean> {
  return canManageEvent(userId, eventId);
}

/**
 * Check if user is the primary host of an event
 */
export async function isEventHost(
  userId: string,
  eventId: string
): Promise<boolean> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { hostId: true },
  });

  return event?.hostId === userId;
}

/**
 * Get user's role for an event
 * Returns: 'HOST', 'COHOST', 'VIEWER', 'ADMIN', or null if no access
 */
export async function getEventRole(
  userId: string,
  eventId: string
): Promise<'HOST' | 'COHOST' | 'VIEWER' | 'ADMIN' | null> {
  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (user?.role === 'ADMIN') {
    return 'ADMIN';
  }

  // Check if user is host
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { hostId: true },
  });

  if (event?.hostId === userId) {
    return 'HOST';
  }

  // Check if user is co-host
  const coHost = await prisma.eventCoHost.findUnique({
    where: {
      eventId_userId: {
        eventId,
        userId,
      },
    },
    select: { role: true },
  });

  if (coHost) {
    return coHost.role === 'VIEWER' ? 'VIEWER' : 'COHOST';
  }

  return null;
}

