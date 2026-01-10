import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getSmsConfig, updateSmsConfig, syncToEnvFile } from '@/lib/config';
import { sendSmsInvitation } from '@/lib/sms';
import { createSmsProvider } from '@/lib/sms/provider-factory';
import { z } from 'zod';

// Base schema - provider-specific validation happens in route
const smsConfigSchema = z.object({
  provider: z.enum(['twilio', 'aws-sns', 'vonage', 'messagebird', 'generic']).optional().default('twilio'),
  // Twilio fields
  accountSid: z.string().optional(),
  authToken: z.string().optional(),
  phoneNumber: z.string().optional(),
  // AWS SNS fields
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  region: z.string().optional(),
  // Vonage fields
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  from: z.string().optional(),
  // MessageBird fields
  originator: z.string().optional(),
  // Generic/Webhook fields
  webhookUrl: z.string().url().optional(),
  customHeaders: z.record(z.string()).optional(),
});

/**
 * GET - Retrieve current SMS configuration (masked token)
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

    const config = await getSmsConfig();

    if (!config) {
      return NextResponse.json({
        configured: false,
        config: null,
        provider: 'twilio', // Default provider
      });
    }

    const provider = config.provider || 'twilio';

    // Mask sensitive fields based on provider
    const maskedConfig: any = {
      provider,
      ...config,
    };

    // Mask sensitive tokens/passwords
    if (provider === 'twilio' && config.authToken) {
      maskedConfig.authToken = config.authToken.length > 4
        ? '*'.repeat(config.authToken.length - 4) + config.authToken.slice(-4)
        : '****';
    }
    if (provider === 'aws-sns' && config.secretAccessKey) {
      maskedConfig.secretAccessKey = config.secretAccessKey.length > 4
        ? '*'.repeat(config.secretAccessKey.length - 4) + config.secretAccessKey.slice(-4)
        : '****';
    }
    if (provider === 'vonage' && config.apiSecret) {
      maskedConfig.apiSecret = config.apiSecret.length > 4
        ? '*'.repeat(config.apiSecret.length - 4) + config.apiSecret.slice(-4)
        : '****';
    }
    if (provider === 'messagebird' && config.apiKey) {
      maskedConfig.apiKey = config.apiKey.length > 4
        ? '*'.repeat(config.apiKey.length - 4) + config.apiKey.slice(-4)
        : '****';
    }
    if (provider === 'generic' && config.apiKey) {
      maskedConfig.apiKey = config.apiKey.length > 4
        ? '*'.repeat(config.apiKey.length - 4) + config.apiKey.slice(-4)
        : '****';
    }

    return NextResponse.json({
      configured: true,
      config: maskedConfig,
      provider,
    });
  } catch (error) {
    console.error('Get SMS config error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update SMS configuration
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
    const parsed = smsConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const provider = parsed.data.provider || 'twilio';

    // Validate provider-specific required fields
    if (provider === 'twilio') {
      if (!parsed.data.accountSid || !parsed.data.authToken || !parsed.data.phoneNumber) {
        return NextResponse.json(
          { error: 'Twilio requires Account SID, Auth Token, and Phone Number' },
          { status: 400 }
        );
      }
    } else if (provider === 'aws-sns') {
      if (!parsed.data.accessKeyId || !parsed.data.secretAccessKey || !parsed.data.region) {
        return NextResponse.json(
          { error: 'AWS SNS requires Access Key ID, Secret Access Key, and Region' },
          { status: 400 }
        );
      }
    } else if (provider === 'vonage') {
      if (!parsed.data.apiKey || !parsed.data.apiSecret || !parsed.data.from) {
        return NextResponse.json(
          { error: 'Vonage requires API Key, API Secret, and From number' },
          { status: 400 }
        );
      }
    } else if (provider === 'messagebird') {
      if (!parsed.data.apiKey || !parsed.data.originator) {
        return NextResponse.json(
          { error: 'MessageBird requires API Key and Originator' },
          { status: 400 }
        );
      }
    } else if (provider === 'generic') {
      if (!parsed.data.webhookUrl) {
        return NextResponse.json(
          { error: 'Generic provider requires Webhook URL' },
          { status: 400 }
        );
      }
    }

    // Update in database
    await updateSmsConfig({ ...parsed.data, provider }, session.user.id);

    // Sync to .env file
    try {
      await syncToEnvFile();
    } catch (error) {
      console.error('Failed to sync to .env file:', error);
      // Continue anyway - database update succeeded
    }

    // Mask sensitive fields for response
    const maskedConfig: any = { ...parsed.data };
    if (provider === 'twilio' && parsed.data.authToken) {
      maskedConfig.authToken = parsed.data.authToken.length > 4
        ? '*'.repeat(parsed.data.authToken.length - 4) + parsed.data.authToken.slice(-4)
        : '****';
    }
    if (provider === 'aws-sns' && parsed.data.secretAccessKey) {
      maskedConfig.secretAccessKey = parsed.data.secretAccessKey.length > 4
        ? '*'.repeat(parsed.data.secretAccessKey.length - 4) + parsed.data.secretAccessKey.slice(-4)
        : '****';
    }
    if ((provider === 'vonage' || provider === 'messagebird' || provider === 'generic') && parsed.data.apiSecret) {
      maskedConfig.apiSecret = parsed.data.apiSecret.length > 4
        ? '*'.repeat(parsed.data.apiSecret.length - 4) + parsed.data.apiSecret.slice(-4)
        : '****';
    }

    return NextResponse.json({
      success: true,
      message: 'SMS configuration updated successfully',
      config: maskedConfig,
      provider,
      restartRequired: true,
    });
  } catch (error) {
    console.error('Update SMS config error:', error);
    return NextResponse.json(
      { error: 'Failed to update SMS configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST - Send test SMS
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
    const { testPhone } = body;

    if (!testPhone || typeof testPhone !== 'string') {
      return NextResponse.json(
        { error: 'testPhone is required' },
        { status: 400 }
      );
    }

    // Basic phone validation (should start with +)
    if (!testPhone.startsWith('+')) {
      return NextResponse.json(
        { error: 'Phone number must include country code (e.g., +15551234567)' },
        { status: 400 }
      );
    }

    const config = await getSmsConfig();
    if (!config) {
      return NextResponse.json({
        success: false,
        error: 'SMS not configured',
        message: 'Please configure SMS settings before testing',
      }, { status: 400 });
    }

    // Create provider instance for testing
    const { createSmsProvider } = await import('@/lib/sms/provider-factory');
    const provider = createSmsProvider(config);

    if (!provider.isConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'SMS provider not properly configured',
        message: `Please check your ${config.provider || 'Twilio'} configuration settings.`,
      }, { status: 400 });
    }

    // Send test SMS using the provider
    try {
      const testMessage = `Test SMS from OwnRSVP. Your SMS configuration is working correctly! Provider: ${provider.getName()}`;
      const result = await provider.sendSms(testPhone, testMessage);

      if (result.sent) {
        return NextResponse.json({
          success: true,
          message: `Test SMS sent successfully to ${testPhone} using ${provider.getName()}`,
          messageId: result.messageId,
          provider: provider.getName(),
        });
      } else {
        return NextResponse.json({
          success: false,
          error: 'Failed to send test SMS',
          reason: result.reason,
          provider: provider.getName(),
        }, { status: 500 });
      }
    } catch (smsError) {
      console.error('Test SMS error:', smsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to send test SMS',
        details: smsError instanceof Error ? smsError.message : String(smsError),
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Test SMS endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

