/**
 * Authentication and user validation schemas
 */

import { z } from 'zod';
import { emailSchema, nonEmptyString } from './common';

/**
 * Login credentials
 */
export const loginSchema = z.object({
  email: nonEmptyString, // Can be email or username
  password: nonEmptyString,
});

/**
 * User registration
 */
export const registerSchema = z.object({
  name: nonEmptyString,
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

/**
 * Password reset request
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

/**
 * Password reset with token
 */
export const resetPasswordSchema = z.object({
  token: nonEmptyString,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

/**
 * Password change (requires old password)
 */
export const changePasswordSchema = z.object({
  currentPassword: nonEmptyString,
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

/**
 * User role enum
 */
export const userRoleSchema = z.enum(['user', 'admin']);

/**
 * Update user profile
 */
export const updateProfileSchema = z.object({
  name: nonEmptyString.optional(),
  email: emailSchema.optional(),
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
  image: z.string().url('Invalid image URL').optional().nullable(),
});

/**
 * Create user (admin)
 */
export const createUserSchema = z.object({
  name: nonEmptyString,
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: userRoleSchema.default('user'),
});

/**
 * Update user (admin)
 */
export const updateUserSchema = z.object({
  name: nonEmptyString.optional(),
  email: emailSchema.optional(),
  role: userRoleSchema.optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
});
