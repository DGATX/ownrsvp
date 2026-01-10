/**
 * Authentication utilities for API routes
 * Eliminates duplicate auth check patterns across 40+ routes
 */

import { auth } from '@/auth';
import { unauthorizedResponse, forbiddenResponse } from './api-response';
import type { NextResponse } from 'next/server';

export interface AuthSession {
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
    role?: string;
  };
}

/**
 * Get current session or throw unauthorized error
 * Use this to require authentication in API routes
 *
 * @example
 * export async function GET() {
 *   const session = await requireAuth();
 *   // session.user.id is guaranteed to exist
 * }
 */
export async function requireAuth(): Promise<AuthSession> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new UnauthorizedError('Authentication required');
  }

  return session as AuthSession;
}

/**
 * Get current session or throw unauthorized error, then verify role
 * Use this to require specific roles (e.g., 'admin')
 *
 * @example
 * export async function DELETE() {
 *   const session = await requireRole('admin');
 *   // User is authenticated AND has admin role
 * }
 */
export async function requireRole(...allowedRoles: string[]): Promise<AuthSession> {
  const session = await requireAuth();

  if (!allowedRoles.includes(session.user.role || '')) {
    throw new ForbiddenError('Insufficient permissions');
  }

  return session;
}

/**
 * Get current session if exists, otherwise return null
 * Use this for optional authentication
 *
 * @example
 * export async function GET() {
 *   const session = await getOptionalAuth();
 *   if (session) {
 *     // User is logged in
 *   } else {
 *     // User is not logged in
 *   }
 * }
 */
export async function getOptionalAuth(): Promise<AuthSession | null> {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  return session as AuthSession;
}

/**
 * Custom error for unauthorized access
 * Can be caught and converted to proper HTTP response
 */
export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Custom error for forbidden access (authenticated but insufficient permissions)
 * Can be caught and converted to proper HTTP response
 */
export class ForbiddenError extends Error {
  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Middleware wrapper for API routes with automatic error handling
 * Wraps your route handler and automatically catches auth errors
 *
 * @example
 * export const GET = withAuth(async (req, session) => {
 *   // session.user.id is guaranteed to exist
 *   return NextResponse.json({ userId: session.user.id });
 * });
 *
 * @example with role check
 * export const DELETE = withAuth(
 *   async (req, session) => {
 *     // User is admin
 *     return NextResponse.json({ success: true });
 *   },
 *   { roles: ['admin'] }
 * );
 */
export function withAuth<T extends NextResponse>(
  handler: (req: Request, session: AuthSession) => Promise<T>,
  options?: { roles?: string[] }
) {
  return async (req: Request): Promise<T | NextResponse> => {
    try {
      const session = options?.roles
        ? await requireRole(...options.roles)
        : await requireAuth();

      return await handler(req, session);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return unauthorizedResponse(error.message) as T;
      }
      if (error instanceof ForbiddenError) {
        return forbiddenResponse(error.message) as T;
      }
      throw error; // Re-throw other errors to be handled by route
    }
  };
}
