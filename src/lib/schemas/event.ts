/**
 * Event validation schemas
 */

import { z } from 'zod';
import { nonEmptyString, optionalString, dateStringSchema, optionalUuidSchema } from './common';

/**
 * Event creation and update
 */
export const eventSchema = z.object({
  title: nonEmptyString,
  date: dateStringSchema,
  location: optionalString,
  description: optionalString,
  image: z.string().url('Invalid image URL').optional().nullable(),
  isPublic: z.boolean().default(false),
  allowComments: z.boolean().default(true),
  requireApproval: z.boolean().default(false),
  maxGuests: z.number().int().positive().optional().nullable(),
  deadline: dateStringSchema.optional().nullable(),
});

/**
 * Partial event update (PATCH)
 */
export const partialEventSchema = eventSchema.partial();

/**
 * Event reminder configuration
 */
export const reminderSchema = z.object({
  enabled: z.boolean(),
  daysBefore: z.number().int().min(1).max(30),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
});

/**
 * Event reminders array
 */
export const remindersArraySchema = z.array(reminderSchema);

/**
 * Broadcast message
 */
export const broadcastSchema = z.object({
  message: nonEmptyString,
  sendEmail: z.boolean().default(true),
  sendSms: z.boolean().default(false),
  filterByStatus: z.enum(['all', 'accepted', 'declined', 'pending']).optional(),
});

/**
 * Co-host management
 */
export const addCoHostSchema = z.object({
  userId: optionalUuidSchema,
  email: z.string().email('Invalid email').optional(),
  canEdit: z.boolean().default(false),
});

/**
 * Update co-host permissions
 */
export const updateCoHostSchema = z.object({
  canEdit: z.boolean(),
});
