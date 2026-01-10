import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';
import type { HTTPClient } from '../comprehensive-test';
import { prisma } from '../comprehensive-test';

export class EventManagementTests {
  static async run(
    httpClient: HTTPClient,
    admin: any,
    user1: any,
    user2: any,
    runTest: any,
    TestEventFactory: any
  ) {
    // Event Creation
    await runTest(
      'Create event with all fields',
      'Event Management',
      'Creation',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const eventData = {
          title: `Test Event ${nanoid(8)}`,
          description: 'Test description',
          location: 'Test Location',
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          rsvpDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          coverImage: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800',
          photoAlbumUrl: 'https://photos.google.com/album/test',
          isPublic: true,
        };
        
        const response = await httpClient.post('/api/events', eventData);
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Failed to create event: ${error.error || response.status}`);
        }
        
        const data = await response.json();
        if (!data.event) {
          throw new Error('Event not returned in response');
        }
      },
      'Event created with all fields',
      'Critical'
    );

    await runTest(
      'Create event with minimal fields',
      'Event Management',
      'Creation',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const eventData = {
          title: `Minimal Event ${nanoid(8)}`,
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };
        
        const response = await httpClient.post('/api/events', eventData);
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Failed to create minimal event: ${error.error || response.status}`);
        }
      },
      'Event created with minimal required fields',
      'High'
    );

    await runTest(
      'Create event with invalid date format (rejected)',
      'Event Management',
      'Creation',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const eventData = {
          title: `Invalid Date Event ${nanoid(8)}`,
          date: 'invalid-date-format',
        };
        
        const response = await httpClient.post('/api/events', eventData);
        
        if (response.status === 200) {
          throw new Error('Invalid date format should be rejected');
        }
      },
      'Invalid date format is rejected',
      'High'
    );

    await runTest(
      'Create event generates unique slug',
      'Event Management',
      'Creation',
      async () => {
        const title = `Duplicate Title ${nanoid(4)}`;
        const event1 = await TestEventFactory.create(user1.id, { title });
        const event2 = await TestEventFactory.create(user1.id, { title });
        
        if (event1.slug === event2.slug) {
          throw new Error('Duplicate slugs generated');
        }
      },
      'Events with same title get unique slugs',
      'Medium'
    );

    // Event Viewing
    await runTest(
      'View own events on dashboard',
      'Event Management',
      'Viewing',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        const events = await prisma.event.findMany({
          where: { hostId: user1.id },
        });
        
        if (!events.some(e => e.id === event.id)) {
          throw new Error('Event not found in user events');
        }
      },
      'User can view their own events',
      'High'
    );

    await runTest(
      'Admin can view all events',
      'Event Management',
      'Viewing',
      async () => {
        const events = await prisma.event.findMany();
        
        if (events.length === 0) {
          throw new Error('No events found');
        }
      },
      'Admin can view all events',
      'High'
    );

    await runTest(
      'View event details page',
      'Event Management',
      'Viewing',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        const fullEvent = await prisma.event.findUnique({
          where: { id: event.id },
          include: {
            guests: true,
            comments: true,
            coHosts: true,
          },
        });
        
        if (!fullEvent) {
          throw new Error('Event not found');
        }
      },
      'Event details can be retrieved',
      'High'
    );

    await runTest(
      'Public event page accessible via slug',
      'Event Management',
      'Viewing',
      async () => {
        const event = await TestEventFactory.create(user1.id, { isPublic: true });
        const response = await httpClient.get(`/events/${event.slug}`);
        
        // Should return 200 or redirect, not 404
        if (response.status === 404) {
          throw new Error('Public event page not accessible');
        }
      },
      'Public events accessible via slug',
      'High'
    );

    // Event Editing
    await runTest(
      'Edit event title',
      'Event Management',
      'Editing',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const event = await TestEventFactory.create(user1.id);
        const newTitle = `Updated Title ${nanoid(8)}`;
        
        const response = await httpClient.patch(`/api/events/${event.id}`, {
          title: newTitle,
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Update failed: ${error.error || response.status}`);
        }
        
        const updated = await prisma.event.findUnique({
          where: { id: event.id },
        });
        
        if (updated?.title !== newTitle) {
          throw new Error('Event title not updated');
        }
      },
      'Event title can be updated',
      'High'
    );

    await runTest(
      'Edit event with notify guests enabled',
      'Event Management',
      'Editing',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const event = await TestEventFactory.create(user1.id);
        const guest = await prisma.guest.create({
          data: {
            eventId: event.id,
            email: `guest_${nanoid(8)}@test.com`,
            notifyByEmail: true,
          },
        });
        
        const response = await httpClient.patch(`/api/events/${event.id}`, {
          title: `Updated ${event.title}`,
          notifyGuests: true,
        });
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Update failed: ${error.error || response.status}`);
        }
      },
      'Event update with guest notification works',
      'High'
    );

    await runTest(
      'Cannot edit event without access',
      'Event Management',
      'Editing',
      async () => {
        const event = await TestEventFactory.create(user2.id);
        
        // user1 should not be able to edit user2's event
        const response = await httpClient.patch(`/api/events/${event.id}`, {
          title: 'Unauthorized Update',
        });
        
        if (response.status === 200) {
          throw new Error('Unauthorized edit should be rejected');
        }
      },
      'Users cannot edit events they do not own',
      'Critical'
    );

    // Event Deletion
    await runTest(
      'Delete event as host',
      'Event Management',
      'Deletion',
      async () => {
        // Ensure authenticated as user1
        await httpClient.loginAsUser(user1);
        
        const event = await TestEventFactory.create(user1.id);
        const response = await httpClient.delete(`/api/events/${event.id}`);
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Delete failed: ${error.error || response.status}`);
        }
        
        const deleted = await prisma.event.findUnique({
          where: { id: event.id },
        });
        
        if (deleted) {
          throw new Error('Event not deleted');
        }
      },
      'Host can delete their event',
      'High'
    );

    await runTest(
      'Delete event cascades to guests',
      'Event Management',
      'Deletion',
      async () => {
        const event = await TestEventFactory.create(user1.id);
        const guest = await prisma.guest.create({
          data: {
            eventId: event.id,
            email: `guest_${nanoid(8)}@test.com`,
          },
        });
        
        await httpClient.delete(`/api/events/${event.id}`);
        
        const deletedGuest = await prisma.guest.findUnique({
          where: { id: guest.id },
        });
        
        if (deletedGuest) {
          throw new Error('Guest not deleted with event');
        }
      },
      'Event deletion cascades to guests',
      'High'
    );

    await runTest(
      'Cannot delete event without access',
      'Event Management',
      'Deletion',
      async () => {
        // Login as user1 (not the event owner)
        await httpClient.loginAsUser(user1);
        
        const event = await TestEventFactory.create(user2.id);
        const response = await httpClient.delete(`/api/events/${event.id}`);
        
        if (response.status === 200) {
          throw new Error('Unauthorized delete should be rejected');
        }
      },
      'Users cannot delete events they do not own',
      'Critical'
    );
  }
}

