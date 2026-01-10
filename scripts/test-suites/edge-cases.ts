import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';
import type { HTTPClient } from '../comprehensive-test';
import { prisma } from '../comprehensive-test';

export class EdgeCaseTests {
  static async run(
    httpClient: HTTPClient,
    admin: any,
    user1: any,
    runTest: any,
    TestEventFactory: any,
    TestGuestFactory: any
  ) {
    // Input Validation
    await runTest(
      'Empty strings rejected where required',
      'Edge Cases',
      'Validation',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const response = await httpClient.post('/api/events', {
          title: '',
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
        
        if (response.status === 200) {
          throw new Error('Empty title should be rejected');
        }
      },
      'Required fields cannot be empty',
      'High'
    );

    await runTest(
      'Invalid email formats rejected',
      'Edge Cases',
      'Validation',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const event = await TestEventFactory.create(user1.id);
        const response = await httpClient.post(`/api/events/${event.id}/guests`, {
          email: 'not-an-email',
          name: 'Test Guest',
          sendInvite: false,
        });
        
        if (response.status === 200) {
          throw new Error('Invalid email should be rejected');
        }
      },
      'Invalid email formats are rejected',
      'High'
    );

    await runTest(
      'Invalid date formats rejected',
      'Edge Cases',
      'Validation',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const response = await httpClient.post('/api/events', {
          title: 'Test Event',
          date: 'not-a-date',
        });
        
        if (response.status === 200) {
          throw new Error('Invalid date should be rejected');
        }
      },
      'Invalid date formats are rejected',
      'High'
    );

    await runTest(
      'Invalid URLs rejected',
      'Edge Cases',
      'Validation',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const response = await httpClient.post('/api/events', {
          title: 'Test Event',
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          photoAlbumUrl: 'not-a-valid-url',
        });
        
        if (response.status === 200) {
          throw new Error('Invalid URL should be rejected');
        }
      },
      'Invalid URLs are rejected',
      'Medium'
    );

    // Error Scenarios
    await runTest(
      '404 for non-existent events',
      'Edge Cases',
      'Error Handling',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const response = await httpClient.get('/api/events/non-existent-id');
        
        if (response.status !== 404) {
          throw new Error(`Expected 404, got ${response.status}`);
        }
      },
      'Non-existent events return 404',
      'High'
    );

    await runTest(
      '401 for unauthorized access',
      'Edge Cases',
      'Error Handling',
      async () => {
        httpClient.clearCookies();
        const response = await httpClient.get('/api/events');
        
        // Accept 401, 403, or redirects (302/307) as valid unauthorized responses
        if (![401, 403, 302, 307].includes(response.status)) {
          throw new Error(`Expected 401/403/302/307, got ${response.status}`);
        }
      },
      'Unauthorized access returns 401/403',
      'Critical'
    );

    // Boundary Conditions
    await runTest(
      'Date boundaries handled',
      'Edge Cases',
      'Boundaries',
      async () => {
        // Past date
        const pastEvent = await TestEventFactory.create(user1.id, {
          date: new Date(Date.now() - 24 * 60 * 60 * 1000),
        });
        
        // Future date
        const futureEvent = await TestEventFactory.create(user1.id, {
          date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });
        
        if (!pastEvent || !futureEvent) {
          throw new Error('Date boundary events not created');
        }
      },
      'Past and future dates are handled',
      'Medium'
    );

    await runTest(
      'Large number of guests handled',
      'Edge Cases',
      'Boundaries',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        
        // Create 50 guests
        for (let i = 0; i < 50; i++) {
          await TestGuestFactory.create(event.id);
        }
        
        const guests = await prisma.guest.findMany({
          where: { eventId: event.id },
        });
        
        if (guests.length !== 50) {
          throw new Error(`Expected 50 guests, got ${guests.length}`);
        }
      },
      'Large number of guests is handled',
      'Medium'
    );
  }
}

