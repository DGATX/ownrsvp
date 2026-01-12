import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getEmailConfig, updateEmailConfig, syncToEnvFile } from '@/lib/config';
import { sendInvitation } from '@/lib/email';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const emailConfigSchema = z.object({
  host: z.string().min(1, 'SMTP host is required'),
  port: z.string().min(1, 'SMTP port is required'),
  user: z.string().min(1, 'SMTP username is required'),
  password: z.string().min(1, 'SMTP password is required'),
  from: z.string().optional(),
});

/**
 * GET - Retrieve current email configuration (masked password)
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

    const config = await getEmailConfig();

    if (!config) {
      return NextResponse.json({
        configured: false,
        config: null,
      });
    }

    // Return actual password for admin (endpoint is already protected)
    return NextResponse.json({
      configured: true,
      config,
    });
  } catch (error) {
    logger.error('Get email config error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update email configuration
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
    const parsed = emailConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    // Update in database
    await updateEmailConfig(parsed.data, session.user.id);

    // Sync to .env file
    try {
      await syncToEnvFile();
    } catch (error) {
      logger.error('Failed to sync to .env file', error);
      // Continue anyway - database update succeeded
    }

    // Mask password for response
    const maskedPassword = parsed.data.password.length > 4
      ? '*'.repeat(parsed.data.password.length - 4) + parsed.data.password.slice(-4)
      : '****';

    return NextResponse.json({
      success: true,
      message: 'Email configuration updated successfully',
      config: {
        ...parsed.data,
        password: maskedPassword,
      },
      restartRequired: true,
    });
  } catch (error) {
    logger.error('Update email config error', error);
    return NextResponse.json(
      { error: 'Failed to update email configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST - Send test email
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

    const body = await request.json();
    const { testEmail } = body;

    if (!testEmail || typeof testEmail !== 'string') {
      return NextResponse.json(
        { error: 'testEmail is required' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const config = await getEmailConfig();
    if (!config) {
      return NextResponse.json({
        success: false,
        error: 'Email not configured',
        message: 'Please configure email settings before testing',
      }, { status: 400 });
    }

    // Send test email using the configured settings
    const testToken = 'test-token-' + Date.now();

    try {
      await sendInvitation({
        to: testEmail,
        guestName: 'Test User',
        event: {
          title: 'Test Event - Email Configuration',
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          location: 'Test Location',
          description: 'This is a test email to verify your SMTP configuration is working correctly.',
        },
        rsvpToken: testToken,
        hostName: 'OwnRSVP Test System',
      });

      return NextResponse.json({
        success: true,
        message: `Test email sent successfully to ${testEmail}`,
      });
    } catch (emailError) {
      logger.error('Test email error', emailError);
      return NextResponse.json({
        success: false,
        error: 'Failed to send test email',
        details: emailError instanceof Error ? emailError.message : String(emailError),
      }, { status: 500 });
    }
  } catch (error) {
    logger.error('Test email endpoint error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

