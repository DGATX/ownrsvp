import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ token: string }>;
}

const acceptInvitationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  username: z.string().min(1, 'Username is required').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// GET endpoint to verify token validity
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { token } = await params;

    const invitation = await prisma.userInvitation.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            role: true,
            password: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json({ valid: false, error: 'Invalid invitation link' });
    }

    if (new Date() > invitation.expires) {
      return NextResponse.json({ valid: false, error: 'Invitation link has expired' });
    }

    // Check if user already has a password (already accepted)
    if (invitation.user.password) {
      return NextResponse.json({ 
        valid: false, 
        error: 'This invitation has already been accepted',
        alreadyAccepted: true 
      });
    }

    // Check if username is a temporary one (generated during invitation)
    const hasTemporaryUsername = invitation.user.username?.startsWith('invited_') ?? false;

    return NextResponse.json({
      valid: true,
      email: invitation.user.email,
      name: invitation.user.name,
      username: hasTemporaryUsername ? null : invitation.user.username,
      hasTemporaryUsername,
      role: invitation.user.role,
    });
  } catch (error) {
    logger.error('Verify invitation token error', error);
    return NextResponse.json(
      { valid: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}

// POST endpoint to accept invitation and set password/username
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { token } = await params;
    const body = await request.json();
    const parsed = acceptInvitationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, username, password } = parsed.data;

    // Find the invitation
    const invitation = await prisma.userInvitation.findUnique({
      where: { token },
      include: {
        user: true,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation link' },
        { status: 400 }
      );
    }

    // Check if token has expired
    if (new Date() > invitation.expires) {
      // Delete the expired token
      await prisma.userInvitation.delete({
        where: { id: invitation.id },
      });

      return NextResponse.json(
        { error: 'Invitation link has expired. Please contact an administrator for a new invitation.' },
        { status: 400 }
      );
    }

    // Check if user already has a password (already accepted)
    if (invitation.user.password) {
      return NextResponse.json(
        { error: 'This invitation has already been accepted' },
        { status: 400 }
      );
    }

    // Check if username is already taken
    const existingUserByUsername = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUserByUsername && existingUserByUsername.id !== invitation.user.id) {
      return NextResponse.json(
        { error: 'This username is already taken. Please choose a different username.' },
        { status: 400 }
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    logger.info('Updating user with invitation acceptance', {
      userId: invitation.user.id,
      name,
      username,
      oldUsername: invitation.user.username,
    });

    // Update the user's name, username, and password
    const updatedUser = await prisma.user.update({
      where: { id: invitation.user.id },
      data: {
        name,
        username,
        password: hashedPassword,
      },
    });

    logger.info('User updated successfully', {
      userId: updatedUser.id,
      name: updatedUser.name,
      username: updatedUser.username,
    });

    // Delete the used invitation token
    await prisma.userInvitation.delete({
      where: { id: invitation.id },
    });

    return NextResponse.json({
      message: 'Account setup complete! You can now sign in.',
      user: {
        email: invitation.user.email,
        name: updatedUser.name,
        username: updatedUser.username,
      },
    });
  } catch (error) {
    logger.error('Accept invitation error', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

