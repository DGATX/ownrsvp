import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { detectRestartMethod, attemptRestart, gracefulShutdown } from '@/lib/server-restart';
import { logger } from '@/lib/logger';

/**
 * POST - Attempt to restart the server
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Log restart attempt
    logger.info('Admin initiated server restart', { userId: session.user.id });

    // Detect restart method
    const method = await detectRestartMethod();
    
    // If graceful shutdown is the only option, perform it
    if (method.type === 'graceful') {
      // Start graceful shutdown in background (after response is sent)
      setImmediate(() => {
        gracefulShutdown();
      });

      return NextResponse.json({
        success: true,
        method: {
          type: method.type,
          description: method.description,
        },
        message: 'Server is shutting down gracefully. Please restart manually using: npm run dev (development) or npm start (production)',
        requiresManualRestart: true,
      });
    }

    // Attempt automatic restart
    const result = await attemptRestart();

    // If manual restart is required (can't auto-restart), perform graceful shutdown
    if (result.requiresManualRestart) {
      // Only shutdown gracefully if we're in development or can't auto-restart
      // In production with PM2/systemd, don't shutdown if restart command exists
      if (method.type === 'docker' && !result.success) {
        setImmediate(() => {
          gracefulShutdown();
        });
      }
    }

    return NextResponse.json({
      success: result.success,
      method: {
        type: result.method.type,
        description: result.method.description,
        command: result.method.command,
      },
      message: result.message,
      requiresManualRestart: result.requiresManualRestart,
      error: result.error,
    });
  } catch (error) {
    logger.error('Restart endpoint error', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: 'Failed to initiate restart. Please restart manually.',
        requiresManualRestart: true,
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Get restart method information (for UI display)
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const method = await detectRestartMethod();

    return NextResponse.json({
      method: {
        type: method.type,
        description: method.description,
        command: method.command,
      },
      isDevelopment: process.env.NODE_ENV === 'development',
    });
  } catch (error) {
    logger.error('Get restart method error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

