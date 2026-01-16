import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import {
  createMockUser,
  createMockEvent,
  createMockGuest,
} from '../setup'
import { auth } from '@/auth'

// Mock the event-access module
vi.mock('@/lib/event-access', () => ({
  canManageEvent: vi.fn(),
}))

// Define session mocking functions that use the already-mocked auth
function mockSession(user: { id: string; email: string; role: string; name?: string }) {
  vi.mocked(auth).mockResolvedValue({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name || 'Test User',
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  })
}

function mockNoSession() {
  vi.mocked(auth).mockResolvedValue(null)
}

// Mock the email module
vi.mock('@/lib/email', () => ({
  sendInvitation: vi.fn().mockResolvedValue(undefined),
}))

// Mock the rsvp-validation module
vi.mock('@/lib/rsvp-validation', () => ({
  validateGuestLimit: vi.fn().mockReturnValue({ valid: true, remaining: 5 }),
}))

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// Import route handlers after mocks are set up
import { POST as addGuest } from '@/app/api/events/[id]/guests/route'
import { PATCH as updateGuest, DELETE as deleteGuest } from '@/app/api/events/[id]/guests/[guestId]/route'
import { POST as sendInvite } from '@/app/api/events/[id]/guests/[guestId]/invite/route'
import { POST as importGuests } from '@/app/api/events/[id]/guests/import/route'

// Import mocked modules for assertions
import { canManageEvent } from '@/lib/event-access'
import { sendInvitation } from '@/lib/email'
import { validateGuestLimit } from '@/lib/rsvp-validation'
import { prisma } from '@/lib/prisma'

// Helper functions
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

function createMockRouteContext(params: Record<string, string>) {
  return { params: Promise.resolve(params) }
}

async function parseJsonResponse(response: Response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function setupPrismaMock(
  model: string,
  method: string,
  returnValue: unknown
) {
  const modelMock = (prisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>)[model]
  if (modelMock && modelMock[method]) {
    modelMock[method].mockResolvedValue(returnValue)
  }
}

describe('Guest Management API Routes', () => {
  const mockUser = createMockUser({ id: 'user-1', role: 'USER' })
  const mockAdmin = createMockUser({ id: 'admin-1', role: 'ADMIN' })
  const mockEvent = createMockEvent({ id: 'event-1', hostId: 'user-1' })
  const mockGuestData = createMockGuest({ id: 'guest-1', eventId: 'event-1', email: 'guest@example.com' })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ====================
  // POST /api/events/[id]/guests - Add Guest
  // ====================
  describe('POST /api/events/[id]/guests (Add Guest)', () => {
    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockNoSession()

        const request = createMockRequest('POST', '/api/events/event-1/guests', {
          body: { email: 'newguest@example.com' },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await addGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(401)
        expect(body.error).toBe('Unauthorized')
      })
    })

    describe('Authorization', () => {
      it('should return 404 when user cannot manage event', async () => {
        mockSession({ id: 'user-2', email: 'other@example.com', role: 'USER' })
        vi.mocked(canManageEvent).mockResolvedValue(false)

        const request = createMockRequest('POST', '/api/events/event-1/guests', {
          body: { email: 'newguest@example.com' },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await addGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(404)
        expect(body.error).toBe('Event not found')
      })

      it('should allow host to add guest', async () => {
        mockSession({ id: 'user-1', email: mockUser.email, role: 'USER' })
        vi.mocked(canManageEvent).mockResolvedValue(true)
        setupPrismaMock('event', 'findUnique', { ...mockEvent, host: { name: 'Test Host' } })
        setupPrismaMock('guest', 'findUnique', null) // No existing guest
        setupPrismaMock('guest', 'create', { ...mockGuestData, email: 'newguest@example.com' })

        const request = createMockRequest('POST', '/api/events/event-1/guests', {
          body: { email: 'newguest@example.com', name: 'New Guest' },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await addGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest).toBeDefined()
      })

      it('should allow co-host to add guest', async () => {
        mockSession({ id: 'user-2', email: 'cohost@example.com', role: 'USER' })
        vi.mocked(canManageEvent).mockResolvedValue(true) // Co-host has access
        setupPrismaMock('event', 'findUnique', { ...mockEvent, host: { name: 'Test Host' } })
        setupPrismaMock('guest', 'findUnique', null)
        setupPrismaMock('guest', 'create', { ...mockGuestData, email: 'newguest@example.com' })

        const request = createMockRequest('POST', '/api/events/event-1/guests', {
          body: { email: 'newguest@example.com' },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await addGuest(request, context)

        expect(response.status).toBe(200)
        expect(canManageEvent).toHaveBeenCalledWith('user-2', 'event-1')
      })

      it('should allow admin to add guest to any event', async () => {
        mockSession({ id: 'admin-1', email: mockAdmin.email, role: 'ADMIN' })
        vi.mocked(canManageEvent).mockResolvedValue(true)
        setupPrismaMock('event', 'findUnique', { ...mockEvent, host: { name: 'Test Host' } })
        setupPrismaMock('guest', 'findUnique', null)
        setupPrismaMock('guest', 'create', mockGuestData)

        const request = createMockRequest('POST', '/api/events/event-1/guests', {
          body: { email: 'newguest@example.com' },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await addGuest(request, context)

        expect(response.status).toBe(200)
      })
    })

    describe('Validation', () => {
      beforeEach(() => {
        mockSession({ id: 'user-1', email: mockUser.email, role: 'USER' })
        vi.mocked(canManageEvent).mockResolvedValue(true)
        setupPrismaMock('event', 'findUnique', { ...mockEvent, host: { name: 'Test Host' } })
      })

      it('should return 400 for invalid email', async () => {
        const request = createMockRequest('POST', '/api/events/event-1/guests', {
          body: { email: 'not-an-email' },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await addGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBe('Invalid email address')
      })

      it('should return 400 when guest already exists', async () => {
        setupPrismaMock('guest', 'findUnique', mockGuestData) // Guest already exists

        const request = createMockRequest('POST', '/api/events/event-1/guests', {
          body: { email: 'guest@example.com' },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await addGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBe('This guest has already been added')
      })

      it('should return 404 when event does not exist', async () => {
        vi.mocked(canManageEvent).mockResolvedValue(true)
        setupPrismaMock('event', 'findUnique', null)

        const request = createMockRequest('POST', '/api/events/event-1/guests', {
          body: { email: 'newguest@example.com' },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await addGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(404)
        expect(body.error).toBe('Event not found')
      })
    })

    describe('Guest Creation', () => {
      beforeEach(() => {
        mockSession({ id: 'user-1', email: mockUser.email, role: 'USER' })
        vi.mocked(canManageEvent).mockResolvedValue(true)
        setupPrismaMock('event', 'findUnique', { ...mockEvent, host: { name: 'Test Host' } })
        setupPrismaMock('guest', 'findUnique', null)
      })

      it('should create guest with required fields only', async () => {
        const newGuest = { ...mockGuestData, email: 'minimal@example.com', name: null, phone: null }
        setupPrismaMock('guest', 'create', newGuest)

        const request = createMockRequest('POST', '/api/events/event-1/guests', {
          body: { email: 'minimal@example.com' },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await addGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest.email).toBe('minimal@example.com')
        expect(prisma.guest.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              eventId: 'event-1',
              email: 'minimal@example.com',
              notifyByEmail: true,
            }),
          })
        )
      })

      it('should create guest with all optional fields', async () => {
        const newGuest = {
          ...mockGuestData,
          email: 'full@example.com',
          name: 'Full Name',
          phone: '+1234567890',
        }
        setupPrismaMock('guest', 'create', newGuest)

        const request = createMockRequest('POST', '/api/events/event-1/guests', {
          body: {
            email: 'full@example.com',
            name: 'Full Name',
            phone: '+1234567890',
            notifyByEmail: true,
          },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await addGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest.name).toBe('Full Name')
        expect(body.guest.phone).toBe('+1234567890')
      })
    })

    describe('Invitation Sending', () => {
      beforeEach(() => {
        mockSession({ id: 'user-1', email: mockUser.email, role: 'USER' })
        vi.mocked(canManageEvent).mockResolvedValue(true)
        setupPrismaMock('event', 'findUnique', { ...mockEvent, host: { name: 'Test Host' } })
        setupPrismaMock('guest', 'findUnique', null)
        setupPrismaMock('guest', 'create', mockGuestData)
      })

      it('should send invitation when sendInvite is true', async () => {
        const request = createMockRequest('POST', '/api/events/event-1/guests', {
          body: {
            email: 'newguest@example.com',
            name: 'New Guest',
            sendInvite: true,
            notifyByEmail: true,
          },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        await addGuest(request, context)

        expect(sendInvitation).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'newguest@example.com',
            guestName: 'New Guest',
            event: expect.objectContaining({
              title: mockEvent.title,
            }),
          })
        )
      })

      it('should not send invitation when sendInvite is false', async () => {
        const request = createMockRequest('POST', '/api/events/event-1/guests', {
          body: {
            email: 'newguest@example.com',
            sendInvite: false,
          },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        await addGuest(request, context)

        expect(sendInvitation).not.toHaveBeenCalled()
      })

      it('should not send invitation when notifyByEmail is false', async () => {
        const request = createMockRequest('POST', '/api/events/event-1/guests', {
          body: {
            email: 'newguest@example.com',
            sendInvite: true,
            notifyByEmail: false,
          },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        await addGuest(request, context)

        expect(sendInvitation).not.toHaveBeenCalled()
      })

      it('should still return guest even if invitation fails', async () => {
        vi.mocked(sendInvitation).mockRejectedValueOnce(new Error('Email failed'))

        const request = createMockRequest('POST', '/api/events/event-1/guests', {
          body: {
            email: 'newguest@example.com',
            sendInvite: true,
            notifyByEmail: true,
          },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await addGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest).toBeDefined()
      })
    })
  })

  // ====================
  // PATCH /api/events/[id]/guests/[guestId] - Update Guest
  // ====================
  describe('PATCH /api/events/[id]/guests/[guestId] (Update Guest)', () => {
    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockNoSession()

        const request = createMockRequest('PATCH', '/api/events/event-1/guests/guest-1', {
          body: { name: 'Updated Name' },
        })
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await updateGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(401)
        expect(body.error).toBe('Unauthorized')
      })
    })

    describe('Authorization', () => {
      it('should return 404 when user is not event host', async () => {
        mockSession({ id: 'user-2', email: 'other@example.com', role: 'USER' })
        setupPrismaMock('event', 'findUnique', { ...mockEvent, hostId: 'user-1' })

        const request = createMockRequest('PATCH', '/api/events/event-1/guests/guest-1', {
          body: { name: 'Updated Name' },
        })
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await updateGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(404)
        expect(body.error).toBe('Event not found')
      })

      it('should allow host to update guest', async () => {
        mockSession({ id: 'user-1', email: mockUser.email, role: 'USER' })
        setupPrismaMock('event', 'findUnique', mockEvent)
        setupPrismaMock('guest', 'findUnique', { ...mockGuestData, additionalGuests: [] })
        setupPrismaMock('guest', 'update', { ...mockGuestData, name: 'Updated Name', additionalGuests: [] })

        const request = createMockRequest('PATCH', '/api/events/event-1/guests/guest-1', {
          body: { name: 'Updated Name' },
        })
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await updateGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest.name).toBe('Updated Name')
      })
    })

    describe('Validation', () => {
      beforeEach(() => {
        mockSession({ id: 'user-1', email: mockUser.email, role: 'USER' })
        setupPrismaMock('event', 'findUnique', mockEvent)
      })

      it('should return 404 when guest not found', async () => {
        setupPrismaMock('guest', 'findUnique', null)

        const request = createMockRequest('PATCH', '/api/events/event-1/guests/nonexistent', {
          body: { name: 'Updated Name' },
        })
        const context = createMockRouteContext({ id: 'event-1', guestId: 'nonexistent' })

        const response = await updateGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(404)
        expect(body.error).toBe('Guest not found')
      })

      it('should return 404 when guest belongs to different event', async () => {
        setupPrismaMock('guest', 'findUnique', { ...mockGuestData, eventId: 'other-event', additionalGuests: [] })

        const request = createMockRequest('PATCH', '/api/events/event-1/guests/guest-1', {
          body: { name: 'Updated Name' },
        })
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await updateGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(404)
        expect(body.error).toBe('Guest not found')
      })

      it('should return 400 for invalid email format', async () => {
        setupPrismaMock('guest', 'findUnique', { ...mockGuestData, additionalGuests: [] })

        const request = createMockRequest('PATCH', '/api/events/event-1/guests/guest-1', {
          body: { email: 'invalid-email' },
        })
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await updateGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBe('Invalid email')
      })

      it('should return 400 when email is already used by another guest', async () => {
        // First call returns the guest being updated
        vi.mocked(prisma.guest.findUnique)
          .mockResolvedValueOnce({ ...mockGuestData, email: 'original@example.com', additionalGuests: [] } as never)
          // Second call returns another guest with the target email
          .mockResolvedValueOnce({ id: 'other-guest', email: 'taken@example.com' } as never)

        const request = createMockRequest('PATCH', '/api/events/event-1/guests/guest-1', {
          body: { email: 'taken@example.com' },
        })
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await updateGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBe('This email is already used for another guest in this event')
      })
    })

    describe('Guest Updates', () => {
      beforeEach(() => {
        mockSession({ id: 'user-1', email: mockUser.email, role: 'USER' })
        setupPrismaMock('event', 'findUnique', mockEvent)
        setupPrismaMock('guest', 'findUnique', { ...mockGuestData, additionalGuests: [] })
      })

      it('should update guest name', async () => {
        setupPrismaMock('guest', 'update', { ...mockGuestData, name: 'New Name', additionalGuests: [] })

        const request = createMockRequest('PATCH', '/api/events/event-1/guests/guest-1', {
          body: { name: 'New Name' },
        })
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await updateGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest.name).toBe('New Name')
      })

      it('should update guest status', async () => {
        // When updating to ATTENDING, validateGuestLimit is called
        vi.mocked(validateGuestLimit).mockReturnValue({ valid: true, remaining: 1 })
        setupPrismaMock('guest', 'update', { ...mockGuestData, status: 'ATTENDING', additionalGuests: [] })

        const request = createMockRequest('PATCH', '/api/events/event-1/guests/guest-1', {
          body: { status: 'ATTENDING' },
        })
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await updateGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest.status).toBe('ATTENDING')
      })

      it('should update dietary notes', async () => {
        setupPrismaMock('guest', 'update', { ...mockGuestData, dietaryNotes: 'Vegetarian', additionalGuests: [] })

        const request = createMockRequest('PATCH', '/api/events/event-1/guests/guest-1', {
          body: { dietaryNotes: 'Vegetarian' },
        })
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await updateGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest.dietaryNotes).toBe('Vegetarian')
      })

      it('should update additional guests', async () => {
        setupPrismaMock('additionalGuest', 'deleteMany', { count: 0 })
        setupPrismaMock('guest', 'update', {
          ...mockGuestData,
          additionalGuests: [
            { id: 'ag-1', name: 'Plus One', guestId: 'guest-1' },
          ],
        })

        const request = createMockRequest('PATCH', '/api/events/event-1/guests/guest-1', {
          body: { additionalGuests: ['Plus One'] },
        })
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await updateGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.guest.additionalGuests).toHaveLength(1)
        expect(body.guest.additionalGuests[0].name).toBe('Plus One')
      })

      it('should update notification preferences', async () => {
        setupPrismaMock('guest', 'update', {
          ...mockGuestData,
          notifyByEmail: false,
          notifyBySms: false,
          additionalGuests: [],
        })

        const request = createMockRequest('PATCH', '/api/events/event-1/guests/guest-1', {
          body: { notifyByEmail: false, notifyBySms: false },
        })
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await updateGuest(request, context)

        expect(response.status).toBe(200)
      })
    })

    describe('Guest Limit Validation', () => {
      beforeEach(() => {
        mockSession({ id: 'user-1', email: mockUser.email, role: 'USER' })
        setupPrismaMock('event', 'findUnique', { ...mockEvent, maxGuestsPerInvitee: 2 })
        setupPrismaMock('guest', 'findUnique', { ...mockGuestData, additionalGuests: [] })
      })

      it('should validate guest limit when status is ATTENDING', async () => {
        vi.mocked(validateGuestLimit).mockReturnValue({ valid: true, remaining: 1 })
        setupPrismaMock('additionalGuest', 'deleteMany', { count: 0 })
        setupPrismaMock('guest', 'update', {
          ...mockGuestData,
          status: 'ATTENDING',
          additionalGuests: [{ id: 'ag-1', name: 'Plus One', guestId: 'guest-1' }],
        })

        const request = createMockRequest('PATCH', '/api/events/event-1/guests/guest-1', {
          body: { status: 'ATTENDING', additionalGuests: ['Plus One'] },
        })
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        await updateGuest(request, context)

        expect(validateGuestLimit).toHaveBeenCalled()
      })

      it('should return 400 when guest limit exceeded', async () => {
        vi.mocked(validateGuestLimit).mockReturnValue({
          valid: false,
          error: 'You can only bring 1 additional guest (total of 2 including yourself)',
          remaining: 0,
        })

        const request = createMockRequest('PATCH', '/api/events/event-1/guests/guest-1', {
          body: { status: 'ATTENDING', additionalGuests: ['Guest 1', 'Guest 2', 'Guest 3'] },
        })
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await updateGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toContain('additional guest')
      })
    })
  })

  // ====================
  // DELETE /api/events/[id]/guests/[guestId] - Delete Guest
  // ====================
  describe('DELETE /api/events/[id]/guests/[guestId] (Delete Guest)', () => {
    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockNoSession()

        const request = createMockRequest('DELETE', '/api/events/event-1/guests/guest-1')
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await deleteGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(401)
        expect(body.error).toBe('Unauthorized')
      })
    })

    describe('Authorization', () => {
      it('should return 404 when user is not event host', async () => {
        mockSession({ id: 'user-2', email: 'other@example.com', role: 'USER' })
        setupPrismaMock('event', 'findUnique', { ...mockEvent, hostId: 'user-1' })

        const request = createMockRequest('DELETE', '/api/events/event-1/guests/guest-1')
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await deleteGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(404)
        expect(body.error).toBe('Event not found')
      })

      it('should allow host to delete guest', async () => {
        mockSession({ id: 'user-1', email: mockUser.email, role: 'USER' })
        setupPrismaMock('event', 'findUnique', mockEvent)
        setupPrismaMock('guest', 'delete', mockGuestData)

        const request = createMockRequest('DELETE', '/api/events/event-1/guests/guest-1')
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await deleteGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.success).toBe(true)
      })
    })

    describe('Guest Deletion', () => {
      beforeEach(() => {
        mockSession({ id: 'user-1', email: mockUser.email, role: 'USER' })
        setupPrismaMock('event', 'findUnique', mockEvent)
      })

      it('should successfully delete a guest', async () => {
        setupPrismaMock('guest', 'delete', mockGuestData)

        const request = createMockRequest('DELETE', '/api/events/event-1/guests/guest-1')
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await deleteGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.success).toBe(true)
        expect(prisma.guest.delete).toHaveBeenCalledWith({
          where: { id: 'guest-1' },
        })
      })

      it('should return 500 on database error', async () => {
        vi.mocked(prisma.guest.delete).mockRejectedValue(new Error('Database error'))

        const request = createMockRequest('DELETE', '/api/events/event-1/guests/guest-1')
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await deleteGuest(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(500)
        expect(body.error).toBe('Failed to delete guest')
      })
    })
  })

  // ====================
  // POST /api/events/[id]/guests/[guestId]/invite - Send Invitation
  // ====================
  describe('POST /api/events/[id]/guests/[guestId]/invite (Send Invitation)', () => {
    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockNoSession()

        const request = createMockRequest('POST', '/api/events/event-1/guests/guest-1/invite')
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await sendInvite(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(401)
        expect(body.error).toBe('Unauthorized')
      })
    })

    describe('Authorization', () => {
      it('should return 404 when user is not event host', async () => {
        mockSession({ id: 'user-2', email: 'other@example.com', role: 'USER' })
        setupPrismaMock('event', 'findUnique', { ...mockEvent, host: { name: 'Test Host' } })

        const request = createMockRequest('POST', '/api/events/event-1/guests/guest-1/invite')
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await sendInvite(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(404)
        expect(body.error).toBe('Event not found')
      })
    })

    describe('Invitation Sending', () => {
      beforeEach(() => {
        mockSession({ id: 'user-1', email: mockUser.email, role: 'USER' })
        setupPrismaMock('event', 'findUnique', { ...mockEvent, host: { name: 'Test Host' } })
      })

      it('should return 404 when guest not found', async () => {
        setupPrismaMock('guest', 'findUnique', null)

        const request = createMockRequest('POST', '/api/events/event-1/guests/nonexistent/invite')
        const context = createMockRouteContext({ id: 'event-1', guestId: 'nonexistent' })

        const response = await sendInvite(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(404)
        expect(body.error).toBe('Guest not found')
      })

      it('should return 404 when guest belongs to different event', async () => {
        setupPrismaMock('guest', 'findUnique', { ...mockGuestData, eventId: 'other-event' })

        const request = createMockRequest('POST', '/api/events/event-1/guests/guest-1/invite')
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await sendInvite(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(404)
        expect(body.error).toBe('Guest not found')
      })

      it('should send invitation successfully', async () => {
        setupPrismaMock('guest', 'findUnique', mockGuestData)

        const request = createMockRequest('POST', '/api/events/event-1/guests/guest-1/invite')
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await sendInvite(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.success).toBe(true)
        expect(sendInvitation).toHaveBeenCalledWith(
          expect.objectContaining({
            to: mockGuestData.email,
            guestName: mockGuestData.name,
            rsvpToken: mockGuestData.token,
          })
        )
      })

      it('should send invitation to guest who already RSVPed', async () => {
        const attendingGuest = { ...mockGuestData, status: 'ATTENDING' }
        setupPrismaMock('guest', 'findUnique', attendingGuest)

        const request = createMockRequest('POST', '/api/events/event-1/guests/guest-1/invite')
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await sendInvite(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.success).toBe(true)
        expect(sendInvitation).toHaveBeenCalled()
      })

      it('should return 500 when email sending fails', async () => {
        setupPrismaMock('guest', 'findUnique', mockGuestData)
        vi.mocked(sendInvitation).mockRejectedValueOnce(new Error('SMTP error'))

        const request = createMockRequest('POST', '/api/events/event-1/guests/guest-1/invite')
        const context = createMockRouteContext({ id: 'event-1', guestId: 'guest-1' })

        const response = await sendInvite(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(500)
        expect(body.error).toBe('Failed to send invitation email')
      })
    })
  })

  // ====================
  // POST /api/events/[id]/guests/import - Bulk Import
  // ====================
  describe('POST /api/events/[id]/guests/import (Bulk Import)', () => {
    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockNoSession()

        const request = createMockRequest('POST', '/api/events/event-1/guests/import', {
          body: { guests: [{ email: 'guest1@example.com' }] },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await importGuests(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(401)
        expect(body.error).toBe('Unauthorized')
      })
    })

    describe('Authorization', () => {
      it('should return 403 when user cannot manage event', async () => {
        mockSession({ id: 'user-2', email: 'other@example.com', role: 'USER' })
        vi.mocked(canManageEvent).mockResolvedValue(false)

        const request = createMockRequest('POST', '/api/events/event-1/guests/import', {
          body: { guests: [{ email: 'guest1@example.com' }] },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await importGuests(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(403)
        expect(body.error).toBe('Unauthorized')
      })

      it('should allow host to import guests', async () => {
        mockSession({ id: 'user-1', email: mockUser.email, role: 'USER' })
        vi.mocked(canManageEvent).mockResolvedValue(true)
        setupPrismaMock('event', 'findUnique', mockEvent)
        setupPrismaMock('guest', 'findMany', [])
        setupPrismaMock('guest', 'create', mockGuestData)

        const request = createMockRequest('POST', '/api/events/event-1/guests/import', {
          body: { guests: [{ email: 'guest1@example.com' }] },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await importGuests(request, context)

        expect(response.status).toBe(200)
      })

      it('should allow co-host to import guests', async () => {
        mockSession({ id: 'user-2', email: 'cohost@example.com', role: 'USER' })
        vi.mocked(canManageEvent).mockResolvedValue(true)
        setupPrismaMock('event', 'findUnique', mockEvent)
        setupPrismaMock('guest', 'findMany', [])
        setupPrismaMock('guest', 'create', mockGuestData)

        const request = createMockRequest('POST', '/api/events/event-1/guests/import', {
          body: { guests: [{ email: 'guest1@example.com' }] },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await importGuests(request, context)

        expect(response.status).toBe(200)
        expect(canManageEvent).toHaveBeenCalledWith('user-2', 'event-1')
      })
    })

    describe('Validation', () => {
      beforeEach(() => {
        mockSession({ id: 'user-1', email: mockUser.email, role: 'USER' })
        vi.mocked(canManageEvent).mockResolvedValue(true)
      })

      it('should return 404 when event not found', async () => {
        setupPrismaMock('event', 'findUnique', null)

        const request = createMockRequest('POST', '/api/events/nonexistent/guests/import', {
          body: { guests: [{ email: 'guest1@example.com' }] },
        })
        const context = createMockRouteContext({ id: 'nonexistent' })

        const response = await importGuests(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(404)
        expect(body.error).toBe('Event not found')
      })

      it('should return 400 for invalid email in guest list', async () => {
        setupPrismaMock('event', 'findUnique', mockEvent)

        const request = createMockRequest('POST', '/api/events/event-1/guests/import', {
          body: { guests: [{ email: 'invalid-email' }] },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await importGuests(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBe('Invalid email')
      })

      it('should return 400 for missing guests array', async () => {
        setupPrismaMock('event', 'findUnique', mockEvent)

        const request = createMockRequest('POST', '/api/events/event-1/guests/import', {
          body: {},
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await importGuests(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
      })
    })

    describe('Bulk Import', () => {
      beforeEach(() => {
        mockSession({ id: 'user-1', email: mockUser.email, role: 'USER' })
        vi.mocked(canManageEvent).mockResolvedValue(true)
        setupPrismaMock('event', 'findUnique', mockEvent)
      })

      it('should import multiple guests successfully', async () => {
        setupPrismaMock('guest', 'findMany', [])
        setupPrismaMock('guest', 'create', mockGuestData)

        const request = createMockRequest('POST', '/api/events/event-1/guests/import', {
          body: {
            guests: [
              { email: 'guest1@example.com', name: 'Guest One' },
              { email: 'guest2@example.com', name: 'Guest Two' },
              { email: 'guest3@example.com', name: 'Guest Three' },
            ],
          },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await importGuests(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.results.imported).toBe(3)
        expect(body.results.skipped).toBe(0)
      })

      it('should skip duplicate emails', async () => {
        setupPrismaMock('guest', 'findMany', [{ email: 'existing@example.com' }])
        setupPrismaMock('guest', 'create', mockGuestData)

        const request = createMockRequest('POST', '/api/events/event-1/guests/import', {
          body: {
            guests: [
              { email: 'existing@example.com' }, // Already exists
              { email: 'new@example.com' }, // New guest
            ],
          },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await importGuests(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.results.imported).toBe(1)
        expect(body.results.skipped).toBe(1)
      })

      it('should handle case-insensitive email duplicates', async () => {
        setupPrismaMock('guest', 'findMany', [{ email: 'existing@example.com' }])
        setupPrismaMock('guest', 'create', mockGuestData)

        const request = createMockRequest('POST', '/api/events/event-1/guests/import', {
          body: {
            guests: [
              { email: 'EXISTING@EXAMPLE.COM' }, // Same email, different case
              { email: 'new@example.com' },
            ],
          },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await importGuests(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.results.skipped).toBe(1)
      })

      it('should import guests with optional fields', async () => {
        setupPrismaMock('guest', 'findMany', [])
        setupPrismaMock('guest', 'create', mockGuestData)

        const request = createMockRequest('POST', '/api/events/event-1/guests/import', {
          body: {
            guests: [
              {
                email: 'guest@example.com',
                name: 'Test Guest',
                phone: '+1234567890',
              },
            ],
          },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await importGuests(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.results.imported).toBe(1)
        expect(prisma.guest.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              email: 'guest@example.com',
              name: 'Test Guest',
              phone: '+1234567890',
            }),
          })
        )
      })

      it('should handle database errors gracefully', async () => {
        setupPrismaMock('guest', 'findMany', [])
        vi.mocked(prisma.guest.create).mockRejectedValue(new Error('Database error'))

        const request = createMockRequest('POST', '/api/events/event-1/guests/import', {
          body: {
            guests: [{ email: 'guest1@example.com' }],
          },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await importGuests(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.results.imported).toBe(0)
        expect(body.results.errors).toHaveLength(1)
        expect(body.results.errors[0]).toContain('Failed to add')
      })
    })

    describe('Send Invites During Import', () => {
      beforeEach(() => {
        mockSession({ id: 'user-1', email: mockUser.email, role: 'USER' })
        vi.mocked(canManageEvent).mockResolvedValue(true)
        setupPrismaMock('event', 'findUnique', { ...mockEvent, host: { name: 'Test Host' } })
        setupPrismaMock('guest', 'create', mockGuestData)
      })

      it('should send invitations when sendInvites is true', async () => {
        // Mock the findMany calls
        vi.mocked(prisma.guest.findMany)
          .mockResolvedValueOnce([]) // First call: existing guests check
          .mockResolvedValueOnce([{ ...mockGuestData, notifyByEmail: true }] as never) // Second call: newly imported

        const request = createMockRequest('POST', '/api/events/event-1/guests/import', {
          body: {
            guests: [{ email: 'guest1@example.com' }],
            sendInvites: true,
          },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await importGuests(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.invitationsSent).toBe(true)
        expect(sendInvitation).toHaveBeenCalled()
      })

      it('should not send invitations when sendInvites is false', async () => {
        setupPrismaMock('guest', 'findMany', [])

        const request = createMockRequest('POST', '/api/events/event-1/guests/import', {
          body: {
            guests: [{ email: 'guest1@example.com' }],
            sendInvites: false,
          },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await importGuests(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.invitationsSent).toBeUndefined()
        expect(sendInvitation).not.toHaveBeenCalled()
      })

      it('should skip sending invitation to guests with notifyByEmail false', async () => {
        vi.mocked(prisma.guest.findMany)
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ ...mockGuestData, notifyByEmail: false }] as never)

        const request = createMockRequest('POST', '/api/events/event-1/guests/import', {
          body: {
            guests: [{ email: 'guest1@example.com' }],
            sendInvites: true,
          },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await importGuests(request, context)

        expect(response.status).toBe(200)
        // sendInvitation should not be called for guests with notifyByEmail: false
      })

      it('should track invitation failures', async () => {
        vi.mocked(prisma.guest.findMany)
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            { ...mockGuestData, id: 'guest-1', email: 'guest1@example.com', notifyByEmail: true },
            { ...mockGuestData, id: 'guest-2', email: 'guest2@example.com', notifyByEmail: true },
          ] as never)

        vi.mocked(sendInvitation)
          .mockResolvedValueOnce(undefined) // First succeeds
          .mockRejectedValueOnce(new Error('Email failed')) // Second fails

        const request = createMockRequest('POST', '/api/events/event-1/guests/import', {
          body: {
            guests: [
              { email: 'guest1@example.com' },
              { email: 'guest2@example.com' },
            ],
            sendInvites: true,
          },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await importGuests(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.invitationResults.emailsSent).toBe(1)
        expect(body.invitationResults.emailsFailed).toBe(1)
      })
    })
  })
})
