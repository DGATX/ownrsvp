import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getEmailConfig, getSmsConfig, syncToEnvFile } from '@/lib/config';
import { logger } from '@/lib/logger';

/**
 * GET - Get all configuration status
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

    const emailConfig = await getEmailConfig();
    const smsConfig = await getSmsConfig();

    return NextResponse.json({
      email: {
        configured: !!emailConfig,
      },
      sms: {
        configured: !!smsConfig,
      },
    });
  } catch (error) {
    logger.error('Get config status error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /sync-env - Manually trigger .env sync
 */
export async function POST(request: Request) {
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

    const url = new URL(request.url);
    if (url.pathname.endsWith('/sync-env')) {
      try {
        await syncToEnvFile();
        return NextResponse.json({
          success: true,
          message: 'Configuration synced to .env file successfully',
        });
      } catch (error) {
        logger.error('Sync to .env error', error);
        return NextResponse.json(
          { error: 'Failed to sync to .env file' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });
  } catch (error) {
    logger.error('Config route error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

