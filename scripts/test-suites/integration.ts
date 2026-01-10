import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';
import type { HTTPClient } from '../comprehensive-test';
import { prisma } from '../comprehensive-test';

export class IntegrationTests {
  static async run(
    httpClient: HTTPClient,
    admin: any,
    user1: any,
    user2: any,
    runTest: any,
    TestEventFactory: any,
    TestGuestFactory: any
  ) {
    // Complete Event Lifecycle
    await runTest(
      'Complete event lifecycle',
      'Integration',
      'Event Lifecycle',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        // Create event
        const event = await TestEventFactory.create(user1.id);
        
        // Add guests
        const guest1 = await TestGuestFactory.create(event.id);
        const guest2 = await TestGuestFactory.create(event.id);
        
        // Send invitations (simulated)
        // Update event
        const updateResponse = await httpClient.patch(`/api/events/${event.id}`, {
          title: `Updated ${event.title}`,
        });
        
        if (updateResponse.status !== 200) {
          throw new Error('Event update failed');
        }
        
        // Delete event
        const deleteResponse = await httpClient.delete(`/api/events/${event.id}`);
        
        if (deleteResponse.status !== 200) {
          throw new Error('Event deletion failed');
        }
        
        const deleted = await prisma.event.findUnique({
          where: { id: event.id },
        });
        
        if (deleted) {
          throw new Error('Event not deleted');
        }
      },
      'Complete event lifecycle works',
      'Critical'
    );

    // User Onboarding
    await runTest(
      'User onboarding flow',
      'Integration',
      'User Onboarding',
      async () => {
        // Admin creates user
        const newUserEmail = `onboard_${nanoid(8)}@test.com`;
        await httpClient.post('/api/auth/register', {
          name: 'Onboarded User',
          username: `onboard_${nanoid(8)}`,
          email: newUserEmail,
          role: 'USER',
          sendInvitation: true,
        });
        
        const user = await prisma.user.findUnique({
          where: { email: newUserEmail },
          include: { invitation: true },
        });
        
        if (!user || !user.invitation) {
          throw new Error('User invitation not created');
        }
        
        // User creates event
        const event = await TestEventFactory.create(user.id);
        
        if (!event) {
          throw new Error('User could not create event');
        }
      },
      'User onboarding flow works',
      'High'
    );

    // Multi-User Collaboration
    await runTest(
      'Multi-user collaboration',
      'Integration',
      'Collaboration',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        // User creates event
        const event = await TestEventFactory.create(user1.id);
        
        // User adds co-host
        const coHostResponse = await httpClient.post(`/api/events/${event.id}/cohosts`, {
          userId: user2.id,
          role: 'COHOST',
        });
        
        if (coHostResponse.status !== 200) {
          throw new Error('Failed to add co-host');
        }
        
        // Co-host manages guests (using Prisma directly)
        const guest = await TestGuestFactory.create(event.id);
        
        // Verify co-host can see event
        const coHost = await prisma.eventCoHost.findUnique({
          where: {
            eventId_userId: {
              eventId: event.id,
              userId: user2.id,
            },
          },
        });
        
        if (!coHost) {
          throw new Error('Co-host relationship not created');
        }
      },
      'Multi-user collaboration works',
      'High'
    );

    // RSVP Workflow
    await runTest(
      'RSVP workflow',
      'Integration',
      'RSVP Workflow',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        const guest = await TestGuestFactory.create(event.id, { status: 'PENDING' });
        
        // Guest RSVPs
        await httpClient.patch(`/api/rsvp/${guest.token}`, {
          name: guest.name || 'Test Guest',
          email: guest.email,
          status: 'ATTENDING',
        });
        
        // Verify RSVP
        const updated = await prisma.guest.findUnique({
          where: { id: guest.id },
        });
        
        if (updated?.status !== 'ATTENDING') {
          throw new Error('RSVP not recorded');
        }
        
        // Edit RSVP
        await httpClient.patch(`/api/rsvp/${guest.token}`, {
          name: guest.name || 'Test Guest',
          email: guest.email,
          status: 'NOT_ATTENDING',
        });
        
        const edited = await prisma.guest.findUnique({
          where: { id: guest.id },
        });
        
        if (edited?.status !== 'NOT_ATTENDING') {
          throw new Error('RSVP edit not recorded');
        }
      },
      'RSVP workflow works',
      'High'
    );
  }
}

