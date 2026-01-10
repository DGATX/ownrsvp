/**
 * SMS Provider Types and Interfaces
 * 
 * This module defines the abstraction layer for SMS providers.
 * Twilio is the default and preferred provider.
 */

export interface SmsResult {
  sent: boolean;
  reason?: string;
  messageId?: string;
}

export interface SmsProviderConfig {
  provider: 'twilio' | 'aws-sns' | 'vonage' | 'messagebird' | 'generic';
  // Twilio config
  accountSid?: string;
  authToken?: string;
  phoneNumber?: string;
  // AWS SNS config
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  // Vonage config
  apiKey?: string;
  apiSecret?: string;
  from?: string;
  // MessageBird config
  originator?: string;
  // Generic/Webhook config
  webhookUrl?: string;
  customHeaders?: Record<string, string>;
}

export interface SmsProvider {
  /**
   * Send an SMS message
   * @param to Recipient phone number (E.164 format)
   * @param message Message text
   * @returns Promise resolving to SmsResult
   */
  sendSms(to: string, message: string): Promise<SmsResult>;

  /**
   * Check if the provider is configured and ready to send
   * @returns true if configured, false otherwise
   */
  isConfigured(): boolean;

  /**
   * Get the provider name
   * @returns Provider identifier
   */
  getName(): string;
}

