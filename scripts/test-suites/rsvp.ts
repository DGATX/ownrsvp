import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';
import type { HTTPClient } from '../comprehensive-test';
import { prisma } from '../comprehensive-test';

export class RSVPTests {
  static async run(
    httpClient: HTTPClient,
    admin: any,
    user1: any,
    runTest: any,
    TestEventFactory: any,
    TestGuestFactory: any
  ) {
    // Public RSVP
    await runTest(
      'Access RSVP page via token',
      'RSVP',
      'Public RSVP',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        const guest = await TestGuestFactory.create(event.id);
        
        const response = await httpClient.get(`/api/rsvp/${guest.token}`);
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`RSVP page access failed: ${error.error || response.status}`);
        }
      },
      'RSVP page accessible via token',
      'High'
    );

    await runTest(
      'Submit RSVP as ATTENDING',
      'RSVP',
      'Public RSVP',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        const guest = await TestGuestFactory.create(event.id, { status: 'PENDING' });
        
        const response = await httpClient.patch(`/api/rsvp/${guest.token}`, {
          name: guest.name || 'Test Guest',
          email: guest.email,
          status: 'ATTENDING',
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`RSVP submission failed: ${error.error || response.status}`);
        }
        
        const updated = await prisma.guest.findUnique({
          where: { id: guest.id },
        });
        
        if (updated?.status !== 'ATTENDING') {
          throw new Error('RSVP status not updated');
        }
      },
      'RSVP can be submitted as ATTENDING',
      'Critical'
    );

    await runTest(
      'Submit RSVP with additional guests',
      'RSVP',
      'Public RSVP',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        const guest = await TestGuestFactory.create(event.id);
        
        const response = await httpClient.patch(`/api/rsvp/${guest.token}`, {
          name: guest.name || 'Test Guest',
          email: guest.email,
          status: 'ATTENDING',
          additionalGuests: ['Plus One 1', 'Plus One 2'],
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`RSVP with additional guests failed: ${error.error || response.status}`);
        }
        
        const updated = await prisma.guest.findUnique({
          where: { id: guest.id },
          include: { additionalGuests: true },
        });
        
        if (!updated || updated.additionalGuests.length !== 2) {
          throw new Error('Additional guests not saved');
        }
      },
      'RSVP can include additional guests',
      'High'
    );

    await runTest(
      'Submit RSVP with dietary notes',
      'RSVP',
      'Public RSVP',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        const guest = await TestGuestFactory.create(event.id);
        const dietaryNotes = 'Vegetarian, no nuts';
        
        const response = await httpClient.patch(`/api/rsvp/${guest.token}`, {
          name: guest.name || 'Test Guest',
          email: guest.email,
          status: 'ATTENDING',
          dietaryNotes,
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`RSVP with dietary notes failed: ${error.error || response.status}`);
        }
        
        const updated = await prisma.guest.findUnique({
          where: { id: guest.id },
        });
        
        if (updated?.dietaryNotes !== dietaryNotes) {
          throw new Error('Dietary notes not saved');
        }
      },
      'RSVP can include dietary notes',
      'Medium'
    );

    await runTest(
      'Cannot RSVP after deadline',
      'RSVP',
      'Public RSVP',
      async () => {
        const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const event = await TestEventFactory.create(user1.id, {
          rsvpDeadline: pastDate,
        });
        const guest = await TestGuestFactory.create(event.id);
        
        const response = await httpClient.patch(`/api/rsvp/${guest.token}`, {
          name: guest.name || 'Test Guest',
          email: guest.email,
          status: 'ATTENDING',
        });
        
        if (response.status === 200) {
          throw new Error('RSVP should be rejected after deadline');
        }
      },
      'RSVP is blocked after deadline',
      'High'
    );

    await runTest(
      'RSVP with invalid token (rejected)',
      'RSVP',
      'Public RSVP',
      async () => {
        const response = await httpClient.patch('/api/rsvp/invalid-token-12345', {
          name: 'Test Guest',
          email: 'test@test.com',
          status: 'ATTENDING',
        });
        
        if (response.status === 200) {
          throw new Error('RSVP should fail with invalid token');
        }
      },
      'Invalid RSVP token is rejected',
      'High'
    );

    // RSVP Editing
    await runTest(
      'Edit RSVP status',
      'RSVP',
      'Editing',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        const guest = await TestGuestFactory.create(event.id, { status: 'ATTENDING' });
        
        const response = await httpClient.patch(`/api/rsvp/${guest.token}`, {
          name: guest.name || 'Test Guest',
          email: guest.email,
          status: 'NOT_ATTENDING',
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`RSVP edit failed: ${error.error || response.status}`);
        }
        
        const updated = await prisma.guest.findUnique({
          where: { id: guest.id },
        });
        
        if (updated?.status !== 'NOT_ATTENDING') {
          throw new Error('RSVP status not updated');
        }
      },
      'RSVP status can be edited',
      'High'
    );

    // RSVP Validation
    await runTest(
      'RSVP requires name',
      'RSVP',
      'Validation',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        const guest = await TestGuestFactory.create(event.id);
        
        const response = await httpClient.patch(`/api/rsvp/${guest.token}`, {
          email: guest.email,
          status: 'ATTENDING',
          // name missing
        });
        
        if (response.status === 200) {
          throw new Error('RSVP should require name');
        }
      },
      'RSVP validation requires name',
      'High'
    );

    await runTest(
      'RSVP requires valid email format',
      'RSVP',
      'Validation',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        const guest = await TestGuestFactory.create(event.id);
        
        const response = await httpClient.patch(`/api/rsvp/${guest.token}`, {
          name: 'Test Guest',
          email: 'invalid-email-format',
          status: 'ATTENDING',
        });
        
        if (response.status === 200) {
          throw new Error('RSVP should require valid email');
        }
      },
      'RSVP validation requires valid email',
      'High'
    );
  }
}

