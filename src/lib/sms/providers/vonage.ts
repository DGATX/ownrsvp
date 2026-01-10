/**
 * Vonage (formerly Nexmo) SMS Provider
 * 
 * Optional provider for Vonage SMS API.
 */

import type { SmsProvider, SmsProviderConfig, SmsResult } from '../types';

export class VonageProvider implements SmsProvider {
  private apiKey: string | null = null;
  private apiSecret: string | null = null;
  private from: string | null = null;
  private vonageClient: any = null;

  constructor(config: SmsProviderConfig) {
    this.apiKey = config.apiKey || null;
    this.apiSecret = config.apiSecret || null;
    this.from = config.from || null;

    // Dynamically import Vonage SDK only if needed
    if (this.apiKey && this.apiSecret) {
      try {
        // Try to load Vonage SDK (optional dependency)
        const { Vonage } = require('@vonage/server-sdk');
        this.vonageClient = new Vonage({
          apiKey: this.apiKey,
          apiSecret: this.apiSecret,
        });
      } catch (error) {
        console.warn('Vonage SDK not available. Install @vonage/server-sdk to use Vonage provider.');
      }
    }
  }

  getName(): string {
    return 'vonage';
  }

  isConfigured(): boolean {
    return !!(this.vonageClient && this.from);
  }

  async sendSms(to: string, message: string): Promise<SmsResult> {
    if (!this.vonageClient) {
      return {
        sent: false,
        reason: 'VONAGE_SDK_NOT_AVAILABLE',
      };
    }

    if (!this.from) {
      return {
        sent: false,
        reason: 'FROM_NUMBER_REQUIRED',
      };
    }

    try {
      const response = await this.vonageClient.sms.send({
        to,
        from: this.from,
        text: message,
      });

      if (response.messages && response.messages[0].status === '0') {
        return {
          sent: true,
          messageId: response.messages[0]['message-id'],
        };
      } else {
        return {
          sent: false,
          reason: response.messages?.[0]['error-text'] || 'UNKNOWN_ERROR',
        };
      }
    } catch (error) {
      console.error('Vonage SMS error:', error);
      return {
        sent: false,
        reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      };
    }
  }
}

