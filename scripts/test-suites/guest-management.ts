import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';
import type { HTTPClient } from '../comprehensive-test';
import { prisma, TEST_PHONE } from '../comprehensive-test';

export class GuestManagementTests {
  static async run(
    httpClient: HTTPClient,
    admin: any,
    user1: any,
    runTest: any,
    TestEventFactory: any,
    TestGuestFactory: any
  ) {
    // Adding Guests
    await runTest(
      'Add guest with email only',
      'Guest Management',
      'Adding',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const event = await TestEventFactory.create(user1.id);
        const response = await httpClient.post(`/api/events/${event.id}/guests`, {
          email: `guest_${nanoid(8)}@test.com`,
          name: 'Test Guest',
          notifyByEmail: true,
          notifyBySms: false,
          sendInvite: false,
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Failed to add guest: ${error.error || response.status}`);
        }
      },
      'Guest can be added with email only',
      'High'
    );

    await runTest(
      'Add guest with email and phone',
      'Guest Management',
      'Adding',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const event = await TestEventFactory.create(user1.id);
        const response = await httpClient.post(`/api/events/${event.id}/guests`, {
          email: `guest_${nanoid(8)}@test.com`,
          phone: TEST_PHONE,
          name: 'Test Guest',
          notifyByEmail: true,
          notifyBySms: true,
          sendInvite: false,
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Failed to add guest: ${error.error || response.status}`);
        }
      },
      'Guest can be added with email and phone',
      'High'
    );

    await runTest(
      'Add duplicate guest (rejected)',
      'Guest Management',
      'Adding',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const event = await TestEventFactory.create(user1.id);
        const email = `duplicate_${nanoid(8)}@test.com`;
        
        await httpClient.post(`/api/events/${event.id}/guests`, {
          email,
          name: 'First Guest',
          sendInvite: false,
        });
        
        const response = await httpClient.post(`/api/events/${event.id}/guests`, {
          email,
          name: 'Duplicate Guest',
          sendInvite: false,
        });
        
        if (response.status === 200) {
          throw new Error('Duplicate guest should be rejected');
        }
      },
      'Duplicate guests are rejected',
      'High'
    );

    await runTest(
      'Add guest with invalid email (rejected)',
      'Guest Management',
      'Adding',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const event = await TestEventFactory.create(user1.id);
        const response = await httpClient.post(`/api/events/${event.id}/guests`, {
          email: 'invalid-email-format',
          name: 'Test Guest',
          sendInvite: false,
        });
        
        if (response.status === 200) {
          throw new Error('Invalid email should be rejected');
        }
      },
      'Invalid email format is rejected',
      'High'
    );

    // Guest List Management
    await runTest(
      'View guest list',
      'Guest Management',
      'List',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        await TestGuestFactory.create(event.id);
        await TestGuestFactory.create(event.id);
        
        const guests = await prisma.guest.findMany({
          where: { eventId: event.id },
        });
        
        if (guests.length < 2) {
          throw new Error('Guests not found');
        }
      },
      'Guest list can be retrieved',
      'High'
    );

    await runTest(
      'Filter guests by status',
      'Guest Management',
      'List',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        await TestGuestFactory.create(event.id, { status: 'ATTENDING' });
        await TestGuestFactory.create(event.id, { status: 'NOT_ATTENDING' });
        await TestGuestFactory.create(event.id, { status: 'PENDING' });
        
        const attending = await prisma.guest.findMany({
          where: { eventId: event.id, status: 'ATTENDING' },
        });
        
        if (attending.length === 0) {
          throw new Error('Filtering by status failed');
        }
      },
      'Guests can be filtered by status',
      'Medium'
    );

    // Guest Editing
    await runTest(
      'Edit guest name',
      'Guest Management',
      'Editing',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const event = await TestEventFactory.create(user1.id);
        const guest = await TestGuestFactory.create(event.id);
        const newName = `Updated Name ${nanoid(4)}`;
        
        const response = await httpClient.patch(`/api/events/${event.id}/guests/${guest.id}`, {
          name: newName,
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Update failed: ${error.error || response.status}`);
        }
        
        const updated = await prisma.guest.findUnique({
          where: { id: guest.id },
        });
        
        if (updated?.name !== newName) {
          throw new Error('Guest name not updated');
        }
      },
      'Guest name can be updated',
      'High'
    );

    await runTest(
      'Edit guest status',
      'Guest Management',
      'Editing',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const event = await TestEventFactory.create(user1.id);
        const guest = await TestGuestFactory.create(event.id, { status: 'PENDING' });
        
        const response = await httpClient.patch(`/api/events/${event.id}/guests/${guest.id}`, {
          status: 'ATTENDING',
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Update failed: ${error.error || response.status}`);
        }
        
        const updated = await prisma.guest.findUnique({
          where: { id: guest.id },
        });
        
        if (updated?.status !== 'ATTENDING') {
          throw new Error('Guest status not updated');
        }
      },
      'Guest status can be updated',
      'High'
    );

    // Guest Deletion
    await runTest(
      'Delete guest',
      'Guest Management',
      'Deletion',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const event = await TestEventFactory.create(user1.id);
        const guest = await TestGuestFactory.create(event.id);
        
        const response = await httpClient.delete(`/api/events/${event.id}/guests/${guest.id}`);
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Delete failed: ${error.error || response.status}`);
        }
        
        const deleted = await prisma.guest.findUnique({
          where: { id: guest.id },
        });
        
        if (deleted) {
          throw new Error('Guest not deleted');
        }
      },
      'Guest can be deleted',
      'High'
    );

    // Guest Invitations
    await runTest(
      'Send invitation to guest via email',
      'Guest Management',
      'Invitations',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const event = await TestEventFactory.create(user1.id);
        const guest = await TestGuestFactory.create(event.id, {
          notifyByEmail: true,
          notifyBySms: false,
        });
        
        const response = await httpClient.post(`/api/events/${event.id}/guests/${guest.id}/invite`, {});
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Invitation failed: ${error.error || response.status}`);
        }
      },
      'Email invitation can be sent',
      'High'
    );

    // Guest Import/Export
    await runTest(
      'Export guest list as CSV',
      'Guest Management',
      'Import/Export',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const event = await TestEventFactory.create(user1.id);
        await TestGuestFactory.create(event.id);
        await TestGuestFactory.create(event.id);
        
        const response = await httpClient.get(`/api/events/${event.id}/guests/export`);
        
        if (response.status !== 200) {
          throw new Error(`Export failed: ${response.status}`);
        }
        
        const csv = await response.text();
        if (!csv.includes('email') || !csv.includes('name')) {
          throw new Error('CSV format incorrect');
        }
      },
      'Guest list can be exported as CSV',
      'Medium'
    );

    await runTest(
      'Import guests from CSV',
      'Guest Management',
      'Import/Export',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const event = await TestEventFactory.create(user1.id);
        const guests = [
          { email: `import1_${nanoid(8)}@test.com`, name: 'Guest 1' },
          { email: `import2_${nanoid(8)}@test.com`, name: 'Guest 2' },
        ];
        
        const response = await httpClient.post(`/api/events/${event.id}/guests/import`, {
          guests,
          sendInvites: false,
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Import failed: ${error.error || response.status}`);
        }
        
        const data = await response.json();
        if (data.imported !== 2) {
          throw new Error(`Expected 2 imported, got ${data.imported}`);
        }
      },
      'Guests can be imported from CSV',
      'High'
    );
  }
}

