import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only administrators can perform factory reset' },
        { status: 403 }
      );
    }

    // Delete all data in the correct order to respect foreign key constraints
    logger.info('Starting factory reset...');

    // 1. Delete all events (cascades to guests, comments, co-hosts, updates)
    const deletedEvents = await prisma.event.deleteMany({});
    logger.info(`Deleted ${deletedEvents.count} events`);

    // 2. Delete all user invitations
    const deletedInvitations = await prisma.userInvitation.deleteMany({});
    logger.info(`Deleted ${deletedInvitations.count} user invitations`);

    // 3. Delete all password reset tokens
    const deletedPasswordTokens = await prisma.passwordResetToken.deleteMany({});
    logger.info(`Deleted ${deletedPasswordTokens.count} password reset tokens`);

    // 4. Delete all app configuration
    const deletedConfig = await prisma.appConfig.deleteMany({});
    logger.info(`Deleted ${deletedConfig.count} app config entries`);

    // 5. Delete all OAuth accounts
    const deletedAccounts = await prisma.account.deleteMany({});
    logger.info(`Deleted ${deletedAccounts.count} OAuth accounts`);

    // 6. Delete all sessions
    const deletedSessions = await prisma.session.deleteMany({});
    logger.info(`Deleted ${deletedSessions.count} sessions`);

    // 7. Delete all verification tokens
    const deletedVerificationTokens = await prisma.verificationToken.deleteMany({});
    logger.info(`Deleted ${deletedVerificationTokens.count} verification tokens`);

    // 8. Delete all users (this will cascade to any remaining related data)
    const deletedUsers = await prisma.user.deleteMany({});
    logger.info(`Deleted ${deletedUsers.count} users`);

    logger.info('Factory reset completed - all data deleted');

    return NextResponse.json({
      success: true,
      message: 'Factory reset completed successfully. Please create a new admin account.',
    });
  } catch (error) {
    logger.error('Factory reset error', error);
    return NextResponse.json(
      {
        error: 'Failed to reset to factory defaults',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

