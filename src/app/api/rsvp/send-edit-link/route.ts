import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { getEmailConfig } from '@/lib/config';

async function createTransporter() {
  const config = await getEmailConfig();
  if (config && config.host && config.user && config.password) {
    return nodemailer.createTransport({
      host: config.host,
      port: parseInt(config.port || '587'),
      secure: config.port === '465',
      auth: {
        user: config.user,
        pass: config.password,
      },
    });
  }
  
  // Fallback to env vars
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  
  return null;
}

const sendEditLinkSchema = z.object({
  email: z.string().email('Invalid email address'),
  eventId: z.string(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = sendEditLinkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, eventId } = parsed.data;

    // Find the guest by email and event
    const guest = await prisma.guest.findUnique({
      where: {
        eventId_email: {
          eventId,
          email,
        },
      },
      include: {
        event: {
          select: {
            title: true,
            date: true,
            location: true,
          },
        },
      },
    });

    if (!guest) {
      // Don't reveal if email exists or not for security - always return success
      // This prevents email enumeration attacks
      return NextResponse.json({
        success: true,
        message: 'If an RSVP exists for this email, you will receive an edit link shortly.',
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const editLink = `${appUrl}/rsvp/${guest.token}/edit`;

    const transporter = await createTransporter();
    if (!transporter) {
      // Don't reveal if email exists or not for security - always return success
      return NextResponse.json({
        success: true,
        message: 'If an RSVP exists for this email, you will receive an edit link shortly.',
      });
    }

    const emailConfig = await getEmailConfig();
    const fromAddress = emailConfig?.from || process.env.SMTP_FROM || process.env.SMTP_USER || emailConfig?.user || '';

    // Send email with edit link
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Edit Your RSVP</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Edit Your RSVP</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                      ${guest.name ? `Hi ${guest.name},` : 'Hello,'}
                    </p>
                    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                      You requested a link to edit your RSVP for <strong>${guest.event.title}</strong>.
                    </p>
                    
                    <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 30px;">
                      <h3 style="color: #111827; font-size: 16px; margin: 0 0 12px; font-weight: 600;">Event Details</h3>
                      <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px;">
                        <strong>Event:</strong> ${guest.event.title}
                      </p>
                      <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px;">
                        <strong>Date:</strong> ${new Date(guest.event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                      ${guest.event.location ? `<p style="color: #6b7280; font-size: 14px; margin: 0;"><strong>Location:</strong> ${guest.event.location}</p>` : ''}
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                      <a href="${editLink}" style="display: inline-block; background-color: #8b5cf6; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                        Edit Your RSVP
                      </a>
                    </div>
                    
                    <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 30px 0 0; line-height: 1.5;">
                      If the button doesn't work, copy and paste this link:<br>
                      <a href="${editLink}" style="color: #8b5cf6;">${editLink}</a>
                    </p>
                    
                    <p style="color: #9ca3af; font-size: 12px; margin: 30px 0 0; line-height: 1.5;">
                      <strong>Note:</strong> This link will allow you to edit your RSVP. Keep it safe and don't share it with others.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                      Sent via OwnRSVP
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: `Edit Your RSVP for ${guest.event.title}`,
      html,
    });

    return NextResponse.json({
      success: true,
      message: 'If an RSVP exists for this email, you will receive an edit link shortly.',
    });
  } catch (error) {
    console.error('Send edit link error:', error);
    return NextResponse.json(
      { error: 'Failed to send edit link' },
      { status: 500 }
    );
  }
}

