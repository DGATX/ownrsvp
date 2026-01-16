import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  createMockRequest,
  createMockRouteContext,
  parseJsonResponse,
} from '../helpers/api-test-utils'
import {
  createMockUser,
  createMockEvent,
  createMockGuest,
  createMockAdditionalGuest,
} from '../setup'

// Mock email functions
vi.mock('@/lib/email', () => ({
  sendConfirmation: vi.fn().mockResolvedValue(undefined),
  sendRsvpChangeNotification: vi.fn().mockResolvedValue(undefined),
  getEventHostsForNotification: vi.fn().mockResolvedValue([]),
}))

// Mock config functions
vi.mock('@/lib/config', () => ({
  getAppUrl: vi.fn().mockResolvedValue('http://localhost:3000'),
  getEmailConfig: vi.fn().mockResolvedValue({
    host: 'smtp.test.com',
    port: '587',
    user: 'test@test.com',
    password: 'test-password',
    from: 'noreply@test.com',
  }),
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// Import routes after mocks are set up
import { POST } from '@/app/api/rsvp/route'
import { GET, PATCH } from '@/app/api/rsvp/[token]/route'
import { POST as sendEditLink } from '@/app/api/rsvp/send-edit-link/route'
import { sendConfirmation, sendRsvpChangeNotification, getEventHostsForNotification } from '@/lib/email'
import { getEmailConfig, getAppUrl } from '@/lib/config'

// Helper to set up prisma mock - uses the already mocked prisma from setup.ts
// Uses mockResolvedValueOnce to avoid interference between tests
function setupPrismaMock(model: string, method: string, returnValue: unknown) {
  const modelMock = (prisma as any)[model]
  if (modelMock && modelMock[method]) {
    // Reset the specific mock and set a new resolved value
    modelMock[method].mockReset()
    modelMock[method].mockResolvedValue(returnValue)
  }
}

describe('RSVP API Routes', () => {
  beforeEach(() => {
    // Clear all mock calls but keep implementations (setup.ts defines base mocks)
    vi.clearAllMocks()

    // Re-establish mocks that may have been reset by setup.ts afterEach
    vi.mocked(getAppUrl).mockResolvedValue('http://localhost:3000')
    vi.mocked(getEmailConfig).mockResolvedValue({
      host: 'smtp.test.com',
      port: '587',
      user: 'test@test.com',
      password: 'test-password',
      from: 'noreply@test.com',
    })
    vi.mocked(sendConfirmation).mockResolvedValue(undefined)
    vi.mocked(sendRsvpChangeNotification).mockResolvedValue(undefined)
    vi.mocked(getEventHostsForNotification).mockResolvedValue([])
  })

  // ===========================================
  // POST /api/rsvp - Submit RSVP
  // ===========================================
  describe('POST /api/rsvp - Submit RSVP', () => {
    const mockHost = createMockUser({ id: 'host-1', name: 'Event Host' })
    const mockEvent = createMockEvent({
      id: 'event-1',
      title: 'Test Event',
      hostId: 'host-1',
      maxGuestsPerInvitee: 3,
      rsvpDeadline: new Date('2099-12-31'), // Far future
      host: mockHost,
      coHosts: [],
    })

    describe('Validation', () => {
      it('should reject request with missing required fields', async () => {
        const request = createMockRequest('POST', '/api/rsvp', {
          body: { eventId: 'event-1' },
        })

        const response = await POST(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBeDefined()
      })

      it('should reject request with invalid email', async () => {
        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Test Guest',
            email: 'invalid-email',
            status: 'ATTENDING',
          },
        })

        const response = await POST(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBe('Invalid email')
      })

      it('should reject request with empty name', async () => {
        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: '',
            email: 'test@example.com',
            status: 'ATTENDING',
          },
        })

        const response = await POST(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBe('Name is required')
      })

      it('should reject request with invalid status', async () => {
        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Test Guest',
            email: 'test@example.com',
            status: 'INVALID_STATUS',
          },
        })

        const response = await POST(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBeDefined()
      })
    })

    describe('Event validation', () => {
      it('should return 404 when event does not exist', async () => {
        setupPrismaMock('event', 'findUnique', null)

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'non-existent-event',
            name: 'Test Guest',
            email: 'test@example.com',
            status: 'ATTENDING',
          },
        })

        const response = await POST(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(404)
        expect(body.error).toBe('Event not found')
      })

      it('should reject RSVP when deadline has passed', async () => {
        const pastDeadlineEvent = {
          ...mockEvent,
          rsvpDeadline: new Date('2020-01-01'), // Past date
        }
        setupPrismaMock('event', 'findUnique', pastDeadlineEvent)

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Test Guest',
            email: 'test@example.com',
            status: 'ATTENDING',
          },
        })

        const response = await POST(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBe('The RSVP deadline for this event has passed')
      })

      it('should allow RSVP when no deadline is set', async () => {
        const noDeadlineEvent = { ...mockEvent, rsvpDeadline: null }
        setupPrismaMock('event', 'findUnique', noDeadlineEvent)
        setupPrismaMock('guest', 'findUnique', null)

        const mockGuest = createMockGuest({
          id: 'new-guest-1',
          name: 'Test Guest',
          email: 'test@example.com',
          status: 'ATTENDING',
          eventId: 'event-1',
          additionalGuests: [],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'create', mockGuest)

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Test Guest',
            email: 'test@example.com',
            status: 'ATTENDING',
          },
        })

        const response = await POST(request)
        expect(response.status).toBe(200)
      })
    })

    describe('New guest RSVP submission', () => {
      it('should create new guest with ATTENDING status', async () => {
        setupPrismaMock('event', 'findUnique', mockEvent)
        setupPrismaMock('guest', 'findUnique', null)

        const mockGuest = createMockGuest({
          id: 'new-guest-1',
          name: 'Test Guest',
          email: 'test@example.com',
          status: 'ATTENDING',
          eventId: 'event-1',
          additionalGuests: [],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'create', mockGuest)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Test Guest',
            email: 'test@example.com',
            status: 'ATTENDING',
          },
        })

        const response = await POST(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest).toBeDefined()
        expect(body.guest.status).toBe('ATTENDING')
        expect(prisma.guest.create).toHaveBeenCalled()
      })

      it('should create new guest with NOT_ATTENDING status', async () => {
        setupPrismaMock('event', 'findUnique', mockEvent)
        setupPrismaMock('guest', 'findUnique', null)

        const mockGuest = createMockGuest({
          id: 'new-guest-1',
          name: 'Test Guest',
          email: 'test@example.com',
          status: 'NOT_ATTENDING',
          eventId: 'event-1',
          additionalGuests: [],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'create', mockGuest)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Test Guest',
            email: 'test@example.com',
            status: 'NOT_ATTENDING',
          },
        })

        const response = await POST(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest.status).toBe('NOT_ATTENDING')
      })

      it('should create new guest with MAYBE status', async () => {
        setupPrismaMock('event', 'findUnique', mockEvent)
        setupPrismaMock('guest', 'findUnique', null)

        const mockGuest = createMockGuest({
          id: 'new-guest-1',
          name: 'Test Guest',
          email: 'test@example.com',
          status: 'MAYBE',
          eventId: 'event-1',
          additionalGuests: [],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'create', mockGuest)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Test Guest',
            email: 'test@example.com',
            status: 'MAYBE',
          },
        })

        const response = await POST(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest.status).toBe('MAYBE')
      })

      it('should save dietary notes when attending', async () => {
        setupPrismaMock('event', 'findUnique', mockEvent)
        setupPrismaMock('guest', 'findUnique', null)

        const mockGuest = createMockGuest({
          id: 'new-guest-1',
          name: 'Test Guest',
          email: 'test@example.com',
          status: 'ATTENDING',
          dietaryNotes: 'Vegetarian, no nuts',
          eventId: 'event-1',
          additionalGuests: [],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'create', mockGuest)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Test Guest',
            email: 'test@example.com',
            status: 'ATTENDING',
            dietaryNotes: 'Vegetarian, no nuts',
          },
        })

        const response = await POST(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest.dietaryNotes).toBe('Vegetarian, no nuts')
      })

      it('should save phone number when provided', async () => {
        setupPrismaMock('event', 'findUnique', mockEvent)
        setupPrismaMock('guest', 'findUnique', null)

        const mockGuest = createMockGuest({
          id: 'new-guest-1',
          name: 'Test Guest',
          email: 'test@example.com',
          phone: '+1234567890',
          status: 'ATTENDING',
          eventId: 'event-1',
          additionalGuests: [],
          notifyByEmail: true,
          notifyBySms: true,
        })
        setupPrismaMock('guest', 'create', mockGuest)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Test Guest',
            email: 'test@example.com',
            phone: '+1234567890',
            status: 'ATTENDING',
          },
        })

        const response = await POST(request)
        expect(response.status).toBe(200)
      })
    })

    describe('Existing guest RSVP update', () => {
      it('should update existing guest status from PENDING to ATTENDING', async () => {
        setupPrismaMock('event', 'findUnique', mockEvent)

        const existingGuest = createMockGuest({
          id: 'existing-guest-1',
          name: 'Existing Guest',
          email: 'existing@example.com',
          status: 'PENDING',
          eventId: 'event-1',
          additionalGuests: [],
        })
        setupPrismaMock('guest', 'findUnique', existingGuest)
        setupPrismaMock('additionalGuest', 'deleteMany', { count: 0 })

        const updatedGuest = { ...existingGuest, status: 'ATTENDING', additionalGuests: [] }
        setupPrismaMock('guest', 'update', updatedGuest)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Existing Guest',
            email: 'existing@example.com',
            status: 'ATTENDING',
          },
        })

        const response = await POST(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest.status).toBe('ATTENDING')
        expect(prisma.guest.update).toHaveBeenCalled()
        expect(prisma.additionalGuest.deleteMany).toHaveBeenCalled()
      })

      it('should update existing guest status from ATTENDING to NOT_ATTENDING', async () => {
        setupPrismaMock('event', 'findUnique', mockEvent)

        const existingGuest = createMockGuest({
          id: 'existing-guest-1',
          name: 'Existing Guest',
          email: 'existing@example.com',
          status: 'ATTENDING',
          eventId: 'event-1',
          additionalGuests: [createMockAdditionalGuest()],
        })
        setupPrismaMock('guest', 'findUnique', existingGuest)
        setupPrismaMock('additionalGuest', 'deleteMany', { count: 1 })

        const updatedGuest = { ...existingGuest, status: 'NOT_ATTENDING', additionalGuests: [] }
        setupPrismaMock('guest', 'update', updatedGuest)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Existing Guest',
            email: 'existing@example.com',
            status: 'NOT_ATTENDING',
          },
        })

        const response = await POST(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest.status).toBe('NOT_ATTENDING')
      })

      it('should clear additional guests when changing to NOT_ATTENDING', async () => {
        setupPrismaMock('event', 'findUnique', mockEvent)

        const existingGuest = createMockGuest({
          id: 'existing-guest-1',
          name: 'Existing Guest',
          email: 'existing@example.com',
          status: 'ATTENDING',
          eventId: 'event-1',
          additionalGuests: [
            createMockAdditionalGuest({ id: 'ag-1', name: 'Plus One' }),
          ],
        })
        setupPrismaMock('guest', 'findUnique', existingGuest)
        setupPrismaMock('additionalGuest', 'deleteMany', { count: 1 })

        const updatedGuest = {
          ...existingGuest,
          status: 'NOT_ATTENDING',
          additionalGuests: [],
        }
        setupPrismaMock('guest', 'update', updatedGuest)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Existing Guest',
            email: 'existing@example.com',
            status: 'NOT_ATTENDING',
          },
        })

        const response = await POST(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest.additionalGuests).toHaveLength(0)
      })
    })

    describe('Guest limit validation', () => {
      it('should reject RSVP when additional guests exceed global limit', async () => {
        const limitedEvent = { ...mockEvent, maxGuestsPerInvitee: 2 }
        setupPrismaMock('event', 'findUnique', limitedEvent)
        setupPrismaMock('guest', 'findUnique', null)

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Test Guest',
            email: 'test@example.com',
            status: 'ATTENDING',
            additionalGuests: ['Guest 1', 'Guest 2', 'Guest 3'], // 4 total > limit of 2
          },
        })

        const response = await POST(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toContain('additional guest')
      })

      it('should accept RSVP when additional guests are within global limit', async () => {
        const limitedEvent = { ...mockEvent, maxGuestsPerInvitee: 3 }
        setupPrismaMock('event', 'findUnique', limitedEvent)
        setupPrismaMock('guest', 'findUnique', null)

        const mockGuest = createMockGuest({
          id: 'new-guest-1',
          name: 'Test Guest',
          email: 'test@example.com',
          status: 'ATTENDING',
          eventId: 'event-1',
          additionalGuests: [
            createMockAdditionalGuest({ id: 'ag-1', name: 'Guest 1' }),
            createMockAdditionalGuest({ id: 'ag-2', name: 'Guest 2' }),
          ],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'create', mockGuest)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Test Guest',
            email: 'test@example.com',
            status: 'ATTENDING',
            additionalGuests: ['Guest 1', 'Guest 2'], // 3 total = limit of 3
          },
        })

        const response = await POST(request)
        expect(response.status).toBe(200)
      })

      it('should use per-guest limit override instead of global limit', async () => {
        const limitedEvent = { ...mockEvent, maxGuestsPerInvitee: 2 }
        setupPrismaMock('event', 'findUnique', limitedEvent)

        // Existing guest with higher per-guest limit
        const existingGuest = createMockGuest({
          id: 'existing-guest-1',
          name: 'VIP Guest',
          email: 'vip@example.com',
          status: 'PENDING',
          eventId: 'event-1',
          maxGuests: 5, // Per-guest override: allows 5 total guests
          additionalGuests: [],
        })
        setupPrismaMock('guest', 'findUnique', existingGuest)
        setupPrismaMock('additionalGuest', 'deleteMany', { count: 0 })

        const updatedGuest = {
          ...existingGuest,
          status: 'ATTENDING',
          additionalGuests: [
            createMockAdditionalGuest({ id: 'ag-1', name: 'Guest 1' }),
            createMockAdditionalGuest({ id: 'ag-2', name: 'Guest 2' }),
            createMockAdditionalGuest({ id: 'ag-3', name: 'Guest 3' }),
          ],
        }
        setupPrismaMock('guest', 'update', updatedGuest)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'VIP Guest',
            email: 'vip@example.com',
            status: 'ATTENDING',
            additionalGuests: ['Guest 1', 'Guest 2', 'Guest 3'], // 4 total, exceeds global but within per-guest limit
          },
        })

        const response = await POST(request)
        expect(response.status).toBe(200)
      })

      it('should allow unlimited guests when maxGuestsPerInvitee is null', async () => {
        const unlimitedEvent = { ...mockEvent, maxGuestsPerInvitee: null }
        setupPrismaMock('event', 'findUnique', unlimitedEvent)
        setupPrismaMock('guest', 'findUnique', null)

        const mockGuest = createMockGuest({
          id: 'new-guest-1',
          name: 'Test Guest',
          email: 'test@example.com',
          status: 'ATTENDING',
          eventId: 'event-1',
          additionalGuests: [
            createMockAdditionalGuest({ id: 'ag-1', name: 'Guest 1' }),
            createMockAdditionalGuest({ id: 'ag-2', name: 'Guest 2' }),
            createMockAdditionalGuest({ id: 'ag-3', name: 'Guest 3' }),
            createMockAdditionalGuest({ id: 'ag-4', name: 'Guest 4' }),
            createMockAdditionalGuest({ id: 'ag-5', name: 'Guest 5' }),
          ],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'create', mockGuest)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Test Guest',
            email: 'test@example.com',
            status: 'ATTENDING',
            additionalGuests: ['Guest 1', 'Guest 2', 'Guest 3', 'Guest 4', 'Guest 5'],
          },
        })

        const response = await POST(request)
        expect(response.status).toBe(200)
      })

      it('should not validate guest limit for NOT_ATTENDING status', async () => {
        const limitedEvent = { ...mockEvent, maxGuestsPerInvitee: 1 }
        setupPrismaMock('event', 'findUnique', limitedEvent)
        setupPrismaMock('guest', 'findUnique', null)

        const mockGuest = createMockGuest({
          id: 'new-guest-1',
          name: 'Test Guest',
          email: 'test@example.com',
          status: 'NOT_ATTENDING',
          eventId: 'event-1',
          additionalGuests: [],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'create', mockGuest)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Test Guest',
            email: 'test@example.com',
            status: 'NOT_ATTENDING',
            additionalGuests: ['Guest 1', 'Guest 2'], // Would exceed limit if ATTENDING
          },
        })

        const response = await POST(request)
        expect(response.status).toBe(200)
      })
    })

    describe('Additional guest management', () => {
      it('should add additional guests when ATTENDING', async () => {
        setupPrismaMock('event', 'findUnique', mockEvent)
        setupPrismaMock('guest', 'findUnique', null)

        const mockGuest = createMockGuest({
          id: 'new-guest-1',
          name: 'Test Guest',
          email: 'test@example.com',
          status: 'ATTENDING',
          eventId: 'event-1',
          additionalGuests: [
            createMockAdditionalGuest({ id: 'ag-1', name: 'Plus One' }),
          ],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'create', mockGuest)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Test Guest',
            email: 'test@example.com',
            status: 'ATTENDING',
            additionalGuests: ['Plus One'],
          },
        })

        const response = await POST(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest.additionalGuests).toHaveLength(1)
        expect(body.guest.additionalGuests[0].name).toBe('Plus One')
      })

      it('should filter out whitespace-only additional guest names', async () => {
        setupPrismaMock('event', 'findUnique', mockEvent)
        setupPrismaMock('guest', 'findUnique', null)

        const mockGuest = createMockGuest({
          id: 'new-guest-1',
          name: 'Test Guest',
          email: 'test@example.com',
          status: 'ATTENDING',
          eventId: 'event-1',
          additionalGuests: [
            createMockAdditionalGuest({ id: 'ag-1', name: 'Valid Guest' }),
          ],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'create', mockGuest)

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Test Guest',
            email: 'test@example.com',
            status: 'ATTENDING',
            // Whitespace strings pass min(1) validation but get trimmed and filtered
            additionalGuests: ['Valid Guest', '   ', ' \t ', '  '],
          },
        })

        const response = await POST(request)
        expect(response.status).toBe(200)
      })

      it('should not add additional guests when NOT_ATTENDING', async () => {
        setupPrismaMock('event', 'findUnique', mockEvent)
        setupPrismaMock('guest', 'findUnique', null)

        const mockGuest = createMockGuest({
          id: 'new-guest-1',
          name: 'Test Guest',
          email: 'test@example.com',
          status: 'NOT_ATTENDING',
          eventId: 'event-1',
          additionalGuests: [],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'create', mockGuest)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Test Guest',
            email: 'test@example.com',
            status: 'NOT_ATTENDING',
            additionalGuests: ['Plus One'], // Should be ignored
          },
        })

        const response = await POST(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest.additionalGuests).toHaveLength(0)
      })
    })

    describe('Email notifications', () => {
      it('should send confirmation email to guest', async () => {
        setupPrismaMock('event', 'findUnique', mockEvent)
        setupPrismaMock('guest', 'findUnique', null)

        const mockGuest = createMockGuest({
          id: 'new-guest-1',
          name: 'Test Guest',
          email: 'test@example.com',
          status: 'ATTENDING',
          eventId: 'event-1',
          additionalGuests: [],
          notifyByEmail: true,
          token: 'guest-token-123',
        })
        setupPrismaMock('guest', 'create', mockGuest)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Test Guest',
            email: 'test@example.com',
            status: 'ATTENDING',
          },
        })

        await POST(request)

        expect(sendConfirmation).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'test@example.com',
            guestName: 'Test Guest',
            status: 'ATTENDING',
            rsvpToken: 'guest-token-123',
          })
        )
      })

      it('should notify hosts about new RSVP', async () => {
        setupPrismaMock('event', 'findUnique', mockEvent)
        setupPrismaMock('guest', 'findUnique', null)

        const mockGuest = createMockGuest({
          id: 'new-guest-1',
          name: 'Test Guest',
          email: 'test@example.com',
          status: 'ATTENDING',
          eventId: 'event-1',
          additionalGuests: [],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'create', mockGuest)

        const hostInfo = [{ id: 'host-1', name: 'Event Host', email: 'host@example.com' }]
        vi.mocked(getEventHostsForNotification).mockResolvedValue(hostInfo)

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Test Guest',
            email: 'test@example.com',
            status: 'ATTENDING',
          },
        })

        await POST(request)

        // Wait for async host notification
        await new Promise((resolve) => setTimeout(resolve, 100))

        expect(getEventHostsForNotification).toHaveBeenCalledWith('event-1')
      })

      it('should not send email when notifyByEmail is false', async () => {
        setupPrismaMock('event', 'findUnique', mockEvent)
        setupPrismaMock('guest', 'findUnique', null)

        const mockGuest = createMockGuest({
          id: 'new-guest-1',
          name: 'Test Guest',
          email: 'test@example.com',
          status: 'ATTENDING',
          eventId: 'event-1',
          additionalGuests: [],
          notifyByEmail: false, // Opt out of email notifications
        })
        setupPrismaMock('guest', 'create', mockGuest)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Test Guest',
            email: 'test@example.com',
            status: 'ATTENDING',
          },
        })

        await POST(request)

        expect(sendConfirmation).not.toHaveBeenCalled()
      })
    })

    describe('Error handling', () => {
      it('should handle database errors gracefully', async () => {
        setupPrismaMock('event', 'findUnique', mockEvent)
        setupPrismaMock('guest', 'findUnique', null)
        vi.mocked(prisma.guest.create).mockRejectedValue(new Error('Database error'))

        const request = createMockRequest('POST', '/api/rsvp', {
          body: {
            eventId: 'event-1',
            name: 'Test Guest',
            email: 'test@example.com',
            status: 'ATTENDING',
          },
        })

        const response = await POST(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(500)
        expect(body.error).toBe('Failed to submit RSVP')
      })
    })
  })

  // ===========================================
  // GET /api/rsvp/[token] - Get guest by token
  // ===========================================
  describe('GET /api/rsvp/[token] - Get guest by token', () => {
    it('should return guest information for valid token', async () => {
      const mockEvent = createMockEvent({
        id: 'event-1',
        title: 'Test Event',
        rsvpDeadline: new Date('2099-12-31'),
      })
      const mockGuest = createMockGuest({
        id: 'guest-1',
        name: 'Test Guest',
        email: 'test@example.com',
        status: 'ATTENDING',
        token: 'valid-token-123',
        event: mockEvent,
        additionalGuests: [],
      })
      setupPrismaMock('guest', 'findUnique', mockGuest)

      const request = createMockRequest('GET', '/api/rsvp/valid-token-123')
      const context = createMockRouteContext({ token: 'valid-token-123' })

      const response = await GET(request, context)
      const body = await parseJsonResponse(response)

      expect(response.status).toBe(200)
      expect(body.guest).toBeDefined()
      expect(body.guest.token).toBe('valid-token-123')
      expect(body.deadlinePassed).toBe(false)
    })

    it('should return 404 for invalid token', async () => {
      setupPrismaMock('guest', 'findUnique', null)

      const request = createMockRequest('GET', '/api/rsvp/invalid-token')
      const context = createMockRouteContext({ token: 'invalid-token' })

      const response = await GET(request, context)
      const body = await parseJsonResponse(response)

      expect(response.status).toBe(404)
      expect(body.error).toBe('RSVP not found')
    })

    it('should indicate when RSVP deadline has passed', async () => {
      const mockEvent = createMockEvent({
        id: 'event-1',
        title: 'Test Event',
        rsvpDeadline: new Date('2020-01-01'), // Past deadline
      })
      const mockGuest = createMockGuest({
        id: 'guest-1',
        token: 'valid-token-123',
        event: mockEvent,
        additionalGuests: [],
      })
      setupPrismaMock('guest', 'findUnique', mockGuest)

      const request = createMockRequest('GET', '/api/rsvp/valid-token-123')
      const context = createMockRouteContext({ token: 'valid-token-123' })

      const response = await GET(request, context)
      const body = await parseJsonResponse(response)

      expect(response.status).toBe(200)
      expect(body.deadlinePassed).toBe(true)
    })

    it('should return deadlinePassed as falsy when no deadline is set', async () => {
      const mockEvent = createMockEvent({
        id: 'event-1',
        title: 'Test Event',
        rsvpDeadline: null,
      })
      const mockGuest = createMockGuest({
        id: 'guest-1',
        token: 'valid-token-123',
        event: mockEvent,
        additionalGuests: [],
      })
      setupPrismaMock('guest', 'findUnique', mockGuest)

      const request = createMockRequest('GET', '/api/rsvp/valid-token-123')
      const context = createMockRouteContext({ token: 'valid-token-123' })

      const response = await GET(request, context)
      const body = await parseJsonResponse(response)

      expect(response.status).toBe(200)
      // When no deadline is set, deadlinePassed is falsy (null or false)
      expect(body.deadlinePassed).toBeFalsy()
    })

    it('should include additional guests in response', async () => {
      const mockEvent = createMockEvent({ id: 'event-1', rsvpDeadline: null })
      const mockGuest = createMockGuest({
        id: 'guest-1',
        token: 'valid-token-123',
        event: mockEvent,
        additionalGuests: [
          createMockAdditionalGuest({ id: 'ag-1', name: 'Plus One' }),
          createMockAdditionalGuest({ id: 'ag-2', name: 'Plus Two' }),
        ],
      })
      setupPrismaMock('guest', 'findUnique', mockGuest)

      const request = createMockRequest('GET', '/api/rsvp/valid-token-123')
      const context = createMockRouteContext({ token: 'valid-token-123' })

      const response = await GET(request, context)
      const body = await parseJsonResponse(response)

      expect(response.status).toBe(200)
      expect(body.guest.additionalGuests).toHaveLength(2)
    })

    it('should handle database errors gracefully', async () => {
      vi.mocked(prisma.guest.findUnique).mockRejectedValue(new Error('Database error'))

      const request = createMockRequest('GET', '/api/rsvp/valid-token-123')
      const context = createMockRouteContext({ token: 'valid-token-123' })

      const response = await GET(request, context)
      const body = await parseJsonResponse(response)

      expect(response.status).toBe(500)
      expect(body.error).toBe('Failed to fetch RSVP')
    })
  })

  // ===========================================
  // PATCH /api/rsvp/[token] - Update RSVP by token
  // ===========================================
  describe('PATCH /api/rsvp/[token] - Update RSVP by token', () => {
    const mockHost = createMockUser({ id: 'host-1', name: 'Event Host' })
    const mockEvent = createMockEvent({
      id: 'event-1',
      title: 'Test Event',
      hostId: 'host-1',
      maxGuestsPerInvitee: 3,
      rsvpDeadline: new Date('2099-12-31'),
      host: mockHost,
      coHosts: [],
    })

    describe('Validation', () => {
      it('should return 404 for invalid token', async () => {
        setupPrismaMock('guest', 'findUnique', null)

        const request = createMockRequest('PATCH', '/api/rsvp/invalid-token', {
          body: { status: 'ATTENDING' },
        })
        const context = createMockRouteContext({ token: 'invalid-token' })

        const response = await PATCH(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(404)
        expect(body.error).toBe('RSVP not found')
      })

      it('should reject update when RSVP deadline has passed', async () => {
        const mockGuest = createMockGuest({
          id: 'guest-1',
          token: 'valid-token-123',
          eventId: 'event-1',
          event: { ...mockEvent, rsvpDeadline: new Date('2020-01-01') },
          additionalGuests: [],
        })
        setupPrismaMock('guest', 'findUnique', mockGuest)

        const request = createMockRequest('PATCH', '/api/rsvp/valid-token-123', {
          body: { status: 'ATTENDING' },
        })
        const context = createMockRouteContext({ token: 'valid-token-123' })

        const response = await PATCH(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBe('The RSVP deadline for this event has passed')
      })

      it('should reject update with invalid status', async () => {
        const mockGuest = createMockGuest({
          id: 'guest-1',
          token: 'valid-token-123',
          event: mockEvent,
          additionalGuests: [],
        })
        setupPrismaMock('guest', 'findUnique', mockGuest)

        const request = createMockRequest('PATCH', '/api/rsvp/valid-token-123', {
          body: { status: 'INVALID' },
        })
        const context = createMockRouteContext({ token: 'valid-token-123' })

        const response = await PATCH(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBeDefined()
      })
    })

    describe('Status updates', () => {
      it('should update status from PENDING to ATTENDING', async () => {
        const mockGuest = createMockGuest({
          id: 'guest-1',
          token: 'valid-token-123',
          status: 'PENDING',
          eventId: 'event-1',
          event: mockEvent,
          additionalGuests: [],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'findUnique', mockGuest)
        setupPrismaMock('additionalGuest', 'deleteMany', { count: 0 })

        const updatedGuest = { ...mockGuest, status: 'ATTENDING', event: mockEvent }
        setupPrismaMock('guest', 'update', updatedGuest)
        setupPrismaMock('event', 'findUnique', mockEvent)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('PATCH', '/api/rsvp/valid-token-123', {
          body: { status: 'ATTENDING' },
        })
        const context = createMockRouteContext({ token: 'valid-token-123' })

        const response = await PATCH(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest.status).toBe('ATTENDING')
      })

      it('should update status from ATTENDING to NOT_ATTENDING', async () => {
        const mockGuest = createMockGuest({
          id: 'guest-1',
          token: 'valid-token-123',
          status: 'ATTENDING',
          eventId: 'event-1',
          event: mockEvent,
          additionalGuests: [],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'findUnique', mockGuest)

        const updatedGuest = { ...mockGuest, status: 'NOT_ATTENDING', event: mockEvent }
        setupPrismaMock('guest', 'update', updatedGuest)
        setupPrismaMock('event', 'findUnique', mockEvent)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('PATCH', '/api/rsvp/valid-token-123', {
          body: { status: 'NOT_ATTENDING' },
        })
        const context = createMockRouteContext({ token: 'valid-token-123' })

        const response = await PATCH(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest.status).toBe('NOT_ATTENDING')
      })

      it('should update status to MAYBE', async () => {
        const mockGuest = createMockGuest({
          id: 'guest-1',
          token: 'valid-token-123',
          status: 'ATTENDING',
          eventId: 'event-1',
          event: mockEvent,
          additionalGuests: [],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'findUnique', mockGuest)

        const updatedGuest = { ...mockGuest, status: 'MAYBE', event: mockEvent }
        setupPrismaMock('guest', 'update', updatedGuest)
        setupPrismaMock('event', 'findUnique', mockEvent)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('PATCH', '/api/rsvp/valid-token-123', {
          body: { status: 'MAYBE' },
        })
        const context = createMockRouteContext({ token: 'valid-token-123' })

        const response = await PATCH(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest.status).toBe('MAYBE')
      })
    })

    describe('Guest limit validation on update', () => {
      it('should reject update when additional guests exceed limit', async () => {
        const limitedEvent = { ...mockEvent, maxGuestsPerInvitee: 2 }
        const mockGuest = createMockGuest({
          id: 'guest-1',
          token: 'valid-token-123',
          status: 'PENDING',
          eventId: 'event-1',
          event: limitedEvent,
          additionalGuests: [],
        })
        setupPrismaMock('guest', 'findUnique', mockGuest)

        const request = createMockRequest('PATCH', '/api/rsvp/valid-token-123', {
          body: {
            status: 'ATTENDING',
            additionalGuests: ['Guest 1', 'Guest 2', 'Guest 3'], // 4 total > limit of 2
          },
        })
        const context = createMockRouteContext({ token: 'valid-token-123' })

        const response = await PATCH(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toContain('additional guest')
      })

      it('should use per-guest limit override on update', async () => {
        const limitedEvent = { ...mockEvent, maxGuestsPerInvitee: 2 }
        const mockGuest = createMockGuest({
          id: 'guest-1',
          token: 'valid-token-123',
          status: 'PENDING',
          eventId: 'event-1',
          maxGuests: 5, // Per-guest override
          event: limitedEvent,
          additionalGuests: [],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'findUnique', mockGuest)
        setupPrismaMock('additionalGuest', 'deleteMany', { count: 0 })

        const updatedGuest = {
          ...mockGuest,
          status: 'ATTENDING',
          event: limitedEvent,
          additionalGuests: [
            createMockAdditionalGuest({ id: 'ag-1', name: 'Guest 1' }),
            createMockAdditionalGuest({ id: 'ag-2', name: 'Guest 2' }),
            createMockAdditionalGuest({ id: 'ag-3', name: 'Guest 3' }),
          ],
        }
        setupPrismaMock('guest', 'update', updatedGuest)
        setupPrismaMock('event', 'findUnique', limitedEvent)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('PATCH', '/api/rsvp/valid-token-123', {
          body: {
            status: 'ATTENDING',
            additionalGuests: ['Guest 1', 'Guest 2', 'Guest 3'], // 4 total, within per-guest limit
          },
        })
        const context = createMockRouteContext({ token: 'valid-token-123' })

        const response = await PATCH(request, context)
        expect(response.status).toBe(200)
      })
    })

    describe('Additional guest management on update', () => {
      it('should replace additional guests on update', async () => {
        const mockGuest = createMockGuest({
          id: 'guest-1',
          token: 'valid-token-123',
          status: 'ATTENDING',
          eventId: 'event-1',
          event: mockEvent,
          additionalGuests: [createMockAdditionalGuest({ id: 'ag-1', name: 'Old Guest' })],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'findUnique', mockGuest)
        setupPrismaMock('additionalGuest', 'deleteMany', { count: 1 })

        const updatedGuest = {
          ...mockGuest,
          event: mockEvent,
          additionalGuests: [createMockAdditionalGuest({ id: 'ag-2', name: 'New Guest' })],
        }
        setupPrismaMock('guest', 'update', updatedGuest)
        setupPrismaMock('event', 'findUnique', mockEvent)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('PATCH', '/api/rsvp/valid-token-123', {
          body: { additionalGuests: ['New Guest'] },
        })
        const context = createMockRouteContext({ token: 'valid-token-123' })

        const response = await PATCH(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest.additionalGuests[0].name).toBe('New Guest')
        expect(prisma.additionalGuest.deleteMany).toHaveBeenCalledWith({
          where: { guestId: 'guest-1' },
        })
      })
    })

    describe('Other field updates', () => {
      it('should update name', async () => {
        const mockGuest = createMockGuest({
          id: 'guest-1',
          token: 'valid-token-123',
          name: 'Old Name',
          status: 'ATTENDING',
          eventId: 'event-1',
          event: mockEvent,
          additionalGuests: [],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'findUnique', mockGuest)

        const updatedGuest = { ...mockGuest, name: 'New Name', event: mockEvent }
        setupPrismaMock('guest', 'update', updatedGuest)
        setupPrismaMock('event', 'findUnique', mockEvent)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('PATCH', '/api/rsvp/valid-token-123', {
          body: { name: 'New Name' },
        })
        const context = createMockRouteContext({ token: 'valid-token-123' })

        const response = await PATCH(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest.name).toBe('New Name')
      })

      it('should update phone number', async () => {
        const mockGuest = createMockGuest({
          id: 'guest-1',
          token: 'valid-token-123',
          phone: null,
          status: 'ATTENDING',
          eventId: 'event-1',
          event: mockEvent,
          additionalGuests: [],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'findUnique', mockGuest)

        const updatedGuest = { ...mockGuest, phone: '+1234567890', event: mockEvent }
        setupPrismaMock('guest', 'update', updatedGuest)
        setupPrismaMock('event', 'findUnique', mockEvent)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('PATCH', '/api/rsvp/valid-token-123', {
          body: { phone: '+1234567890' },
        })
        const context = createMockRouteContext({ token: 'valid-token-123' })

        const response = await PATCH(request, context)
        expect(response.status).toBe(200)
      })

      it('should update dietary notes', async () => {
        const mockGuest = createMockGuest({
          id: 'guest-1',
          token: 'valid-token-123',
          dietaryNotes: null,
          status: 'ATTENDING',
          eventId: 'event-1',
          event: mockEvent,
          additionalGuests: [],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'findUnique', mockGuest)

        const updatedGuest = { ...mockGuest, dietaryNotes: 'Gluten-free', event: mockEvent }
        setupPrismaMock('guest', 'update', updatedGuest)
        setupPrismaMock('event', 'findUnique', mockEvent)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('PATCH', '/api/rsvp/valid-token-123', {
          body: { dietaryNotes: 'Gluten-free' },
        })
        const context = createMockRouteContext({ token: 'valid-token-123' })

        const response = await PATCH(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest.dietaryNotes).toBe('Gluten-free')
      })
    })

    describe('Email notifications on update', () => {
      it('should send confirmation email on status change', async () => {
        const mockGuest = createMockGuest({
          id: 'guest-1',
          token: 'valid-token-123',
          email: 'test@example.com',
          name: 'Test Guest',
          status: 'PENDING',
          eventId: 'event-1',
          event: mockEvent,
          additionalGuests: [],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'findUnique', mockGuest)

        const updatedGuest = { ...mockGuest, status: 'ATTENDING', event: mockEvent }
        setupPrismaMock('guest', 'update', updatedGuest)
        setupPrismaMock('event', 'findUnique', mockEvent)
        vi.mocked(getEventHostsForNotification).mockResolvedValue([])

        const request = createMockRequest('PATCH', '/api/rsvp/valid-token-123', {
          body: { status: 'ATTENDING' },
        })
        const context = createMockRouteContext({ token: 'valid-token-123' })

        await PATCH(request, context)

        expect(sendConfirmation).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'test@example.com',
            status: 'ATTENDING',
          })
        )
      })

      it('should notify hosts about RSVP status change', async () => {
        const mockGuest = createMockGuest({
          id: 'guest-1',
          token: 'valid-token-123',
          email: 'test@example.com',
          status: 'ATTENDING',
          eventId: 'event-1',
          event: mockEvent,
          additionalGuests: [],
          notifyByEmail: true,
        })
        setupPrismaMock('guest', 'findUnique', mockGuest)

        const updatedGuest = { ...mockGuest, status: 'NOT_ATTENDING', event: mockEvent }
        setupPrismaMock('guest', 'update', updatedGuest)
        setupPrismaMock('event', 'findUnique', mockEvent)

        const hostInfo = [{ id: 'host-1', name: 'Event Host', email: 'host@example.com' }]
        vi.mocked(getEventHostsForNotification).mockResolvedValue(hostInfo)

        const request = createMockRequest('PATCH', '/api/rsvp/valid-token-123', {
          body: { status: 'NOT_ATTENDING' },
        })
        const context = createMockRouteContext({ token: 'valid-token-123' })

        await PATCH(request, context)

        // Wait for async notification
        await new Promise((resolve) => setTimeout(resolve, 100))

        expect(getEventHostsForNotification).toHaveBeenCalledWith('event-1')
      })
    })

    describe('Error handling', () => {
      it('should handle database errors gracefully', async () => {
        vi.mocked(prisma.guest.findUnique).mockRejectedValue(new Error('Database error'))

        const request = createMockRequest('PATCH', '/api/rsvp/valid-token-123', {
          body: { status: 'ATTENDING' },
        })
        const context = createMockRouteContext({ token: 'valid-token-123' })

        const response = await PATCH(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(500)
        expect(body.error).toBe('Failed to update RSVP')
      })
    })
  })

  // ===========================================
  // POST /api/rsvp/send-edit-link - Send edit link
  // ===========================================
  describe('POST /api/rsvp/send-edit-link - Send edit link', () => {
    describe('Validation', () => {
      it('should reject request with invalid email', async () => {
        const request = createMockRequest('POST', '/api/rsvp/send-edit-link', {
          body: { email: 'invalid-email', eventId: 'event-1' },
        })

        const response = await sendEditLink(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBe('Invalid email address')
      })

      it('should reject request with missing eventId', async () => {
        const request = createMockRequest('POST', '/api/rsvp/send-edit-link', {
          body: { email: 'test@example.com' },
        })

        const response = await sendEditLink(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBeDefined()
      })
    })

    describe('Security - Email enumeration prevention', () => {
      it('should return success even when guest does not exist', async () => {
        setupPrismaMock('guest', 'findUnique', null)

        const request = createMockRequest('POST', '/api/rsvp/send-edit-link', {
          body: { email: 'nonexistent@example.com', eventId: 'event-1' },
        })

        const response = await sendEditLink(request)
        const body = await parseJsonResponse(response)

        // Should not reveal if email exists
        expect(response.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toContain('If an RSVP exists')
      })

      it('should return same response for existing and non-existing emails', async () => {
        // Test non-existing email
        setupPrismaMock('guest', 'findUnique', null)

        const request1 = createMockRequest('POST', '/api/rsvp/send-edit-link', {
          body: { email: 'nonexistent@example.com', eventId: 'event-1' },
        })

        const response1 = await sendEditLink(request1)
        const body1 = await parseJsonResponse(response1)

        // Reset mocks and test existing email
        vi.clearAllMocks()

        const mockEvent = createMockEvent({ id: 'event-1' })
        const mockGuest = createMockGuest({
          id: 'guest-1',
          email: 'existing@example.com',
          token: 'guest-token',
          event: mockEvent,
        })
        setupPrismaMock('guest', 'findUnique', mockGuest)

        const request2 = createMockRequest('POST', '/api/rsvp/send-edit-link', {
          body: { email: 'existing@example.com', eventId: 'event-1' },
        })

        const response2 = await sendEditLink(request2)
        const body2 = await parseJsonResponse(response2)

        // Both responses should be identical
        expect(response1.status).toBe(response2.status)
        expect(body1.success).toBe(body2.success)
        expect(body1.message).toBe(body2.message)
      })
    })

    describe('Successful edit link sending', () => {
      it('should send edit link email for existing guest', async () => {
        const mockEvent = createMockEvent({
          id: 'event-1',
          title: 'Test Event',
          date: new Date('2024-12-25'),
          location: 'Test Location',
        })
        const mockGuest = createMockGuest({
          id: 'guest-1',
          name: 'Test Guest',
          email: 'test@example.com',
          token: 'guest-token-123',
          event: mockEvent,
        })
        setupPrismaMock('guest', 'findUnique', mockGuest)

        const request = createMockRequest('POST', '/api/rsvp/send-edit-link', {
          body: { email: 'test@example.com', eventId: 'event-1' },
        })

        const response = await sendEditLink(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.success).toBe(true)
      })
    })

    describe('Email service unavailability', () => {
      it('should return success even when email service is not configured', async () => {
        // Mock email config to return null (no email service)
        vi.mocked(getEmailConfig).mockResolvedValueOnce(null)

        // Also ensure env vars are not set for this test
        const originalSmtpHost = process.env.SMTP_HOST
        const originalSmtpUser = process.env.SMTP_USER
        const originalSmtpPassword = process.env.SMTP_PASSWORD
        delete process.env.SMTP_HOST
        delete process.env.SMTP_USER
        delete process.env.SMTP_PASSWORD

        const mockEvent = createMockEvent({ id: 'event-1' })
        const mockGuest = createMockGuest({
          id: 'guest-1',
          email: 'test@example.com',
          token: 'guest-token-123',
          event: mockEvent,
        })
        setupPrismaMock('guest', 'findUnique', mockGuest)

        const request = createMockRequest('POST', '/api/rsvp/send-edit-link', {
          body: { email: 'test@example.com', eventId: 'event-1' },
        })

        const response = await sendEditLink(request)
        const body = await parseJsonResponse(response)

        // Restore env vars
        process.env.SMTP_HOST = originalSmtpHost
        process.env.SMTP_USER = originalSmtpUser
        process.env.SMTP_PASSWORD = originalSmtpPassword

        // Should not reveal email service status
        expect(response.status).toBe(200)
        expect(body.success).toBe(true)
      })
    })

    describe('Error handling', () => {
      it('should handle database errors gracefully', async () => {
        vi.mocked(prisma.guest.findUnique).mockRejectedValue(new Error('Database error'))

        const request = createMockRequest('POST', '/api/rsvp/send-edit-link', {
          body: { email: 'test@example.com', eventId: 'event-1' },
        })

        const response = await sendEditLink(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(500)
        expect(body.error).toBe('Failed to send edit link')
      })
    })
  })
})
