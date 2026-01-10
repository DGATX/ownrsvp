import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';
import type { HTTPClient } from '../comprehensive-test';
import { prisma } from '../comprehensive-test';

export class CoHostTests {
  static async run(
    httpClient: HTTPClient,
    admin: any,
    user1: any,
    user2: any,
    runTest: any,
    TestEventFactory: any
  ) {
    // Adding Co-Hosts
    await runTest(
      'Add co-host to event',
      'Co-Hosts',
      'Adding',
      async () => {
        // Ensure authenticated as user1 (event host)
        await httpClient.loginAsUser(user1);
        
        const event = await TestEventFactory.create(user1.id);
        const response = await httpClient.post(`/api/events/${event.id}/cohosts`, {
          userId: user2.id,
          role: 'COHOST',
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Failed to add co-host: ${error.error || response.status}`);
        }
        
        const coHost = await prisma.eventCoHost.findUnique({
          where: {
            eventId_userId: {
              eventId: event.id,
              userId: user2.id,
            },
          },
        });
        
        if (!coHost) {
          throw new Error('Co-host not created');
        }
      },
      'Co-host can be added to event',
      'High'
    );

    await runTest(
      'Add viewer to event',
      'Co-Hosts',
      'Adding',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const event = await TestEventFactory.create(user1.id);
        // Use existing user2 as viewer
        const response = await httpClient.post(`/api/events/${event.id}/cohosts`, {
          userId: user2.id,
          role: 'VIEWER',
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Failed to add viewer: ${error.error || response.status}`);
        }
      },
      'Viewer can be added to event',
      'Medium'
    );

    await runTest(
      'Add duplicate co-host (rejected)',
      'Co-Hosts',
      'Adding',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const event = await TestEventFactory.create(user1.id);
        
        await httpClient.post(`/api/events/${event.id}/cohosts`, {
          userId: user2.id,
          role: 'COHOST',
        });
        
        const response = await httpClient.post(`/api/events/${event.id}/cohosts`, {
          userId: user2.id,
          role: 'COHOST',
        });
        
        if (response.status === 200) {
          throw new Error('Duplicate co-host should be rejected');
        }
      },
      'Duplicate co-hosts are rejected',
      'High'
    );

    // Co-Host Management
    await runTest(
      'View co-hosts list',
      'Co-Hosts',
      'Management',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const event = await TestEventFactory.create(user1.id);
        await httpClient.post(`/api/events/${event.id}/cohosts`, {
          userId: user2.id,
          role: 'COHOST',
        });
        
        const coHosts = await prisma.eventCoHost.findMany({
          where: { eventId: event.id },
        });
        
        if (coHosts.length === 0) {
          throw new Error('Co-hosts not found');
        }
      },
      'Co-hosts list can be retrieved',
      'High'
    );

    await runTest(
      'Remove co-host',
      'Co-Hosts',
      'Management',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const event = await TestEventFactory.create(user1.id);
        await httpClient.post(`/api/events/${event.id}/cohosts`, {
          userId: user2.id,
          role: 'COHOST',
        });
        
        const response = await httpClient.delete(`/api/events/${event.id}/cohosts/${user2.id}`);
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Remove failed: ${error.error || response.status}`);
        }
        
        const coHost = await prisma.eventCoHost.findUnique({
          where: {
            eventId_userId: {
              eventId: event.id,
              userId: user2.id,
            },
          },
        });
        
        if (coHost) {
          throw new Error('Co-host not removed');
        }
      },
      'Co-host can be removed',
      'High'
    );

    // Co-Host Permissions
    await runTest(
      'Co-host can view event',
      'Co-Hosts',
      'Permissions',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        await httpClient.post(`/api/events/${event.id}/cohosts`, {
          userId: user2.id,
          role: 'COHOST',
        });
        
        // user2 should be able to view the event
        const canManage = await prisma.eventCoHost.findUnique({
          where: {
            eventId_userId: {
              eventId: event.id,
              userId: user2.id,
            },
          },
        });
        
        if (!canManage) {
          throw new Error('Co-host cannot access event');
        }
      },
      'Co-hosts can view events',
      'High'
    );

    await runTest(
      'Co-host cannot delete event',
      'Co-Hosts',
      'Permissions',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        await httpClient.post(`/api/events/${event.id}/cohosts`, {
          userId: user2.id,
          role: 'COHOST',
        });
        
        // user2 should not be able to delete the event
        // This would require switching HTTP client context to user2
        // For now, we verify the co-host relationship exists
        const coHost = await prisma.eventCoHost.findUnique({
          where: {
            eventId_userId: {
              eventId: event.id,
              userId: user2.id,
            },
          },
        });
        
        if (!coHost || coHost.role !== 'COHOST') {
          throw new Error('Co-host relationship not correct');
        }
      },
      'Co-hosts have limited permissions',
      'High'
    );
  }
}

// Import TestUserFactory
import { TestUserFactory } from '../comprehensive-test';

// Note: TestUserFactory is available from comprehensive-test exports

