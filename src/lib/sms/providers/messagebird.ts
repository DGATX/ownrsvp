/**
 * MessageBird SMS Provider
 * 
 * Optional provider for MessageBird SMS API.
 */

import type { SmsProvider, SmsProviderConfig, SmsResult } from '../types';

export class MessageBirdProvider implements SmsProvider {
  private apiKey: string | null = null;
  private originator: string | null = null;
  private messagebirdClient: any = null;

  constructor(config: SmsProviderConfig) {
    this.apiKey = config.apiKey || null;
    this.originator = config.originator || null;

    // Dynamically import MessageBird SDK only if needed
    if (this.apiKey) {
      try {
        // Try to load MessageBird SDK (optional dependency)
        const messagebird = require('messagebird');
        this.messagebirdClient = messagebird(this.apiKey);
      } catch (error) {
        console.warn('MessageBird SDK not available. Install messagebird to use MessageBird provider.');
      }
    }
  }

  getName(): string {
    return 'messagebird';
  }

  isConfigured(): boolean {
    return !!(this.messagebirdClient && this.originator);
  }

  async sendSms(to: string, message: string): Promise<SmsResult> {
    if (!this.messagebirdClient) {
      return {
        sent: false,
        reason: 'MESSAGEBIRD_SDK_NOT_AVAILABLE',
      };
    }

    if (!this.originator) {
      return {
        sent: false,
        reason: 'ORIGINATOR_REQUIRED',
      };
    }

    try {
      return new Promise((resolve) => {
        this.messagebirdClient.messages.create(
          {
            originator: this.originator,
            recipients: [to],
            body: message,
          },
          (err: any, response: any) => {
            if (err) {
              console.error('MessageBird SMS error:', err);
              resolve({
                sent: false,
                reason: err.message || 'UNKNOWN_ERROR',
              });
            } else {
              resolve({
                sent: true,
                messageId: response.id,
              });
            }
          }
        );
      });
    } catch (error) {
      console.error('MessageBird SMS error:', error);
      return {
        sent: false,
        reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      };
    }
  }
}

