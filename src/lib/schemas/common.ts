/**
 * Common validation schemas used across the application
 */

import { z } from 'zod';

/**
 * Email validation
 */
export const emailSchema = z.string().email('Invalid email address');

/**
 * Phone number validation (flexible international format)
 */
export const phoneSchema = z.string().regex(
  /^\+?[1-9]\d{1,14}$/,
  'Invalid phone number format. Use international format (e.g., +12345678900)'
).optional().nullable();

/**
 * URL validation
 */
export const urlSchema = z.string().url('Invalid URL format');

/**
 * Date string validation (ISO 8601)
 */
export const dateStringSchema = z.string().datetime('Invalid date format');

/**
 * Pagination parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * ID parameter (UUID format)
 */
export const uuidSchema = z.string().uuid('Invalid ID format');

/**
 * Optional ID parameter
 */
export const optionalUuidSchema = z.string().uuid('Invalid ID format').optional().nullable();

/**
 * Boolean string that can be "true" or "false"
 */
export const booleanStringSchema = z.enum(['true', 'false']).transform(val => val === 'true');

/**
 * Non-empty string validation
 */
export const nonEmptyString = z.string().min(1, 'This field is required').trim();

/**
 * Optional non-empty string (null if empty)
 */
export const optionalString = z.string().trim().nullish().transform(val => val || null);
