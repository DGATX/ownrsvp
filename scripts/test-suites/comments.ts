import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';
import type { HTTPClient } from '../comprehensive-test';
import { prisma } from '../comprehensive-test';

export class CommentTests {
  static async run(
    httpClient: HTTPClient,
    admin: any,
    user1: any,
    runTest: any,
    TestEventFactory: any,
    TestGuestFactory: any
  ) {
    // Public Comments
    await runTest(
      'Post comment on public event page',
      'Comments',
      'Public Comments',
      async () => {
        const event = await TestEventFactory.create(user1.id, { isPublic: true });
        const response = await httpClient.post('/api/comments', {
          eventId: event.id,
          authorName: 'Test Commenter',
          content: 'This is a test comment',
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Comment posting failed: ${error.error || response.status}`);
        }
        
        const comments = await prisma.comment.findMany({
          where: { eventId: event.id },
        });
        
        if (comments.length === 0) {
          throw new Error('Comment not created');
        }
      },
      'Comments can be posted on public events',
      'High'
    );

    await runTest(
      'Post comment as guest (linked to guest record)',
      'Comments',
      'Public Comments',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        const guest = await TestGuestFactory.create(event.id);
        
        const response = await httpClient.post('/api/comments', {
          eventId: event.id,
          guestId: guest.id,
          authorName: guest.name || 'Guest',
          content: 'Comment from guest',
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Comment posting failed: ${error.error || response.status}`);
        }
        
        const comment = await prisma.comment.findFirst({
          where: { eventId: event.id, guestId: guest.id },
        });
        
        if (!comment) {
          throw new Error('Comment not linked to guest');
        }
      },
      'Comments can be linked to guests',
      'Medium'
    );

    await runTest(
      'View comments on event page',
      'Comments',
      'Public Comments',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        await prisma.comment.create({
          data: {
            eventId: event.id,
            authorName: 'Test Commenter',
            content: 'Test comment',
          },
        });
        
        const comments = await prisma.comment.findMany({
          where: { eventId: event.id },
          orderBy: { createdAt: 'desc' },
        });
        
        if (comments.length === 0) {
          throw new Error('Comments not found');
        }
      },
      'Comments can be retrieved',
      'High'
    );

    await runTest(
      'Comments require content',
      'Comments',
      'Public Comments',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        const response = await httpClient.post('/api/comments', {
          eventId: event.id,
          authorName: 'Test Commenter',
          content: '', // Empty content
        });
        
        if (response.status === 200) {
          throw new Error('Comment should require content');
        }
      },
      'Comment validation requires content',
      'High'
    );

    await runTest(
      'Comments cascade on event deletion',
      'Comments',
      'Management',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        const comment = await prisma.comment.create({
          data: {
            eventId: event.id,
            authorName: 'Test Commenter',
            content: 'Test comment',
          },
        });
        
        await prisma.event.delete({
          where: { id: event.id },
        });
        
        const deletedComment = await prisma.comment.findUnique({
          where: { id: comment.id },
        });
        
        if (deletedComment) {
          throw new Error('Comment not deleted with event');
        }
      },
      'Comments are deleted with events',
      'High'
    );
  }
}

