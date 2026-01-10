import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { isValidEmail } from '@/lib/utils';

type UserWithOptionalUsername = {
  id: string;
  name: string | null;
  username?: string | null;
  email: string;
  theme: string | null;
};

const updateProfileSchema = z.object({
  name: z.string().optional().transform((val) => val === '' ? undefined : val),
  username: z.string().min(1, 'Username is required').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores').optional(),
  email: z.string().min(1, 'Email is required').refine((val) => isValidEmail(val), {
    message: 'Invalid email address format',
  }).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  notifyOnRsvpChanges: z.boolean().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, 'Password must be at least 6 characters').optional(),
}).refine((data) => {
  // If one password field is provided, both must be provided
  if (data.currentPassword || data.newPassword) {
    return data.currentPassword && data.newPassword;
  }
  return true;
}, {
  message: 'Both current password and new password are required',
});

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      console.error('Validation error:', parsed.error.errors);
      return NextResponse.json(
        { 
          error: parsed.error.errors[0].message,
          details: parsed.error.errors,
        },
        { status: 400 }
      );
    }

    const updateData: { name?: string; username?: string; email?: string; theme?: string; notifyOnRsvpChanges?: boolean; password?: string } = {};
    if (parsed.data.name) updateData.name = parsed.data.name;
    if (parsed.data.theme) updateData.theme = parsed.data.theme;
    if (parsed.data.notifyOnRsvpChanges !== undefined) updateData.notifyOnRsvpChanges = parsed.data.notifyOnRsvpChanges;
    
    // Handle username change - check for duplicates
    if (parsed.data.username) {
      try {
        const existingUserByUsername = await prisma.user.findUnique({
          where: { username: parsed.data.username },
        });
        
        if (existingUserByUsername && existingUserByUsername.id !== session.user.id) {
          return NextResponse.json(
            { error: 'An account with this username already exists' },
            { status: 400 }
          );
        }
        updateData.username = parsed.data.username;
      } catch (dbError: unknown) {
        const error = dbError as { message?: string; code?: string };
        // If username field doesn't exist in database yet, skip username update
        if (error?.message?.includes('username') || error?.code === 'P2009') {
          console.warn('Username field not found in database, skipping username update. Please run database migration.');
          // Don't add username to updateData
        } else {
          throw dbError;
        }
      }
    }
    
    // Handle email change - check for duplicates and validate format
    if (parsed.data.email) {
      if (!isValidEmail(parsed.data.email)) {
        return NextResponse.json(
          { error: 'Invalid email address format' },
          { status: 400 }
        );
      }
      
      const existingUserByEmail = await prisma.user.findUnique({
        where: { email: parsed.data.email },
      });
      
      if (existingUserByEmail && existingUserByEmail.id !== session.user.id) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 400 }
        );
      }
      updateData.email = parsed.data.email;
    }

    // Handle password change
    if (parsed.data.currentPassword && parsed.data.newPassword) {
      const userWithPassword = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { password: true },
      });

      if (!userWithPassword?.password) {
        return NextResponse.json(
          { error: 'Cannot change password for this account' },
          { status: 400 }
        );
      }

      const isValid = await bcrypt.compare(
        parsed.data.currentPassword,
        userWithPassword.password
      );

      if (!isValid) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 400 }
        );
      }

      updateData.password = await bcrypt.hash(parsed.data.newPassword, 12);
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        username: (user as UserWithOptionalUsername).username || null,
        email: user.email,
        theme: user.theme,
        notifyOnRsvpChanges: (user as any).notifyOnRsvpChanges ?? true,
      },
      passwordChanged: !!updateData.password,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error details:', errorMessage);
    return NextResponse.json(
      { 
        error: 'Failed to update profile',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try to get user with username field, but handle case where it might not exist yet
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          theme: true,
          notifyOnRsvpChanges: true,
        },
      });
    } catch (dbError: unknown) {
      const error = dbError as { message?: string; code?: string };
      // If username field doesn't exist, try without it
      if (error?.message?.includes('username') || error?.code === 'P2009') {
        console.warn('Username field not found in database, fetching without it');
        user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            id: true,
            name: true,
            email: true,
            theme: true,
          },
        });
        // Add null username for compatibility
        if (user) {
          (user as UserWithOptionalUsername).username = null;
        }
      } else {
        throw dbError;
      }
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error details:', errorMessage);
    return NextResponse.json(
      { 
        error: 'Failed to get profile',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
