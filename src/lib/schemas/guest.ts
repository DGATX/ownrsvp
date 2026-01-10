/**
 * Guest validation schemas
 */

import { z } from 'zod';
import { emailSchema, phoneSchema, nonEmptyString, optionalString } from './common';

/**
 * RSVP status enum
 */
export const rsvpStatusSchema = z.enum(['pending', 'accepted', 'declined']);

/**
 * Guest creation
 */
export const guestSchema = z.object({
  name: optionalString,
  email: emailSchema,
  phone: phoneSchema,
  status: rsvpStatusSchema.default('pending'),
  dietaryNotes: optionalString,
  notifyByEmail: z.boolean().default(true),
  notifyBySms: z.boolean().default(false),
  guestLimit: z.number().int().min(1).default(1),
  additionalGuests: z.array(z.object({
    name: nonEmptyString,
  })).optional(),
});

/**
 * Partial guest update (PATCH)
 */
export const partialGuestSchema = guestSchema.partial();

/**
 * RSVP response
 */
export const rsvpResponseSchema = z.object({
  status: rsvpStatusSchema,
  name: optionalString,
  phone: phoneSchema,
  dietaryNotes: optionalString,
  additionalGuests: z.array(z.object({
    name: nonEmptyString,
  })).optional(),
});

/**
 * Bulk guest actions
 */
export const bulkGuestActionSchema = z.object({
  guestIds: z.array(z.string().uuid()),
  action: z.enum(['delete', 'sendInvitation', 'sendReminder']),
});

/**
 * Guest import (CSV)
 */
export const guestImportSchema = z.object({
  guests: z.array(z.object({
    name: optionalString,
    email: emailSchema,
    phone: phoneSchema,
    dietaryNotes: optionalString,
  })),
  sendInvitations: z.boolean().default(false),
});

/**
 * Send RSVP edit link
 */
export const sendEditLinkSchema = z.object({
  email: emailSchema,
});

/**
 * Guest limit update
 */
export const guestLimitSchema = z.object({
  guestLimit: z.number().int().min(1),
});

/**
 * Comment on RSVP
 */
export const commentSchema = z.object({
  content: nonEmptyString,
  guestId: z.string().uuid().optional(),
});
