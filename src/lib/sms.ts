import { formatDateTime } from './utils';
import { getSmsConfig } from './config';
import { createSmsProvider, getDefaultProvider } from './sms/provider-factory';
import type { SmsProviderConfig } from './sms/types';

// Cache provider instance to avoid recreating it on every call
let cachedProvider: ReturnType<typeof createSmsProvider> | null = null;
let cachedConfig: SmsProviderConfig | null = null;

/**
 * Get SMS provider instance (cached for performance)
 * Defaults to Twilio if no config available
 */
async function getSmsProvider() {
  try {
    const config = await getSmsConfig();
    
    // If config changed, recreate provider
    if (!config) {
      // No config - return default Twilio provider (may not be configured)
      return getDefaultProvider();
    }

    // Check if config changed (simple comparison)
    const configKey = JSON.stringify(config);
    if (cachedProvider && cachedConfig && JSON.stringify(cachedConfig) === configKey) {
      return cachedProvider;
    }

    // Create new provider instance
    cachedProvider = createSmsProvider(config);
    cachedConfig = config;
    return cachedProvider;
  } catch (error) {
    console.error('Error getting SMS provider:', error);
    // Fallback to default Twilio provider
    return getDefaultProvider();
  }
}

// Re-export SmsResult from types for backward compatibility
export type { SmsResult } from './sms/types';

interface EventDetails {
  title: string;
  date: Date;
  location?: string | null;
}

interface SendSmsInvitationParams {
  to: string;
  guestName?: string | null;
  event: EventDetails;
  rsvpToken: string;
  hostName?: string | null;
}

export async function sendSmsInvitation({
  to,
  guestName,
  event,
  rsvpToken,
  hostName,
}: SendSmsInvitationParams): Promise<SmsResult> {
  const provider = await getSmsProvider();
  
  if (!provider.isConfigured()) {
    console.log('SMS not configured - skipping SMS invitation');
    return { sent: false, reason: 'SMS_NOT_CONFIGURED' };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const rsvpLink = `${appUrl}/rsvp/${rsvpToken}`;

  const greeting = guestName ? `Hi ${guestName}!` : 'Hi!';
  const host = hostName ? `${hostName} has` : 'You have been';

  const message = `${greeting} ${host} invited you to ${event.title} on ${formatDateTime(event.date)}${event.location ? ` at ${event.location}` : ''}. RSVP here: ${rsvpLink}`;

  return await provider.sendSms(to, message);
}

interface SendSmsReminderParams {
  to: string;
  guestName?: string | null;
  event: EventDetails;
  rsvpToken: string;
}

export async function sendSmsReminder({
  to,
  guestName,
  event,
  rsvpToken,
}: SendSmsReminderParams): Promise<SmsResult> {
  const provider = await getSmsProvider();
  
  if (!provider.isConfigured()) {
    console.log('SMS not configured - skipping SMS reminder');
    return { sent: false, reason: 'SMS_NOT_CONFIGURED' };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const rsvpLink = `${appUrl}/rsvp/${rsvpToken}`;

  const greeting = guestName ? `Hi ${guestName}!` : 'Hi!';

  const message = `${greeting} Reminder: You haven't responded to ${event.title} on ${formatDateTime(event.date)}. Please RSVP: ${rsvpLink}`;

  return await provider.sendSms(to, message);
}

interface SendSmsConfirmationParams {
  to: string;
  guestName?: string | null;
  event: EventDetails;
  status: string;
}

export async function sendSmsConfirmation({
  to,
  guestName,
  event,
  status,
}: SendSmsConfirmationParams): Promise<SmsResult> {
  const provider = await getSmsProvider();
  
  if (!provider.isConfigured()) {
    console.log('SMS not configured - skipping SMS confirmation');
    return { sent: false, reason: 'SMS_NOT_CONFIGURED' };
  }

  const greeting = guestName ? `Hi ${guestName}!` : 'Hi!';

  const statusMessages: Record<string, string> = {
    ATTENDING: `${greeting} You're confirmed for ${event.title} on ${formatDateTime(event.date)}${event.location ? ` at ${event.location}` : ''}. See you there!`,
    NOT_ATTENDING: `${greeting} Thanks for letting us know you can't make it to ${event.title}. Maybe next time!`,
    MAYBE: `${greeting} Thanks for responding to ${event.title}. We hope you can make it!`,
    PENDING: `${greeting} Thanks for your response to ${event.title}.`,
  };

  return await provider.sendSms(to, statusMessages[status]);
}

// Note: Phone number formatting is now handled by individual providers
// This function is kept for backward compatibility but may not be used
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If it starts with 1 and has 11 digits (US), add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If it has 10 digits (US without country code), add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // Otherwise, assume it's already in proper format or add +
  if (!phone.startsWith('+')) {
    return `+${digits}`;
  }
  
  return phone;
}

// Check if SMS is configured (async version)
export async function isSmsConfigured(): Promise<boolean> {
  const provider = await getSmsProvider();
  return provider.isConfigured();
}

interface SendBroadcastSmsParams {
  to: string;
  guestName?: string | null;
  message: string;
  eventTitle: string;
}

export async function sendBroadcastSms({
  to,
  guestName,
  message,
  eventTitle,
}: SendBroadcastSmsParams): Promise<SmsResult> {
  const provider = await getSmsProvider();
  
  if (!provider.isConfigured()) {
    console.log('SMS not configured - skipping broadcast SMS');
    return { sent: false, reason: 'SMS_NOT_CONFIGURED' };
  }

  const greeting = guestName ? `Hi ${guestName}!` : 'Hi!';
  const smsMessage = `${greeting} Update from ${eventTitle}: ${message}`;

  // Limit message length (SMS max is typically 1600 characters)
  return await provider.sendSms(to, smsMessage.slice(0, 1600));
}

interface SendEventChangeSmsParams {
  to: string;
  guestName?: string | null;
  eventTitle: string;
  changes: string[];
}

export async function sendEventChangeSms({
  to,
  guestName,
  eventTitle,
  changes,
}: SendEventChangeSmsParams): Promise<SmsResult> {
  const provider = await getSmsProvider();
  
  if (!provider.isConfigured()) {
    console.log('SMS not configured - skipping event change SMS');
    return { sent: false, reason: 'SMS_NOT_CONFIGURED' };
  }

  const greeting = guestName ? `Hi ${guestName}!` : 'Hi!';
  const changesText = changes.join(', ');
  const smsMessage = `${greeting} ${eventTitle} has been updated: ${changesText}. Check your email for details.`;

  // Limit message length (SMS max is typically 1600 characters)
  return await provider.sendSms(to, smsMessage.slice(0, 1600));
}

