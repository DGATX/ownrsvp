import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { isValidEmail } from '@/lib/utils';
import { logger } from '@/lib/logger';

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  username: z
    .string()
    .min(1, 'Username is required')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Username can only contain letters, numbers, and underscores'
    ),
  email: z
    .string()
    .min(1, 'Email is required')
    .refine((val) => isValidEmail(val), {
      message: 'Invalid email address format',
    }),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

/**
 * POST /api/auth/public-register
 *
 * Public registration endpoint that only works when no users exist.
 * The first user to register automatically becomes an admin.
 * This enables one-click Docker deployment without manual database updates.
 */
export async function POST(request: Request) {
  try {
    // Check if any users exist
    const userCount = await prisma.user.count();

    // Only allow public registration if no users exist (first user setup)
    if (userCount > 0) {
      return NextResponse.json(
        { error: 'Registration is disabled. Contact an administrator.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, username, email, password } = parsed.data;

    // Double-check no users exist (race condition protection)
    // Use a transaction to ensure atomicity
    const user = await prisma.$transaction(async (tx) => {
      const currentCount = await tx.user.count();
      if (currentCount > 0) {
        throw new Error('REGISTRATION_CLOSED');
      }

      // Check for existing user by email or username (shouldn't happen, but be safe)
      const existingUser = await tx.user.findFirst({
        where: {
          OR: [{ email }, { username }],
        },
      });

      if (existingUser) {
        throw new Error('USER_EXISTS');
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      // First user gets ADMIN role automatically
      return tx.user.create({
        data: {
          name,
          username,
          email,
          password: hashedPassword,
          role: 'ADMIN',
        },
      });
    });

    logger.info('First admin user created via public registration', {
      userId: user.id,
      email: user.email,
    });

    return NextResponse.json({
      message: 'Admin account created successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'REGISTRATION_CLOSED') {
        return NextResponse.json(
          { error: 'Registration is disabled. Contact an administrator.' },
          { status: 403 }
        );
      }
      if (error.message === 'USER_EXISTS') {
        return NextResponse.json(
          { error: 'An account already exists' },
          { status: 400 }
        );
      }
    }

    logger.error('Public registration error', error);
    return NextResponse.json(
      { error: 'An error occurred during registration' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/public-register
 *
 * Check if public registration is available (no users exist).
 */
export async function GET() {
  try {
    const userCount = await prisma.user.count();
    return NextResponse.json({
      registrationEnabled: userCount === 0,
      message:
        userCount === 0
          ? 'No users exist. Registration is open for first admin.'
          : 'Registration is disabled.',
    });
  } catch (error) {
    logger.error('Error checking registration status', error);
    return NextResponse.json(
      { error: 'Failed to check registration status' },
      { status: 500 }
    );
  }
}
