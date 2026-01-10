/**
 * SMS Provider Factory
 * 
 * Creates and returns the appropriate SMS provider instance.
 * Twilio is the default and preferred provider.
 */

import type { SmsProvider, SmsProviderConfig } from './types';
import { TwilioProvider } from './providers/twilio';
import { AwsSnsProvider } from './providers/aws-sns';
import { VonageProvider } from './providers/vonage';
import { MessageBirdProvider } from './providers/messagebird';
import { GenericProvider } from './providers/generic';

/**
 * Create an SMS provider instance based on configuration
 * 
 * @param config Provider configuration
 * @returns SMS provider instance (defaults to Twilio)
 */
export function createSmsProvider(config: SmsProviderConfig): SmsProvider {
  const providerType = config.provider || 'twilio'; // Default to Twilio

  switch (providerType) {
    case 'twilio':
      return new TwilioProvider(config);

    case 'aws-sns':
      return new AwsSnsProvider(config);

    case 'vonage':
      return new VonageProvider(config);

    case 'messagebird':
      return new MessageBirdProvider(config);

    case 'generic':
      return new GenericProvider(config);

    default:
      // Fallback to Twilio if unknown provider specified
      console.warn(`Unknown SMS provider "${providerType}", defaulting to Twilio`);
      return new TwilioProvider(config);
  }
}

/**
 * Get the default provider (Twilio)
 * This is used when no provider is configured
 */
export function getDefaultProvider(): SmsProvider {
  return new TwilioProvider({
    provider: 'twilio',
  });
}

