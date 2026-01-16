import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { NextRequest } from 'next/server'

// Mock canManageEvent
vi.mock('@/lib/event-access', () => ({
  canManageEvent: vi.fn(),
}))

// Mock email functions
vi.mock('@/lib/email', () => ({
  sendEventChangeEmail: vi.fn().mockResolvedValue(undefined),
}))

// Import after mocks are set up
import { GET as listEvents, POST as createEvent } from '@/app/api/events/route'
import {
  GET as getEvent,
  PATCH as updateEvent,
  DELETE as deleteEvent,
} from '@/app/api/events/[id]/route'
import { canManageEvent } from '@/lib/event-access'

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockCanManageEvent = canManageEvent as ReturnType<typeof vi.fn>

/**
 * Mock authenticated session for API tests
 */
function mockSession(user: { id: string; email: string; role: string; name?: string }) {
  mockAuth.mockResolvedValue({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name || 'Test User',
    },
  })
}

/**
 * Mock unauthenticated session
 */
function mockNoSession() {
  mockAuth.mockResolvedValue(null)
}

/**
 * Create a mock user object
 */
function createMockUser(overrides: Partial<{
  id: string;
  email: string;
  username: string;
  name: string;
  password: string;
  role: string;
}> = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    name: 'Test User',
    password: 'hashed_password123',
    role: 'USER',
    ...overrides,
  }
}

/**
 * Create a mock event object
 */
function createMockEvent(overrides: Partial<{
  id: string;
  title: string;
  slug: string;
  description: string | null;
  date: Date;
  endDate: Date | null;
  location: string | null;
  coverImage: string | null;
  photoAlbumUrl: string | null;
  maxGuestsPerInvitee: number | null;
  isPublic: boolean;
  rsvpDeadline: Date | null;
  reminderSchedule: string | null;
  replyTo: string | null;
  hostId: string;
}> = {}) {
  return {
    id: 'event-1',
    title: 'Test Event',
    slug: 'test-event',
    description: 'A test event description',
    date: new Date('2024-12-25T18:00:00Z'),
    endDate: new Date('2024-12-25T22:00:00Z'),
    location: 'Test Location',
    coverImage: null,
    photoAlbumUrl: null,
    maxGuestsPerInvitee: 2,
    isPublic: false,
    rsvpDeadline: new Date('2024-12-20T23:59:59Z'),
    reminderSchedule: '[{"value":2,"unit":"days"}]',
    replyTo: null,
    hostId: 'user-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

/**
 * Create a mock NextRequest for API route testing
 */
function createMockRequest(
  method: string,
  url: string,
  options: {
    body?: Record<string, unknown>
    headers?: Record<string, string>
    searchParams?: Record<string, string>
  } = {}
): NextRequest {
  const { body, headers = {}, searchParams = {} } = options

  const urlObj = new URL(url, 'http://localhost:3000')
  Object.entries(searchParams).forEach(([key, value]) => {
    urlObj.searchParams.set(key, value)
  })

  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }

  if (body && method !== 'GET' && method !== 'HEAD') {
    requestInit.body = JSON.stringify(body)
  }

  return new NextRequest(urlObj, requestInit)
}

/**
 * Create mock route context with params
 */
function createMockRouteContext(params: Record<string, string>) {
  return { params: Promise.resolve(params) }
}

/**
 * Test data generators
 */
const testData = {
  validEvent: {
    title: 'Test Event',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    location: 'Test Location',
    description: 'Test Description',
    isPublic: false,
    maxGuestsPerInvitee: 2,
  },
}

describe('Events API Routes', () => {
  const testUser = createMockUser({ id: 'user-1', email: 'host@example.com', role: 'USER' })
  const adminUser = createMockUser({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
  const otherUser = createMockUser({ id: 'user-2', email: 'other@example.com', role: 'USER' })

  const testEvent = createMockEvent({
    id: 'event-1',
    title: 'Test Event',
    slug: 'test-event',
    hostId: 'user-1',
    date: new Date('2025-06-15T18:00:00Z'),
    location: 'Test Location',
    description: 'Test Description',
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManageEvent.mockReset()
  })

  // ========================================
  // POST /api/events - Create Event
  // ========================================
  describe('POST /api/events - Create Event', () => {
    it('should return 401 for unauthenticated users', async () => {
      mockNoSession()

      const request = createMockRequest('POST', '/api/events', {
        body: testData.validEvent,
      })

      const response = await createEvent(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should create an event for authenticated users', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })

      // Mock that slug does not exist
      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      const createdEvent = {
        ...testEvent,
        id: 'new-event-id',
        slug: 'test-event',
      }
      ;(prisma.event.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdEvent)

      const request = createMockRequest('POST', '/api/events', {
        body: testData.validEvent,
      })

      const response = await createEvent(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.event).toBeDefined()
      expect(prisma.event.create).toHaveBeenCalled()
    })

    it('should return 400 for missing required fields', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })

      const request = createMockRequest('POST', '/api/events', {
        body: { description: 'No title or date provided' },
      })

      const response = await createEvent(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
    })

    it('should return 500 for invalid date format that throws exception', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })

      const request = createMockRequest('POST', '/api/events', {
        body: {
          ...testData.validEvent,
          date: 'not-a-valid-date',
        },
      })

      const response = await createEvent(request)

      // The API catches the date parsing exception in the outer catch block
      // and returns 500 with 'Failed to create event' error
      expect(response.status).toBe(500)
    })

    it('should return 400 when end date is before start date', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })

      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const pastDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)

      const request = createMockRequest('POST', '/api/events', {
        body: {
          ...testData.validEvent,
          date: futureDate.toISOString(),
          endDate: pastDate.toISOString(),
        },
      })

      const response = await createEvent(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('End date cannot be before')
    })

    it('should return 400 when RSVP deadline is after event date', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })

      const eventDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const laterDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

      const request = createMockRequest('POST', '/api/events', {
        body: {
          ...testData.validEvent,
          date: eventDate.toISOString(),
          rsvpDeadline: laterDeadline.toISOString(),
        },
      })

      const response = await createEvent(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('RSVP deadline cannot be after')
    })

    it('should return 400 for invalid photo album URL', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })

      // Mock that slug does not exist
      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      const request = createMockRequest('POST', '/api/events', {
        body: {
          ...testData.validEvent,
          photoAlbumUrl: 'not-a-valid-url',
        },
      })

      const response = await createEvent(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid photo album URL')
    })

    it('should handle duplicate slug by generating unique one', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })

      // First slug check returns existing event, second returns null
      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: 'existing-event', slug: 'test-event' })
        .mockResolvedValueOnce(null)

      const createdEvent = {
        ...testEvent,
        id: 'new-event-id',
        slug: 'test-event-mock',
      }
      ;(prisma.event.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdEvent)

      const request = createMockRequest('POST', '/api/events', {
        body: testData.validEvent,
      })

      const response = await createEvent(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.event).toBeDefined()
      // findUnique was called twice to check for slug uniqueness
      expect(prisma.event.findUnique).toHaveBeenCalledTimes(2)
    })

    it('should create event with valid reminder schedule', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      const createdEvent = {
        ...testEvent,
        reminderSchedule: '[{"value":2,"unit":"days"}]',
      }
      ;(prisma.event.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdEvent)

      const request = createMockRequest('POST', '/api/events', {
        body: {
          ...testData.validEvent,
          reminderSchedule: '[{"value":2,"unit":"days"}]',
        },
      })

      const response = await createEvent(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.event).toBeDefined()
    })

    it('should ignore invalid reminder schedule JSON and create event anyway', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      const createdEvent = {
        ...testEvent,
        reminderSchedule: null, // Invalid JSON is ignored
      }
      ;(prisma.event.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdEvent)

      const request = createMockRequest('POST', '/api/events', {
        body: {
          ...testData.validEvent,
          reminderSchedule: 'invalid-json',
        },
      })

      const response = await createEvent(request)

      // Invalid JSON is parsed to empty array by parseReminderSchedule
      // which validates as valid with validateReminders
      expect(response.status).toBe(200)
    })

    it('should create event with valid replyTo email', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      const createdEvent = {
        ...testEvent,
        replyTo: 'custom@example.com',
      }
      ;(prisma.event.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdEvent)

      const request = createMockRequest('POST', '/api/events', {
        body: {
          ...testData.validEvent,
          replyTo: 'custom@example.com',
        },
      })

      const response = await createEvent(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.event).toBeDefined()
    })
  })

  // ========================================
  // GET /api/events - List Events
  // ========================================
  describe('GET /api/events - List Events', () => {
    it('should return 401 for unauthenticated users', async () => {
      mockNoSession()

      const response = await listEvents()
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return events for authenticated users', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })

      const events = [
        { ...testEvent, guests: [] },
        { ...createMockEvent({ id: 'event-2', hostId: testUser.id }), guests: [] },
      ]
      ;(prisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(events)

      const response = await listEvents()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.events).toHaveLength(2)
      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hostId: testUser.id },
        })
      )
    })

    it('should return empty array when user has no events', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })

      ;(prisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

      const response = await listEvents()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.events).toEqual([])
    })

    it('should include guest counts in response', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })

      const events = [
        {
          ...testEvent,
          guests: [
            { id: 'guest-1', status: 'ATTENDING' },
            { id: 'guest-2', status: 'PENDING' },
          ],
        },
      ]
      ;(prisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(events)

      const response = await listEvents()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.events[0].guests).toHaveLength(2)
    })

    it('should return 500 on database error', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })

      ;(prisma.event.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database error')
      )

      const response = await listEvents()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch events')
    })
  })

  // ========================================
  // GET /api/events/[id] - Get Single Event
  // ========================================
  describe('GET /api/events/[id] - Get Event', () => {
    it('should return 401 for unauthenticated users', async () => {
      mockNoSession()

      const request = createMockRequest('GET', '/api/events/event-1')
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await getEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 404 when user cannot manage event', async () => {
      mockSession({ id: otherUser.id, email: otherUser.email, role: 'USER' })
      mockCanManageEvent.mockResolvedValue(false)

      const request = createMockRequest('GET', '/api/events/event-1')
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await getEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Event not found')
    })

    it('should return event for host', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })
      mockCanManageEvent.mockResolvedValue(true)

      const eventWithRelations = {
        ...testEvent,
        guests: [],
        comments: [],
        coHosts: [],
        updates: [],
      }
      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(eventWithRelations)

      const request = createMockRequest('GET', '/api/events/event-1')
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await getEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.event).toBeDefined()
      expect(data.event.id).toBe('event-1')
    })

    it('should return event for admin', async () => {
      mockSession({ id: adminUser.id, email: adminUser.email, role: 'ADMIN' })
      mockCanManageEvent.mockResolvedValue(true)

      const eventWithRelations = {
        ...testEvent,
        guests: [],
        comments: [],
        coHosts: [],
        updates: [],
      }
      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(eventWithRelations)

      const request = createMockRequest('GET', '/api/events/event-1')
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await getEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.event).toBeDefined()
    })

    it('should return 404 when event does not exist', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })
      mockCanManageEvent.mockResolvedValue(true)

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const request = createMockRequest('GET', '/api/events/non-existent')
      const context = createMockRouteContext({ id: 'non-existent' })

      const response = await getEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Event not found')
    })

    it('should include guest with additional guests', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })
      mockCanManageEvent.mockResolvedValue(true)

      const eventWithRelations = {
        ...testEvent,
        guests: [
          {
            id: 'guest-1',
            name: 'Test Guest',
            additionalGuests: [{ id: 'ag-1', name: 'Plus One' }],
          },
        ],
        comments: [],
        coHosts: [],
        updates: [],
      }
      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(eventWithRelations)

      const request = createMockRequest('GET', '/api/events/event-1')
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await getEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.event.guests[0].additionalGuests).toHaveLength(1)
    })

    it('should return 500 on database error', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })
      mockCanManageEvent.mockResolvedValue(true)

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database error')
      )

      const request = createMockRequest('GET', '/api/events/event-1')
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await getEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch event')
    })
  })

  // ========================================
  // PATCH /api/events/[id] - Update Event
  // ========================================
  describe('PATCH /api/events/[id] - Update Event', () => {
    it('should return 401 for unauthenticated users', async () => {
      mockNoSession()

      const request = createMockRequest('PATCH', '/api/events/event-1', {
        body: { title: 'Updated Title' },
      })
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await updateEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 404 when user cannot manage event', async () => {
      mockSession({ id: otherUser.id, email: otherUser.email, role: 'USER' })
      mockCanManageEvent.mockResolvedValue(false)

      const request = createMockRequest('PATCH', '/api/events/event-1', {
        body: { title: 'Updated Title' },
      })
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await updateEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Event not found')
    })

    it('should update event title for host', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })
      mockCanManageEvent.mockResolvedValue(true)

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(testEvent)

      const updatedEvent = { ...testEvent, title: 'Updated Title' }
      ;(prisma.event.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedEvent)

      const request = createMockRequest('PATCH', '/api/events/event-1', {
        body: { title: 'Updated Title' },
      })
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await updateEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.event.title).toBe('Updated Title')
    })

    it('should update event for admin', async () => {
      mockSession({ id: adminUser.id, email: adminUser.email, role: 'ADMIN' })
      mockCanManageEvent.mockResolvedValue(true)

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(testEvent)

      const updatedEvent = { ...testEvent, description: 'Updated by admin' }
      ;(prisma.event.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedEvent)

      const request = createMockRequest('PATCH', '/api/events/event-1', {
        body: { description: 'Updated by admin' },
      })
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await updateEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.event.description).toBe('Updated by admin')
    })

    it('should return 404 when event does not exist', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })
      mockCanManageEvent.mockResolvedValue(true)

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const request = createMockRequest('PATCH', '/api/events/non-existent', {
        body: { title: 'Updated Title' },
      })
      const context = createMockRouteContext({ id: 'non-existent' })

      const response = await updateEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Event not found')
    })

    it('should return 400 for invalid data', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })
      mockCanManageEvent.mockResolvedValue(true)

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(testEvent)

      const request = createMockRequest('PATCH', '/api/events/event-1', {
        body: { title: '' }, // Empty title should fail validation
      })
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await updateEvent(request, context)

      expect(response.status).toBe(400)
    })

    it('should return 400 when end date is before start date', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })
      mockCanManageEvent.mockResolvedValue(true)

      const existingEvent = {
        ...testEvent,
        date: new Date('2025-06-15T18:00:00Z'),
      }
      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existingEvent)

      const request = createMockRequest('PATCH', '/api/events/event-1', {
        body: { endDate: '2025-06-14T18:00:00Z' }, // Before event date
      })
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await updateEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('End date cannot be before')
    })

    it('should return 400 when RSVP deadline is after event date', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })
      mockCanManageEvent.mockResolvedValue(true)

      const existingEvent = {
        ...testEvent,
        date: new Date('2025-06-15T18:00:00Z'),
      }
      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existingEvent)

      const request = createMockRequest('PATCH', '/api/events/event-1', {
        body: { rsvpDeadline: '2025-06-20T18:00:00Z' }, // After event date
      })
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await updateEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('RSVP deadline cannot be after')
    })

    it('should update event with valid reminder schedule', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })
      mockCanManageEvent.mockResolvedValue(true)

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(testEvent)

      const updatedEvent = {
        ...testEvent,
        reminderSchedule: '[{"value":3,"unit":"days"}]',
      }
      ;(prisma.event.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedEvent)

      const request = createMockRequest('PATCH', '/api/events/event-1', {
        body: { reminderSchedule: '[{"value":3,"unit":"days"}]' },
      })
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await updateEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.event.reminderSchedule).toBe('[{"value":3,"unit":"days"}]')
    })

    it('should ignore invalid reminder schedule JSON and update event anyway', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })
      mockCanManageEvent.mockResolvedValue(true)

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(testEvent)

      const updatedEvent = {
        ...testEvent,
        reminderSchedule: null, // Invalid JSON is ignored/cleared
      }
      ;(prisma.event.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedEvent)

      const request = createMockRequest('PATCH', '/api/events/event-1', {
        body: { reminderSchedule: 'invalid-schedule' },
      })
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await updateEvent(request, context)

      // Invalid JSON is parsed to empty array by parseReminderSchedule
      // which validates as valid with validateReminders
      expect(response.status).toBe(200)
    })

    it('should allow clearing optional fields', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })
      mockCanManageEvent.mockResolvedValue(true)

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(testEvent)

      const updatedEvent = {
        ...testEvent,
        description: null,
        location: null,
      }
      ;(prisma.event.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedEvent)

      const request = createMockRequest('PATCH', '/api/events/event-1', {
        body: { description: null, location: null },
      })
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await updateEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.event.description).toBeNull()
      expect(data.event.location).toBeNull()
    })

    it('should handle notifyGuests flag with changes', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })
      mockCanManageEvent.mockResolvedValue(true)

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(testEvent)

      const updatedEvent = { ...testEvent, title: 'Changed Title' }
      ;(prisma.event.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedEvent)
      ;(prisma.guest.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          email: 'guest@example.com',
          name: 'Guest',
          notifyByEmail: true,
          notifyBySms: false,
          token: 'token-123',
        },
      ])
      ;(prisma.eventUpdate.create as ReturnType<typeof vi.fn>).mockResolvedValue({})

      const request = createMockRequest('PATCH', '/api/events/event-1', {
        body: { title: 'Changed Title', notifyGuests: true },
      })
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await updateEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.changesNotified).toBe(1)
    })

    it('should return 500 on database error', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })
      mockCanManageEvent.mockResolvedValue(true)

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(testEvent)
      ;(prisma.event.update as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database error')
      )

      const request = createMockRequest('PATCH', '/api/events/event-1', {
        body: { title: 'Updated Title' },
      })
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await updateEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to update event')
    })
  })

  // ========================================
  // DELETE /api/events/[id] - Delete Event
  // ========================================
  describe('DELETE /api/events/[id] - Delete Event', () => {
    it('should return 401 for unauthenticated users', async () => {
      mockNoSession()

      const request = createMockRequest('DELETE', '/api/events/event-1')
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await deleteEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 404 when user cannot manage event', async () => {
      mockSession({ id: otherUser.id, email: otherUser.email, role: 'USER' })
      mockCanManageEvent.mockResolvedValue(false)

      const request = createMockRequest('DELETE', '/api/events/event-1')
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await deleteEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Event not found')
    })

    it('should delete event for host', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })
      mockCanManageEvent.mockResolvedValue(true)

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(testEvent)
      ;(prisma.event.delete as ReturnType<typeof vi.fn>).mockResolvedValue(testEvent)

      const request = createMockRequest('DELETE', '/api/events/event-1')
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await deleteEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(prisma.event.delete).toHaveBeenCalledWith({
        where: { id: 'event-1' },
      })
    })

    it('should delete event for admin', async () => {
      mockSession({ id: adminUser.id, email: adminUser.email, role: 'ADMIN' })
      mockCanManageEvent.mockResolvedValue(true)

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(testEvent)
      ;(prisma.event.delete as ReturnType<typeof vi.fn>).mockResolvedValue(testEvent)

      const request = createMockRequest('DELETE', '/api/events/event-1')
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await deleteEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should return 404 when event does not exist', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })
      mockCanManageEvent.mockResolvedValue(true)

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const request = createMockRequest('DELETE', '/api/events/non-existent')
      const context = createMockRouteContext({ id: 'non-existent' })

      const response = await deleteEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Event not found')
    })

    it('should return 500 on database error', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })
      mockCanManageEvent.mockResolvedValue(true)

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(testEvent)
      ;(prisma.event.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database error')
      )

      const request = createMockRequest('DELETE', '/api/events/event-1')
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await deleteEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to delete event')
    })
  })

  // ========================================
  // Edge Cases and Integration Tests
  // ========================================
  describe('Edge Cases', () => {
    it('should handle empty request body for POST', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })

      const request = createMockRequest('POST', '/api/events', {
        body: {},
      })

      const response = await createEvent(request)

      expect(response.status).toBe(400)
    })

    it('should handle special characters in event title', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const specialTitle = 'Event with "quotes" & <special> characters!'
      const createdEvent = {
        ...testEvent,
        title: specialTitle,
        slug: 'event-with-quotes-special-characters',
      }
      ;(prisma.event.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdEvent)

      const request = createMockRequest('POST', '/api/events', {
        body: {
          ...testData.validEvent,
          title: specialTitle,
        },
      })

      const response = await createEvent(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.event.title).toBe(specialTitle)
    })

    it('should handle very long description', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const longDescription = 'A'.repeat(5000)
      const createdEvent = {
        ...testEvent,
        description: longDescription,
      }
      ;(prisma.event.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdEvent)

      const request = createMockRequest('POST', '/api/events', {
        body: {
          ...testData.validEvent,
          description: longDescription,
        },
      })

      const response = await createEvent(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.event.description).toBe(longDescription)
    })

    it('should handle isPublic flag correctly', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const createdEvent = {
        ...testEvent,
        isPublic: true,
      }
      ;(prisma.event.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdEvent)

      const request = createMockRequest('POST', '/api/events', {
        body: {
          ...testData.validEvent,
          isPublic: true,
        },
      })

      const response = await createEvent(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.event.isPublic).toBe(true)
    })

    it('should handle maxGuestsPerInvitee null value', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })
      mockCanManageEvent.mockResolvedValue(true)

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(testEvent)

      const updatedEvent = { ...testEvent, maxGuestsPerInvitee: null }
      ;(prisma.event.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedEvent)

      const request = createMockRequest('PATCH', '/api/events/event-1', {
        body: { maxGuestsPerInvitee: null },
      })
      const context = createMockRouteContext({ id: 'event-1' })

      const response = await updateEvent(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.event.maxGuestsPerInvitee).toBeNull()
    })

    it('should validate email format for replyTo field', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })

      const request = createMockRequest('POST', '/api/events', {
        body: {
          ...testData.validEvent,
          replyTo: 'not-an-email',
        },
      })

      const response = await createEvent(request)

      expect(response.status).toBe(400)
    })

    it('should allow empty string for replyTo field', async () => {
      mockSession({ id: testUser.id, email: testUser.email, role: 'USER' })

      ;(prisma.event.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const createdEvent = {
        ...testEvent,
        replyTo: null,
      }
      ;(prisma.event.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdEvent)

      const request = createMockRequest('POST', '/api/events', {
        body: {
          ...testData.validEvent,
          replyTo: '',
        },
      })

      const response = await createEvent(request)
      const data = await response.json()

      expect(response.status).toBe(200)
    })
  })
})
