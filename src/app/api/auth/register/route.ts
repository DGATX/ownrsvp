import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { sendUserInvitationEmail } from '@/lib/email';
import { isValidEmail } from '@/lib/utils';

const registerSchema = z.object({
  name: z.string().optional(),
  username: z.string().min(1, 'Username is required').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().min(1, 'Email is required').refine((val) => isValidEmail(val), {
    message: 'Invalid email address format',
  }),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  role: z.enum(['ADMIN', 'USER']).optional().default('USER'),
  sendInvitation: z.boolean().optional().default(false),
}).refine((data) => {
  // If not sending invitation, password is required
  if (!data.sendInvitation && !data.password) {
    return false;
  }
  return true;
}, {
  message: 'Password is required when not sending invitation',
  path: ['password'],
});

export async function POST(request: Request) {
  try {
    // Check if user is authenticated and is an admin
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get current user to check role
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (currentUser?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only administrators can create users' },
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

    const { name, username, email, password, role, sendInvitation } = parsed.data;

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email address format' },
        { status: 400 }
      );
    }

    // Check if user already exists by email
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUserByEmail) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existingUserByUsername = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUserByUsername) {
      return NextResponse.json(
        { error: 'An account with this username already exists' },
        { status: 400 }
      );
    }

    // If password is provided, create user with password
    // Otherwise, create user without password and send invitation
    let hashedPassword: string | null = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 12);
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        name: name || null,
        username,
        email,
        password: hashedPassword,
        role,
      },
    });

    // If invitation requested or no password provided, create invitation token and send email
    if (sendInvitation || !password) {
      const token = nanoid(32);
      const expires = new Date();
      expires.setDate(expires.getDate() + 7); // 7 days expiry

      await prisma.userInvitation.create({
        data: {
          email,
          token,
          userId: user.id,
          expires,
          invitedBy: session.user.id,
        },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const invitationUrl = `${appUrl}/invite/${token}`;

      // Get admin name for email
      const adminUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true },
      });

      // Send invitation email (don't await to avoid blocking)
      sendUserInvitationEmail({
        to: email,
        invitationUrl,
        invitedByName: adminUser?.name || null,
        role,
      }).catch((error) => {
        console.error('Failed to send invitation email:', error);
      });

      return NextResponse.json({
        message: 'User created and invitation sent successfully',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        invitationSent: true,
      });
    }

    return NextResponse.json({
      message: 'User created successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'An error occurred during registration' },
      { status: 500 }
    );
  }
}

