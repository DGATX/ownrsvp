/**
 * Twilio SMS Provider
 * 
 * This is the default and preferred SMS provider.
 * Optimized implementation using Twilio SDK.
 */

import twilio from 'twilio';
import type { SmsProvider, SmsProviderConfig, SmsResult } from '../types';
import { logger } from '../../logger';

// Helper to format phone numbers to E.164 format
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

export class TwilioProvider implements SmsProvider {
  private client: twilio.Twilio | null = null;
  private fromNumber: string | null = null;

  constructor(config: SmsProviderConfig) {
    if (config.accountSid && config.authToken) {
      this.client = twilio(config.accountSid, config.authToken);
    }
    this.fromNumber = config.phoneNumber || null;
  }

  getName(): string {
    return 'twilio';
  }

  isConfigured(): boolean {
    return !!(this.client && this.fromNumber);
  }

  async sendSms(to: string, message: string): Promise<SmsResult> {
    if (!this.client || !this.fromNumber) {
      return {
        sent: false,
        reason: 'SMS_NOT_CONFIGURED',
      };
    }

    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formatPhoneNumber(to),
      });

      return {
        sent: true,
        messageId: result.sid,
      };
    } catch (error) {
      logger.error('Twilio SMS error', error);
      return {
        sent: false,
        reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      };
    }
  }
}

