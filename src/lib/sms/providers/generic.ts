/**
 * Generic/Webhook SMS Provider
 * 
 * Optional provider for custom SMS APIs via webhook.
 */

import type { SmsProvider, SmsProviderConfig, SmsResult } from '../types';
import { logger } from '../../logger';

export class GenericProvider implements SmsProvider {
  private webhookUrl: string | null = null;
  private apiKey: string | null = null;
  private customHeaders: Record<string, string> = {};

  constructor(config: SmsProviderConfig) {
    this.webhookUrl = config.webhookUrl || null;
    this.apiKey = config.apiKey || null;
    this.customHeaders = config.customHeaders || {};
  }

  getName(): string {
    return 'generic';
  }

  isConfigured(): boolean {
    return !!this.webhookUrl;
  }

  async sendSms(to: string, message: string): Promise<SmsResult> {
    if (!this.webhookUrl) {
      return {
        sent: false,
        reason: 'WEBHOOK_URL_NOT_CONFIGURED',
      };
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.customHeaders,
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to,
          message,
          // Include timestamp for webhook verification
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          sent: false,
          reason: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json().catch(() => ({}));

      return {
        sent: true,
        messageId: data.messageId || data.id || undefined,
      };
    } catch (error) {
      logger.error('Generic webhook SMS error', error);
      return {
        sent: false,
        reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      };
    }
  }
}

