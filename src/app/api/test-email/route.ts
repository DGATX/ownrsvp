import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateSmtpConfig } from '@/lib/env-validation';
import { sendInvitation } from '@/lib/email';
import { getEmailConfig } from '@/lib/config';

/**
 * Test endpoint to verify SMTP email configuration
 * Only accessible to authenticated admin users
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    
    // Only allow admins to test email
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { prisma } = await import('@/lib/prisma');
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check SMTP configuration
    const smtpConfig = await validateSmtpConfig();
    
    if (!smtpConfig.isValid) {
      return NextResponse.json({
        success: false,
        error: 'SMTP not configured',
        missing: smtpConfig.missing,
        warnings: smtpConfig.warnings,
        message: 'Please configure SMTP environment variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD',
      }, { status: 400 });
    }

    // Send a test invitation email
      const emailConfig = await getEmailConfig();
      if (!emailConfig) {
        return NextResponse.json({
          success: false,
          error: 'Email not configured',
          message: 'Please configure email settings before testing',
        }, { status: 400 });
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const testToken = 'test-token-' + Date.now();

      try {
        await sendInvitation({
        to: testEmail,
        guestName: 'Test User',
        event: {
          title: 'Test Event - Email Configuration',
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          location: 'Test Location',
          description: 'This is a test email to verify your SMTP configuration is working correctly.',
        },
        rsvpToken: testToken,
        hostName: 'OwnRSVP Test System',
      });

      return NextResponse.json({
        success: true,
        message: `Test email sent successfully to ${testEmail}`,
        config: {
          host: emailConfig.host,
          port: emailConfig.port,
          user: emailConfig.user,
          from: emailConfig.from || emailConfig.user,
        },
        warnings: smtpConfig.warnings,
      });
    } catch (emailError) {
      console.error('Test email error:', emailError);
      return NextResponse.json({
        success: false,
        error: 'Failed to send test email',
        details: emailError instanceof Error ? emailError.message : String(emailError),
        config: emailConfig ? {
          host: emailConfig.host,
          port: emailConfig.port,
          user: emailConfig.user,
        } : null,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Test email endpoint error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check SMTP configuration status
 */
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prisma } = await import('@/lib/prisma');
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const smtpConfig = await validateSmtpConfig();
    const emailConfig = await getEmailConfig();

    return NextResponse.json({
      configured: smtpConfig.isValid,
      missing: smtpConfig.missing,
      warnings: smtpConfig.warnings,
      config: emailConfig ? {
        host: emailConfig.host,
        port: emailConfig.port,
        user: emailConfig.user,
        from: emailConfig.from || emailConfig.user,
      } : null,
    });
  } catch (error) {
    console.error('Get SMTP config error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

