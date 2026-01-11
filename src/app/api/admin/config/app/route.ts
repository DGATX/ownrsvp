import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getAppUrl, updateAppUrl } from '@/lib/config';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const appUrlSchema = z.object({
  appUrl: z.string()
    .min(1, 'App URL is required')
    .refine((url) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    }, 'Must be a valid URL (e.g., https://rsvp.example.com)'),
});

/**
 * GET - Retrieve current app URL configuration
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

    const appUrl = await getAppUrl();

    // Check if it's from database or fallback
    const dbConfig = await prisma.appConfig.findUnique({
      where: {
        category_key: {
          category: 'app',
          key: 'APP_URL',
        },
      },
    });

    return NextResponse.json({
      appUrl,
      configured: !!dbConfig,
      source: dbConfig ? 'database' : 'environment',
    });
  } catch (error) {
    logger.error('Get app URL config error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update app URL configuration
 */
export async function PATCH(request: Request) {
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

    const body = await request.json();
    const parsed = appUrlSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    // Update in database
    await updateAppUrl(parsed.data.appUrl, session.user.id);

    // Get the normalized URL back
    const updatedUrl = await getAppUrl();

    return NextResponse.json({
      success: true,
      message: 'App URL updated successfully',
      appUrl: updatedUrl,
    });
  } catch (error) {
    logger.error('Update app URL config error', error);
    return NextResponse.json(
      { error: 'Failed to update app URL configuration' },
      { status: 500 }
    );
  }
}
