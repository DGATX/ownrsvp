import nodemailer from 'nodemailer';
import { formatDateTime } from './utils';
import { validateSmtpConfig, isEmailConfigured } from './env-validation';
import { getEmailConfig, getAppUrl } from './config';
import { prisma } from './prisma';
import { logger } from './logger';

// Helper to get "from" address
async function getFromAddress(): Promise<string> {
  const config = await getEmailConfig();

  // Use explicit "from" address if set
  if (config?.from && config.from.trim()) {
    return config.from;
  }
  if (process.env.SMTP_FROM && process.env.SMTP_FROM.trim()) {
    return process.env.SMTP_FROM;
  }

  // Fall back to SMTP_USER but format it nicely with app name
  const smtpUser = process.env.SMTP_USER || config?.user || '';
  if (smtpUser) {
    return `OwnRSVP <${smtpUser}>`;
  }

  return '';
}

// Create transporter dynamically using config manager
async function createTransporter() {
  try {
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
  } catch (error) {
    logger.error('Error creating transporter from config', error);
  }

  // Fallback to environment variables
  const smtpConfig = await validateSmtpConfig();
  if (smtpConfig.warnings.length > 0) {
    logger.warn('SMTP Configuration warnings', { warnings: smtpConfig.warnings });
  }

  if (smtpConfig.isValid) {
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

export { isEmailConfigured };

interface EventDetails {
  title: string;
  date: Date;
  location?: string | null;
  description?: string | null;
  coverImage?: string | null;
}

interface SendInvitationParams {
  to: string;
  guestName?: string | null;
  event: EventDetails;
  rsvpToken: string;
  hostName?: string | null;
  replyTo?: string | null;
}

export async function sendInvitation({
  to,
  guestName,
  event,
  rsvpToken,
  hostName,
  replyTo,
}: SendInvitationParams) {
  const transporter = await createTransporter();
  if (!transporter) {
    logger.warn('Email not configured - skipping invitation email', { to });
    throw new Error('Email service not configured. Please set SMTP environment variables.');
  }

  const appUrl = await getAppUrl();
  const rsvpLink = `${appUrl}/rsvp/${rsvpToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>You're Invited!</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f6fb;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(180deg, #f5f6fb 0%, #f5f6fb 100%); padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(157, 78, 221, 0.15), 0 1px 3px rgba(0, 0, 0, 0.08);">
              <tr>
                <td style="background: linear-gradient(135deg, #07c8f9 0%, #9d4edd 50%, #f5267e 100%); padding: 48px 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">You're Invited!</h1>
                </td>
              </tr>
              ${event.coverImage ? `
              <tr>
                <td style="padding: 0;">
                  <img
                    src="${event.coverImage}"
                    alt="${event.title}"
                    style="width: 100%; max-height: 300px; object-fit: cover; display: block;"
                  />
                </td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #0a0f2c; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    ${guestName ? `Hi ${guestName},` : 'Hello,'}
                  </p>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                    ${hostName || 'Someone'} has invited you to:
                  </p>

                  <div style="background: linear-gradient(135deg, rgba(7,200,249,0.08) 0%, rgba(157,78,221,0.08) 100%); border-radius: 12px; padding: 24px; margin-bottom: 30px; border: 1px solid rgba(157,78,221,0.15);">
                    <h2 style="color: #0a0f2c; font-size: 22px; margin: 0 0 16px; font-weight: 700;">${event.title}</h2>
                    <p style="color: #4b5563; font-size: 14px; margin: 0 0 8px;">
                      <strong style="color: #9d4edd;">When:</strong> ${formatDateTime(event.date)}
                    </p>
                    ${event.location ? `<p style="color: #4b5563; font-size: 14px; margin: 0 0 8px;"><strong style="color: #9d4edd;">Where:</strong> ${event.location}</p>` : ''}
                    ${event.description ? `<p style="color: #4b5563; font-size: 14px; margin: 16px 0 0; line-height: 1.5;">${event.description}</p>` : ''}
                  </div>

                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding: 8px;">
                        <a href="${appUrl}/api/rsvp/${rsvpToken}/quick?status=ATTENDING"
                           style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                                  color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px;
                                  font-size: 16px; font-weight: 600;">
                          Yes, I'll be there!
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding: 8px;">
                        <a href="${appUrl}/api/rsvp/${rsvpToken}/quick?status=MAYBE"
                           style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                                  color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px;
                                  font-size: 16px; font-weight: 600;">
                          Maybe
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding: 8px;">
                        <a href="${appUrl}/api/rsvp/${rsvpToken}/quick?status=NOT_ATTENDING"
                           style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                                  color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px;
                                  font-size: 16px; font-weight: 600;">
                          Can't make it
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="color: #6b7280; font-size: 12px; text-align: center; margin: 16px 0 0;">
                    <a href="${rsvpLink}" style="color: #9d4edd;">
                      Need to add guests or dietary notes? Click here for full form
                    </a>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background: linear-gradient(135deg, rgba(7,200,249,0.05) 0%, rgba(157,78,221,0.05) 100%); padding: 20px 30px; text-align: center; border-top: 1px solid rgba(157,78,221,0.1);">
                  <p style="color: #9d4edd; font-size: 12px; margin: 0; font-weight: 500;">
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
    from: await getFromAddress(),
    to,
    replyTo: replyTo || undefined,
    subject: `You're invited to ${event.title}!`,
    html,
  });
}

interface SendReminderParams {
  to: string;
  guestName?: string | null;
  event: EventDetails;
  rsvpToken: string;
  replyTo?: string | null;
}

export async function sendReminder({
  to,
  guestName,
  event,
  rsvpToken,
  replyTo,
}: SendReminderParams) {
  const transporter = await createTransporter();
  if (!transporter) {
    logger.warn('Email not configured - skipping reminder email', { to });
    throw new Error('Email service not configured. Please set SMTP environment variables.');
  }

  const appUrl = await getAppUrl();
  const rsvpLink = `${appUrl}/rsvp/${rsvpToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reminder: RSVP Needed</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f6fb;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(180deg, #f5f6fb 0%, #fce7f3 100%); padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(245, 38, 126, 0.15), 0 1px 3px rgba(0, 0, 0, 0.08);">
              <tr>
                <td style="background: linear-gradient(135deg, #f5267e 0%, #9d4edd 100%); padding: 48px 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Reminder: RSVP Needed</h1>
                </td>
              </tr>
              ${event.coverImage ? `
              <tr>
                <td style="padding: 0;">
                  <img
                    src="${event.coverImage}"
                    alt="${event.title}"
                    style="width: 100%; max-height: 300px; object-fit: cover; display: block;"
                  />
                </td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #0a0f2c; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    ${guestName ? `Hi ${guestName},` : 'Hello,'}
                  </p>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                    This is a friendly reminder that you haven't responded to the invitation for:
                  </p>

                  <div style="background: linear-gradient(135deg, rgba(245,38,126,0.08) 0%, rgba(157,78,221,0.08) 100%); border-radius: 12px; padding: 24px; margin-bottom: 30px; border: 1px solid rgba(245,38,126,0.15);">
                    <h2 style="color: #0a0f2c; font-size: 22px; margin: 0 0 16px; font-weight: 700;">${event.title}</h2>
                    <p style="color: #4b5563; font-size: 14px; margin: 0;">
                      <strong style="color: #f5267e;">When:</strong> ${formatDateTime(event.date)}
                    </p>
                    ${event.location ? `<p style="color: #4b5563; font-size: 14px; margin: 8px 0 0;"><strong style="color: #f5267e;">Where:</strong> ${event.location}</p>` : ''}
                  </div>

                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding: 8px;">
                        <a href="${appUrl}/api/rsvp/${rsvpToken}/quick?status=ATTENDING"
                           style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                                  color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px;
                                  font-size: 16px; font-weight: 600;">
                          Yes, I'll be there!
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding: 8px;">
                        <a href="${appUrl}/api/rsvp/${rsvpToken}/quick?status=MAYBE"
                           style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                                  color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px;
                                  font-size: 16px; font-weight: 600;">
                          Maybe
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding: 8px;">
                        <a href="${appUrl}/api/rsvp/${rsvpToken}/quick?status=NOT_ATTENDING"
                           style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                                  color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px;
                                  font-size: 16px; font-weight: 600;">
                          Can't make it
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="color: #6b7280; font-size: 12px; text-align: center; margin: 16px 0 0;">
                    <a href="${rsvpLink}" style="color: #9d4edd;">
                      Need to add guests or dietary notes? Click here for full form
                    </a>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background: linear-gradient(135deg, rgba(245,38,126,0.05) 0%, rgba(157,78,221,0.05) 100%); padding: 20px 30px; text-align: center; border-top: 1px solid rgba(245,38,126,0.1);">
                  <p style="color: #9d4edd; font-size: 12px; margin: 0; font-weight: 500;">
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
    from: await getFromAddress(),
    to,
    replyTo: replyTo || undefined,
    subject: `Reminder: Please RSVP for ${event.title}`,
    html,
  });
}

interface SendConfirmationParams {
  to: string;
  guestName?: string | null;
  event: EventDetails;
  status: string;
  rsvpToken?: string;
  replyTo?: string | null;
}

export async function sendConfirmation({
  to,
  guestName,
  event,
  status,
  rsvpToken,
  replyTo,
}: SendConfirmationParams) {
  const transporter = await createTransporter();
  if (!transporter) {
    logger.warn('Email not configured - skipping confirmation email', { to });
    throw new Error('Email service not configured. Please set SMTP environment variables.');
  }

  const appUrl = await getAppUrl();

  const statusMessages: Record<string, string> = {
    ATTENDING: "We're excited to see you there!",
    NOT_ATTENDING: "We're sorry you can't make it. Maybe next time!",
    MAYBE: "Thanks for letting us know. We hope you can make it!",
    PENDING: "Thanks for your response!",
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>RSVP Confirmation</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f6fb;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(180deg, #e8fbff 0%, #f5f6fb 100%); padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(7, 200, 249, 0.15), 0 1px 3px rgba(0, 0, 0, 0.08);">
              <tr>
                <td style="background: linear-gradient(135deg, #07c8f9 0%, #9d4edd 100%); padding: 48px 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">RSVP Confirmed</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #0a0f2c; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    ${guestName ? `Hi ${guestName},` : 'Hello,'}
                  </p>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                    Your response for <strong style="color: #9d4edd;">${event.title}</strong> has been recorded.
                  </p>

                  <p style="color: #0a0f2c; font-size: 18px; line-height: 1.6; margin: 0 0 30px; text-align: center; font-weight: 600;">
                    ${statusMessages[status]}
                  </p>

                  ${status === 'ATTENDING' ? `
                  <div style="background: linear-gradient(135deg, rgba(7,200,249,0.08) 0%, rgba(157,78,221,0.08) 100%); border-radius: 12px; padding: 24px; margin-bottom: 30px; border: 1px solid rgba(7,200,249,0.15);">
                    <h3 style="color: #0a0f2c; font-size: 16px; margin: 0 0 12px; font-weight: 700;">Event Details</h3>
                    <p style="color: #4b5563; font-size: 14px; margin: 0 0 8px;">
                      <strong style="color: #07c8f9;">When:</strong> ${formatDateTime(event.date)}
                    </p>
                    ${event.location ? `<p style="color: #4b5563; font-size: 14px; margin: 0;"><strong style="color: #07c8f9;">Where:</strong> ${event.location}</p>` : ''}
                  </div>
                  ` : ''}

                  ${rsvpToken ? `
                  <div style="text-align: center; margin-top: 30px; padding-top: 30px; border-top: 1px solid rgba(157,78,221,0.15);">
                    <a href="${appUrl}/rsvp/${rsvpToken}/edit"
                       style="display: inline-block; background: linear-gradient(135deg, #9d4edd 0%, #f5267e 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 14px rgba(157, 78, 221, 0.3);">
                      Edit Your RSVP
                    </a>
                    <p style="color: #6b7280; font-size: 12px; margin: 12px 0 0;">
                      Need to make changes? Use the link above to update your response.
                    </p>
                  </div>
                  ` : ''}
                </td>
              </tr>
              <tr>
                <td style="background: linear-gradient(135deg, rgba(7,200,249,0.05) 0%, rgba(157,78,221,0.05) 100%); padding: 20px 30px; text-align: center; border-top: 1px solid rgba(157,78,221,0.1);">
                  <p style="color: #9d4edd; font-size: 12px; margin: 0; font-weight: 500;">
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
    from: await getFromAddress(),
    to,
    replyTo: replyTo || undefined,
    subject: `RSVP Confirmed for ${event.title}`,
    html,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  userName: string
) {
  const transporter = await createTransporter();
  if (!transporter) {
    logger.warn('Email not configured - skipping password reset email', { to });
    throw new Error('Email service not configured. Please set SMTP environment variables.');
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f6fb;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(180deg, #f5f6fb 0%, #f5f6fb 100%); padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(157, 78, 221, 0.15), 0 1px 3px rgba(0, 0, 0, 0.08);">
              <tr>
                <td style="background: linear-gradient(135deg, #9d4edd 0%, #f5267e 100%); padding: 48px 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Reset Your Password</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #0a0f2c; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    Hi ${userName},
                  </p>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                    We received a request to reset your password. Click the button below to create a new password:
                  </p>

                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #9d4edd 0%, #f5267e 100%); color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(157, 78, 221, 0.4);">
                      Reset Password
                    </a>
                  </div>

                  <div style="background: linear-gradient(135deg, rgba(157,78,221,0.08) 0%, rgba(245,38,126,0.08) 100%); border-radius: 12px; padding: 16px 20px; margin: 20px 0; border: 1px solid rgba(157,78,221,0.15);">
                    <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0;">
                      This link will expire in <strong style="color: #9d4edd;">1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.
                    </p>
                  </div>

                  <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 30px 0 0; line-height: 1.5;">
                    If the button doesn't work, copy and paste this link:<br>
                    <a href="${resetUrl}" style="color: #9d4edd;">${resetUrl}</a>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background: linear-gradient(135deg, rgba(157,78,221,0.05) 0%, rgba(245,38,126,0.05) 100%); padding: 20px 30px; text-align: center; border-top: 1px solid rgba(157,78,221,0.1);">
                  <p style="color: #9d4edd; font-size: 12px; margin: 0; font-weight: 500;">
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
    from: await getFromAddress(),
    to,
    subject: 'Reset Your Password',
    html,
  });
}

interface SendBroadcastEmailParams {
  to: string;
  guestName?: string | null;
  subject: string;
  message: string;
  eventTitle: string;
  replyTo?: string | null;
}

export async function sendBroadcastEmail({
  to,
  guestName,
  subject,
  message,
  eventTitle,
  replyTo,
}: SendBroadcastEmailParams) {
  const transporter = await createTransporter();
  if (!transporter) {
    logger.warn('Email not configured - skipping broadcast email', { to });
    throw new Error('Email service not configured. Please set SMTP environment variables.');
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f6fb;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(180deg, #f5f6fb 0%, #f5f6fb 100%); padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(157, 78, 221, 0.15), 0 1px 3px rgba(0, 0, 0, 0.08);">
              <tr>
                <td style="background: linear-gradient(135deg, #07c8f9 0%, #9d4edd 50%, #f5267e 100%); padding: 48px 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">${eventTitle}</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0; font-size: 16px; font-weight: 500;">Update from the host</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #0a0f2c; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    ${guestName ? `Hi ${guestName},` : 'Hello,'}
                  </p>

                  <div style="background: linear-gradient(135deg, rgba(7,200,249,0.08) 0%, rgba(157,78,221,0.08) 100%); border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid rgba(157,78,221,0.15);">
                    <h2 style="color: #0a0f2c; font-size: 18px; margin: 0 0 16px; font-weight: 700;">${subject}</h2>
                    <p style="color: #4b5563; font-size: 14px; margin: 0; line-height: 1.6; white-space: pre-wrap;">${message}</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background: linear-gradient(135deg, rgba(7,200,249,0.05) 0%, rgba(157,78,221,0.05) 100%); padding: 20px 30px; text-align: center; border-top: 1px solid rgba(157,78,221,0.1);">
                  <p style="color: #9d4edd; font-size: 12px; margin: 0; font-weight: 500;">
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
    from: await getFromAddress(),
    to,
    replyTo: replyTo || undefined,
    subject: `[${eventTitle}] ${subject}`,
    html,
  });
}

interface SendUserInvitationEmailParams {
  to: string;
  invitationUrl: string;
  invitedByName?: string | null;
  role?: string;
}

export async function sendUserInvitationEmail({
  to,
  invitationUrl,
  invitedByName,
  role = 'USER',
}: SendUserInvitationEmailParams) {
  const transporter = await createTransporter();
  if (!transporter) {
    logger.warn('Email not configured - skipping user invitation email', { to });
    throw new Error('Email service not configured. Please set SMTP environment variables.');
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>You've Been Invited to OwnRSVP</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f6fb;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(180deg, #f5f6fb 0%, #f5f6fb 100%); padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(157, 78, 221, 0.15), 0 1px 3px rgba(0, 0, 0, 0.08);">
              <tr>
                <td style="background: linear-gradient(135deg, #07c8f9 0%, #9d4edd 50%, #f5267e 100%); padding: 48px 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">You've Been Invited!</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0; font-size: 16px; font-weight: 500;">Join OwnRSVP</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #0a0f2c; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    Hello,
                  </p>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    ${invitedByName ? `${invitedByName} has` : 'You have been'} invited to join OwnRSVP, a self-hosted event management platform.
                  </p>

                  <div style="background: linear-gradient(135deg, rgba(7,200,249,0.08) 0%, rgba(157,78,221,0.08) 100%); border-radius: 12px; padding: 24px; margin-bottom: 30px; border: 1px solid rgba(157,78,221,0.15);">
                    <p style="color: #0a0f2c; font-size: 14px; margin: 0 0 12px; font-weight: 700;">Your Account Details:</p>
                    <p style="color: #4b5563; font-size: 14px; margin: 0 0 8px;">
                      <strong style="color: #9d4edd;">Email:</strong> ${to}
                    </p>
                    <p style="color: #4b5563; font-size: 14px; margin: 0;">
                      <strong style="color: #9d4edd;">Role:</strong> ${role === 'ADMIN' ? 'Administrator' : 'User'}
                    </p>
                  </div>

                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                    Click the button below to accept your invitation and set up your account. You'll be able to create your username and password.
                  </p>

                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${invitationUrl}" style="display: inline-block; background: linear-gradient(135deg, #07c8f9 0%, #9d4edd 100%); color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(157, 78, 221, 0.4);">
                      Accept Invitation
                    </a>
                  </div>

                  <div style="background: linear-gradient(135deg, rgba(157,78,221,0.08) 0%, rgba(245,38,126,0.08) 100%); border-radius: 12px; padding: 16px 20px; margin: 20px 0; border: 1px solid rgba(157,78,221,0.15);">
                    <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0;">
                      This invitation link will expire in <strong style="color: #9d4edd;">7 days</strong>. If you didn't expect this invitation, you can safely ignore this email.
                    </p>
                  </div>

                  <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 30px 0 0; line-height: 1.5;">
                    If the button doesn't work, copy and paste this link:<br>
                    <a href="${invitationUrl}" style="color: #9d4edd;">${invitationUrl}</a>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background: linear-gradient(135deg, rgba(7,200,249,0.05) 0%, rgba(157,78,221,0.05) 100%); padding: 20px 30px; text-align: center; border-top: 1px solid rgba(157,78,221,0.1);">
                  <p style="color: #9d4edd; font-size: 12px; margin: 0; font-weight: 500;">
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
    from: await getFromAddress(),
    to,
    subject: 'You\'ve Been Invited to OwnRSVP',
    html,
  });
}

interface SendEventChangeEmailParams {
  to: string;
  guestName?: string | null;
  eventTitle: string;
  changes: { field: string; oldValue: string; newValue: string }[];
  rsvpToken: string;
  replyTo?: string | null;
}

export async function sendEventChangeEmail({
  to,
  guestName,
  eventTitle,
  changes,
  rsvpToken,
  replyTo,
}: SendEventChangeEmailParams) {
  const transporter = await createTransporter();
  if (!transporter) {
    logger.warn('Email not configured - skipping event change email', { to });
    throw new Error('Email service not configured. Please set SMTP environment variables.');
  }

  const appUrl = await getAppUrl();
  const rsvpLink = `${appUrl}/rsvp/${rsvpToken}`;

  const changesList = changes
    .map((c) => `<li style="margin: 8px 0;"><strong>${c.field}:</strong> ${c.oldValue} → ${c.newValue}</li>`)
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Event Update: ${eventTitle}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f6fb;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(180deg, #f5f6fb 0%, #fff5e6 100%); padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(245, 158, 11, 0.15), 0 1px 3px rgba(0, 0, 0, 0.08);">
              <tr>
                <td style="background: linear-gradient(135deg, #f59e0b 0%, #9d4edd 100%); padding: 48px 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Event Updated</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0; font-size: 16px; font-weight: 500;">${eventTitle}</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #0a0f2c; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    ${guestName ? `Hi ${guestName},` : 'Hello,'}
                  </p>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                    The event details have been updated. Here's what changed:
                  </p>

                  <div style="background: linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(157,78,221,0.08) 100%); border-radius: 12px; padding: 24px; margin-bottom: 30px; border: 1px solid rgba(245,158,11,0.15);">
                    <ul style="color: #4b5563; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.8;">
                      ${changesList}
                    </ul>
                  </div>

                  <div style="text-align: center;">
                    <a href="${rsvpLink}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #9d4edd 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(157, 78, 221, 0.3);">
                      View Event Details
                    </a>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background: linear-gradient(135deg, rgba(245,158,11,0.05) 0%, rgba(157,78,221,0.05) 100%); padding: 20px 30px; text-align: center; border-top: 1px solid rgba(157,78,221,0.1);">
                  <p style="color: #9d4edd; font-size: 12px; margin: 0; font-weight: 500;">
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
    from: await getFromAddress(),
    to,
    replyTo: replyTo || undefined,
    subject: `Event Update: ${eventTitle}`,
    html,
  });
}

interface SendRsvpChangeNotificationParams {
  to: string;
  hostName?: string | null;
  event: EventDetails;
  guest: {
    name: string | null;
    email: string;
    status: string;
    additionalGuests?: Array<{ name: string }>;
    dietaryNotes?: string | null;
  };
  changeType: 'NEW' | 'UPDATED' | 'STATUS_CHANGED';
  previousStatus?: string | null;
  eventUrl: string;
}

export async function sendRsvpChangeNotification({
  to,
  hostName,
  event,
  guest,
  changeType,
  previousStatus,
  eventUrl,
}: SendRsvpChangeNotificationParams) {
  const transporter = await createTransporter();
  if (!transporter) {
    logger.warn('Email not configured - skipping RSVP change notification', { to });
    return;
  }

  const statusLabels: Record<string, string> = {
    ATTENDING: 'Attending',
    NOT_ATTENDING: 'Not Attending',
    MAYBE: 'Maybe',
    PENDING: 'Pending',
  };

  const statusColors: Record<string, string> = {
    ATTENDING: '#10b981',
    NOT_ATTENDING: '#ef4444',
    MAYBE: '#f59e0b',
    PENDING: '#6b7280',
  };

  const changeTypeLabels = {
    NEW: 'New RSVP',
    UPDATED: 'RSVP Updated',
    STATUS_CHANGED: 'RSVP Status Changed',
  };

  const changeTypeColors = {
    NEW: '#07c8f9',
    UPDATED: '#f59e0b',
    STATUS_CHANGED: '#6366f1',
  };

  const guestName = guest.name || guest.email.split('@')[0];
  const currentStatusLabel = statusLabels[guest.status] || guest.status;
  const currentStatusColor = statusColors[guest.status] || '#6b7280';

  let statusChangeInfo = '';
  if (changeType === 'STATUS_CHANGED' && previousStatus) {
    const prevStatusLabel = statusLabels[previousStatus] || previousStatus;
    statusChangeInfo = `
      <div style="background: linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(157,78,221,0.1) 100%); border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 12px 12px 0; margin: 20px 0;">
        <p style="margin: 0; color: #0a0f2c; font-size: 14px; font-weight: 600;">
          Status Changed: <span style="color: #9d4edd;">${prevStatusLabel}</span> → <span style="color: #9d4edd;">${currentStatusLabel}</span>
        </p>
      </div>
    `;
  }

  const additionalGuestsHtml = guest.additionalGuests && guest.additionalGuests.length > 0
    ? `
      <div style="background: linear-gradient(135deg, rgba(7,200,249,0.06) 0%, rgba(157,78,221,0.06) 100%); padding: 16px; border-radius: 12px; margin: 20px 0; border: 1px solid rgba(157,78,221,0.1);">
        <p style="margin: 0 0 8px 0; color: #0a0f2c; font-size: 14px; font-weight: 600;">Additional Guests:</p>
        <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px;">
          ${guest.additionalGuests.map(ag => `<li>${ag.name}</li>`).join('')}
        </ul>
      </div>
    `
    : '';

  const dietaryNotesHtml = guest.dietaryNotes
    ? `
      <div style="background: linear-gradient(135deg, rgba(7,200,249,0.06) 0%, rgba(157,78,221,0.06) 100%); padding: 16px; border-radius: 12px; margin: 20px 0; border: 1px solid rgba(157,78,221,0.1);">
        <p style="margin: 0 0 8px 0; color: #0a0f2c; font-size: 14px; font-weight: 600;">Dietary Notes:</p>
        <p style="margin: 0; color: #4b5563; font-size: 14px;">${guest.dietaryNotes}</p>
      </div>
    `
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${changeTypeLabels[changeType]}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f6fb;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(180deg, #f5f6fb 0%, #f5f6fb 100%); padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(157, 78, 221, 0.15), 0 1px 3px rgba(0, 0, 0, 0.08);">
              <tr>
                <td style="background: linear-gradient(135deg, ${changeTypeColors[changeType]} 0%, #9d4edd 100%); padding: 48px 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">${changeTypeLabels[changeType]}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #0a0f2c; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    ${hostName ? `Hi ${hostName},` : 'Hello,'}
                  </p>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                    ${changeType === 'NEW'
                      ? `A guest has submitted an RSVP for your event.`
                      : changeType === 'STATUS_CHANGED'
                      ? `A guest has updated their RSVP status for your event.`
                      : `A guest has updated their RSVP details for your event.`
                    }
                  </p>

                  <div style="background: linear-gradient(135deg, rgba(7,200,249,0.08) 0%, rgba(157,78,221,0.08) 100%); border-radius: 12px; padding: 24px; margin-bottom: 30px; border: 1px solid rgba(157,78,221,0.15);">
                    <h2 style="color: #0a0f2c; font-size: 22px; margin: 0 0 16px; font-weight: 700;">
                      ${event.title}
                    </h2>
                    <p style="color: #4b5563; font-size: 14px; margin: 0 0 8px;"><strong style="color: #9d4edd;">When:</strong> ${formatDateTime(event.date)}</p>
                    ${event.location ? `<p style="color: #4b5563; font-size: 14px; margin: 0 0 8px;"><strong style="color: #9d4edd;">Where:</strong> ${event.location}</p>` : ''}
                  </div>

                  <div style="background-color: #ffffff; border: 2px solid rgba(157,78,221,0.15); border-radius: 12px; padding: 24px; margin-bottom: 30px;">
                    <h3 style="color: #0a0f2c; font-size: 18px; margin: 0 0 16px; font-weight: 700;">Guest Information</h3>
                    <p style="color: #374151; font-size: 16px; margin: 0 0 8px;"><strong style="color: #9d4edd;">Name:</strong> ${guestName}</p>
                    <p style="color: #374151; font-size: 16px; margin: 0 0 16px;"><strong style="color: #9d4edd;">Email:</strong> ${guest.email}</p>
                    <div style="display: inline-block; background-color: ${currentStatusColor}20; color: ${currentStatusColor}; padding: 6px 12px; border-radius: 12px; font-size: 14px; font-weight: 600;">
                      Status: ${currentStatusLabel}
                    </div>
                    ${statusChangeInfo}
                    ${additionalGuestsHtml}
                    ${dietaryNotesHtml}
                  </div>

                  <div style="text-align: center;">
                    <a href="${eventUrl}" style="display: inline-block; background: linear-gradient(135deg, #07c8f9 0%, #9d4edd 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(157, 78, 221, 0.3);">
                      View Event & Guest List
                    </a>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background: linear-gradient(135deg, rgba(7,200,249,0.05) 0%, rgba(157,78,221,0.05) 100%); padding: 20px 30px; text-align: center; border-top: 1px solid rgba(157,78,221,0.1);">
                  <p style="color: #9d4edd; font-size: 12px; margin: 0; font-weight: 500;">
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
    from: await getFromAddress(),
    to,
    replyTo: guest.email,
    subject: `${changeTypeLabels[changeType]} for ${event.title}`,
    html,
  });
}

/**
 * Get all event hosts (primary host + co-hosts) who have opted in to RSVP change notifications
 */
export async function getEventHostsForNotification(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      host: true,
      coHosts: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!event) {
    return [];
  }

  const hosts: Array<{ id: string; name: string | null; email: string; senderEmail?: string | null }> = [];

  // Add primary host if they have notifications enabled
  if (event.host.notifyOnRsvpChanges) {
    hosts.push({
      id: event.host.id,
      name: event.host.name,
      email: event.host.email,
      senderEmail: (event.host as any).senderEmail || null,
    });
  }

  // Add co-hosts who have notifications enabled
  for (const coHost of event.coHosts) {
    if (coHost.user.notifyOnRsvpChanges) {
      hosts.push({
        id: coHost.user.id,
        name: coHost.user.name,
        email: coHost.user.email,
        senderEmail: (coHost.user as any).senderEmail || null,
      });
    }
  }

  return hosts;
}

