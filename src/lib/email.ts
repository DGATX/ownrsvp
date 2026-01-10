import nodemailer from 'nodemailer';
import { formatDateTime } from './utils';
import { validateSmtpConfig, isEmailConfigured } from './env-validation';
import { getEmailConfig } from './config';
import { prisma } from './prisma';

// Helper to get "from" address
async function getFromAddress(): Promise<string> {
  const config = await getEmailConfig();
  return config?.from || process.env.SMTP_FROM || process.env.SMTP_USER || config?.user || '';
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
    console.error('Error creating transporter from config:', error);
  }

  // Fallback to environment variables
  const smtpConfig = await validateSmtpConfig();
  if (smtpConfig.warnings.length > 0) {
    console.warn('SMTP Configuration warnings:', smtpConfig.warnings);
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
}

interface SendInvitationParams {
  to: string;
  guestName?: string | null;
  event: EventDetails;
  rsvpToken: string;
  hostName?: string | null;
}

export async function sendInvitation({
  to,
  guestName,
  event,
  rsvpToken,
  hostName,
}: SendInvitationParams) {
  const transporter = await createTransporter();
  if (!transporter) {
    console.warn('Email not configured - skipping invitation email to', to);
    throw new Error('Email service not configured. Please set SMTP environment variables.');
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const rsvpLink = `${appUrl}/rsvp/${rsvpToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>You're Invited!</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">You're Invited!</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    ${guestName ? `Hi ${guestName},` : 'Hello,'}
                  </p>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                    ${hostName || 'Someone'} has invited you to:
                  </p>
                  
                  <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 30px;">
                    <h2 style="color: #111827; font-size: 22px; margin: 0 0 16px; font-weight: 600;">${event.title}</h2>
                    <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px;">
                      <strong>When:</strong> ${formatDateTime(event.date)}
                    </p>
                    ${event.location ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 8px;"><strong>Where:</strong> ${event.location}</p>` : ''}
                    ${event.description ? `<p style="color: #6b7280; font-size: 14px; margin: 16px 0 0; line-height: 1.5;">${event.description}</p>` : ''}
                  </div>
                  
                  <div style="text-align: center;">
                    <a href="${rsvpLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Respond to Invitation
                    </a>
                  </div>
                  
                  <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 30px 0 0; line-height: 1.5;">
                    If the button doesn't work, copy and paste this link:<br>
                    <a href="${rsvpLink}" style="color: #667eea;">${rsvpLink}</a>
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
    from: await getFromAddress(),
    to,
    subject: `You're invited to ${event.title}!`,
    html,
  });
}

interface SendReminderParams {
  to: string;
  guestName?: string | null;
  event: EventDetails;
  rsvpToken: string;
}

export async function sendReminder({
  to,
  guestName,
  event,
  rsvpToken,
}: SendReminderParams) {
  const transporter = await createTransporter();
  if (!transporter) {
    console.warn('Email not configured - skipping reminder email to', to);
    throw new Error('Email service not configured. Please set SMTP environment variables.');
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const rsvpLink = `${appUrl}/rsvp/${rsvpToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reminder: RSVP Needed</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Reminder: RSVP Needed</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    ${guestName ? `Hi ${guestName},` : 'Hello,'}
                  </p>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                    This is a friendly reminder that you haven't responded to the invitation for:
                  </p>
                  
                  <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 30px;">
                    <h2 style="color: #111827; font-size: 22px; margin: 0 0 16px; font-weight: 600;">${event.title}</h2>
                    <p style="color: #6b7280; font-size: 14px; margin: 0;">
                      <strong>When:</strong> ${formatDateTime(event.date)}
                    </p>
                    ${event.location ? `<p style="color: #6b7280; font-size: 14px; margin: 8px 0 0;"><strong>Where:</strong> ${event.location}</p>` : ''}
                  </div>
                  
                  <div style="text-align: center;">
                    <a href="${rsvpLink}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Respond Now
                    </a>
                  </div>
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
    from: await getFromAddress(),
    to,
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
}

export async function sendConfirmation({
  to,
  guestName,
  event,
  status,
  rsvpToken,
}: SendConfirmationParams) {
  const transporter = await createTransporter();
  if (!transporter) {
    console.warn('Email not configured - skipping confirmation email to', to);
    throw new Error('Email service not configured. Please set SMTP environment variables.');
  }

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
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">RSVP Confirmed</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    ${guestName ? `Hi ${guestName},` : 'Hello,'}
                  </p>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                    Your response for <strong>${event.title}</strong> has been recorded.
                  </p>
                  
                  <p style="color: #374151; font-size: 18px; line-height: 1.6; margin: 0 0 30px; text-align: center; font-weight: 500;">
                    ${statusMessages[status]}
                  </p>
                  
                  ${status === 'ATTENDING' ? `
                  <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 30px;">
                    <h3 style="color: #111827; font-size: 16px; margin: 0 0 12px; font-weight: 600;">Event Details</h3>
                    <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px;">
                      <strong>When:</strong> ${formatDateTime(event.date)}
                    </p>
                    ${event.location ? `<p style="color: #6b7280; font-size: 14px; margin: 0;"><strong>Where:</strong> ${event.location}</p>` : ''}
                  </div>
                  ` : ''}
                  
                  ${rsvpToken ? `
                  <div style="text-align: center; margin-top: 30px; padding-top: 30px; border-top: 1px solid #e5e7eb;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/rsvp/${rsvpToken}/edit" 
                       style="display: inline-block; background-color: #8b5cf6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 14px;">
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
    from: await getFromAddress(),
    to,
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
    console.warn('Email not configured - skipping password reset email to', to);
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
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Reset Your Password</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    Hi ${userName},
                  </p>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                    We received a request to reset your password. Click the button below to create a new password:
                  </p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Reset Password
                    </a>
                  </div>
                  
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
                    This link will expire in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.
                  </p>
                  
                  <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 30px 0 0; line-height: 1.5;">
                    If the button doesn't work, copy and paste this link:<br>
                    <a href="${resetUrl}" style="color: #6366f1;">${resetUrl}</a>
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
}

export async function sendBroadcastEmail({
  to,
  guestName,
  subject,
  message,
  eventTitle,
}: SendBroadcastEmailParams) {
  const transporter = await createTransporter();
  if (!transporter) {
    console.warn('Email not configured - skipping broadcast email to', to);
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
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">${eventTitle}</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">Update from the host</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    ${guestName ? `Hi ${guestName},` : 'Hello,'}
                  </p>
                  
                  <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
                    <h2 style="color: #111827; font-size: 18px; margin: 0 0 16px; font-weight: 600;">${subject}</h2>
                    <p style="color: #4b5563; font-size: 14px; margin: 0; line-height: 1.6; white-space: pre-wrap;">${message}</p>
                  </div>
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
    from: await getFromAddress(),
    to,
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
    console.warn('Email not configured - skipping user invitation email to', to);
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
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">You've Been Invited!</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">Join OwnRSVP</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    Hello,
                  </p>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    ${invitedByName ? `${invitedByName} has` : 'You have been'} invited to join OwnRSVP, a self-hosted event management platform.
                  </p>
                  
                  <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 30px;">
                    <p style="color: #111827; font-size: 14px; margin: 0 0 12px; font-weight: 600;">Your Account Details:</p>
                    <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px;">
                      <strong>Email:</strong> ${to}
                    </p>
                    <p style="color: #6b7280; font-size: 14px; margin: 0;">
                      <strong>Role:</strong> ${role === 'ADMIN' ? 'Administrator' : 'User'}
                    </p>
                  </div>
                  
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                    Click the button below to accept your invitation and set up your account. You'll be able to create your username and password.
                  </p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${invitationUrl}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Accept Invitation
                    </a>
                  </div>
                  
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 20px;">
                    This invitation link will expire in <strong>7 days</strong>. If you didn't expect this invitation, you can safely ignore this email.
                  </p>
                  
                  <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 30px 0 0; line-height: 1.5;">
                    If the button doesn't work, copy and paste this link:<br>
                    <a href="${invitationUrl}" style="color: #8b5cf6;">${invitationUrl}</a>
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
}

export async function sendEventChangeEmail({
  to,
  guestName,
  eventTitle,
  changes,
  rsvpToken,
}: SendEventChangeEmailParams) {
  const transporter = await createTransporter();
  if (!transporter) {
    console.warn('Email not configured - skipping event change email to', to);
    throw new Error('Email service not configured. Please set SMTP environment variables.');
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
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
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Event Updated</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">${eventTitle}</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    ${guestName ? `Hi ${guestName},` : 'Hello,'}
                  </p>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    The event details have been updated. Here's what changed:
                  </p>
                  
                  <div style="background-color: #fef3c7; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
                    <ul style="color: #92400e; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.6;">
                      ${changesList}
                    </ul>
                  </div>
                  
                  <div style="text-align: center;">
                    <a href="${rsvpLink}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      View Event Details
                    </a>
                  </div>
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
    from: await getFromAddress(),
    to,
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
    console.warn('Email not configured - skipping RSVP change notification to', to);
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
    NEW: '#667eea',
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
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">
          Status Changed: ${prevStatusLabel} → ${currentStatusLabel}
        </p>
      </div>
    `;
  }

  const additionalGuestsHtml = guest.additionalGuests && guest.additionalGuests.length > 0
    ? `
      <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0; color: #374151; font-size: 14px; font-weight: 600;">Additional Guests:</p>
        <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px;">
          ${guest.additionalGuests.map(ag => `<li>${ag.name}</li>`).join('')}
        </ul>
      </div>
    `
    : '';

  const dietaryNotesHtml = guest.dietaryNotes
    ? `
      <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0; color: #374151; font-size: 14px; font-weight: 600;">Dietary Notes:</p>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">${guest.dietaryNotes}</p>
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
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="background: linear-gradient(135deg, ${changeTypeColors[changeType]} 0%, ${changeTypeColors[changeType]}dd 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">${changeTypeLabels[changeType]}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
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
                  
                  <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 30px;">
                    <h2 style="color: #111827; font-size: 22px; margin: 0 0 16px; font-weight: 600;">
                      ${event.title}
                    </h2>
                    <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px;"><strong>When:</strong> ${formatDateTime(event.date)}</p>
                    ${event.location ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 8px;"><strong>Where:</strong> ${event.location}</p>` : ''}
                  </div>

                  <div style="background-color: #ffffff; border: 2px solid #e5e7eb; border-radius: 8px; padding: 24px; margin-bottom: 30px;">
                    <h3 style="color: #111827; font-size: 18px; margin: 0 0 16px; font-weight: 600;">Guest Information</h3>
                    <p style="color: #374151; font-size: 16px; margin: 0 0 8px;"><strong>Name:</strong> ${guestName}</p>
                    <p style="color: #374151; font-size: 16px; margin: 0 0 16px;"><strong>Email:</strong> ${guest.email}</p>
                    <div style="display: inline-block; background-color: ${currentStatusColor}20; color: ${currentStatusColor}; padding: 6px 12px; border-radius: 6px; font-size: 14px; font-weight: 600;">
                      Status: ${currentStatusLabel}
                    </div>
                    ${statusChangeInfo}
                    ${additionalGuestsHtml}
                    ${dietaryNotesHtml}
                  </div>
                  
                  <div style="text-align: center;">
                    <a href="${eventUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      View Event & Guest List
                    </a>
                  </div>
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

