/**
 * Configuration validation schemas
 */

import { z } from 'zod';
import { emailSchema, nonEmptyString } from './common';

/**
 * Email/SMTP configuration
 */
export const emailConfigSchema = z.object({
  host: nonEmptyString,
  port: z.string().regex(/^\d+$/, 'Port must be a number'),
  user: nonEmptyString,
  password: nonEmptyString,
  from: emailSchema.optional(),
});

/**
 * SMS provider type
 */
export const smsProviderSchema = z.enum(['twilio', 'aws-sns', 'vonage', 'messagebird', 'generic']);

/**
 * Twilio configuration
 */
export const twilioConfigSchema = z.object({
  provider: z.literal('twilio'),
  accountSid: nonEmptyString,
  authToken: nonEmptyString,
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone number format'),
});

/**
 * AWS SNS configuration
 */
export const awsSnsConfigSchema = z.object({
  provider: z.literal('aws-sns'),
  accessKeyId: nonEmptyString,
  secretAccessKey: nonEmptyString,
  region: nonEmptyString,
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
});

/**
 * Vonage configuration
 */
export const vonageConfigSchema = z.object({
  provider: z.literal('vonage'),
  apiKey: nonEmptyString,
  apiSecret: nonEmptyString,
  from: nonEmptyString,
});

/**
 * MessageBird configuration
 */
export const messageBirdConfigSchema = z.object({
  provider: z.literal('messagebird'),
  apiKey: nonEmptyString,
  originator: nonEmptyString,
});

/**
 * Generic webhook configuration
 */
export const genericSmsConfigSchema = z.object({
  provider: z.literal('generic'),
  webhookUrl: z.string().url('Invalid webhook URL'),
  apiKey: nonEmptyString.optional(),
  customHeaders: z.record(z.string()).optional(),
});

/**
 * Combined SMS configuration (discriminated union)
 */
export const smsConfigSchema = z.discriminatedUnion('provider', [
  twilioConfigSchema,
  awsSnsConfigSchema,
  vonageConfigSchema,
  messageBirdConfigSchema,
  genericSmsConfigSchema,
]);

/**
 * Test email request
 */
export const testEmailSchema = z.object({
  to: emailSchema,
});

/**
 * Test SMS request
 */
export const testSmsSchema = z.object({
  to: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone number format'),
});
