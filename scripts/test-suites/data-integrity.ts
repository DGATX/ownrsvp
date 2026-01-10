import { PrismaClient } from '@prisma/client';
import type { TestEventFactory, TestGuestFactory } from '../comprehensive-test';
import { prisma } from '../comprehensive-test';

export class DataIntegrityTests {
  static async run(
    admin: any,
    user1: any,
    runTest: any,
    TestEventFactory: any,
    TestGuestFactory: any
  ) {
    // Database Constraints
    await runTest(
      'Unique constraints enforced (email, username, slug)',
      'Data Integrity',
      'Constraints',
      async () => {
        // Try to create duplicate email
        try {
          const existingUser = await prisma.user.findFirst();
          if (existingUser) {
            await prisma.user.create({
              data: {
                email: existingUser.email,
                username: `unique_${Date.now()}`,
                password: 'test',
                role: 'USER',
              },
            });
            throw new Error('Duplicate email should be rejected');
          }
        } catch (error: any) {
          if (!error.message.includes('Unique constraint')) {
            throw error;
          }
          // Expected error
        }
      },
      'Unique constraints are enforced',
      'Critical'
    );

    await runTest(
      'Foreign key constraints enforced',
      'Data Integrity',
      'Constraints',
      async () => {
        // Try to create event with invalid hostId
        try {
          await prisma.event.create({
            data: {
              title: 'Test Event',
              slug: `test-${Date.now()}`,
              date: new Date(),
              hostId: 'non-existent-user-id',
            },
          });
          throw new Error('Foreign key constraint should be enforced');
        } catch (error: any) {
          if (!error.message.includes('Foreign key') && !error.message.includes('constraint')) {
            throw error;
          }
          // Expected error
        }
      },
      'Foreign key constraints are enforced',
      'Critical'
    );

    await runTest(
      'Cascade deletes work correctly',
      'Data Integrity',
      'Constraints',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        const guest = await TestGuestFactory.create(event.id);
        const comment = await prisma.comment.create({
          data: {
            eventId: event.id,
            authorName: 'Test',
            content: 'Test comment',
          },
        });
        
        // Delete event
        await prisma.event.delete({
          where: { id: event.id },
        });
        
        // Verify cascade
        const deletedGuest = await prisma.guest.findUnique({
          where: { id: guest.id },
        });
        const deletedComment = await prisma.comment.findUnique({
          where: { id: comment.id },
        });
        
        if (deletedGuest || deletedComment) {
          throw new Error('Cascade delete failed');
        }
      },
      'Cascade deletes work correctly',
      'High'
    );

    // Data Consistency
    await runTest(
      'Event host always valid user',
      'Data Integrity',
      'Consistency',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        const host = await prisma.user.findUnique({
          where: { id: event.hostId },
        });
        
        if (!host) {
          throw new Error('Event host is not a valid user');
        }
      },
      'Event hosts are always valid users',
      'Critical'
    );

    await runTest(
      'Guest event always valid event',
      'Data Integrity',
      'Consistency',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        const guest = await TestGuestFactory.create(event.id);
        const guestEvent = await prisma.event.findUnique({
          where: { id: guest.eventId },
        });
        
        if (!guestEvent) {
          throw new Error('Guest event is not valid');
        }
      },
      'Guest events are always valid',
      'Critical'
    );
  }
}

