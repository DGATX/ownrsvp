/**
 * AWS SNS SMS Provider
 * 
 * Optional provider for AWS Simple Notification Service.
 */

import type { SmsProvider, SmsProviderConfig, SmsResult } from '../types';
import { logger } from '../../logger';

export class AwsSnsProvider implements SmsProvider {
  private accessKeyId: string | null = null;
  private secretAccessKey: string | null = null;
  private region: string | null = null;
  private phoneNumber: string | null = null;
  private snsClient: { client: any; PublishCommand: any } | null = null;

  constructor(config: SmsProviderConfig) {
    this.accessKeyId = config.accessKeyId || null;
    this.secretAccessKey = config.secretAccessKey || null;
    this.region = config.region || 'us-east-1';
    this.phoneNumber = config.phoneNumber || null;

    // Dynamically import AWS SDK only if needed
    if (this.accessKeyId && this.secretAccessKey) {
      try {
        // Try to load AWS SDK (optional dependency)
        const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
        this.snsClient = {
          client: new SNSClient({
            region: this.region,
            credentials: {
              accessKeyId: this.accessKeyId,
              secretAccessKey: this.secretAccessKey,
            },
          }),
          PublishCommand,
        };
      } catch (error) {
        logger.warn('AWS SDK not available. Install @aws-sdk/client-sns to use AWS SNS provider');
      }
    }
  }

  getName(): string {
    return 'aws-sns';
  }

  isConfigured(): boolean {
    return !!(this.snsClient && (this.phoneNumber || this.region));
  }

  async sendSms(to: string, message: string): Promise<SmsResult> {
    if (!this.snsClient) {
      return {
        sent: false,
        reason: 'AWS_SDK_NOT_AVAILABLE',
      };
    }

    if (!this.phoneNumber && !to) {
      return {
        sent: false,
        reason: 'PHONE_NUMBER_REQUIRED',
      };
    }

    try {
      const { PublishCommand } = this.snsClient;
      const command = new PublishCommand({
        PhoneNumber: to,
        Message: message,
      });

      const result = await this.snsClient.client.send(command);

      return {
        sent: true,
        messageId: result.MessageId,
      };
    } catch (error) {
      logger.error('AWS SNS SMS error', error);
      return {
        sent: false,
        reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      };
    }
  }
}

