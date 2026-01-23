import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createMockEvent, createMockGuest } from '../setup'

// Mock email functions
vi.mock('@/lib/email', () => ({
  sendConfirmation: vi.fn().mockResolvedValue(undefined),
}))

// Mock config functions
vi.mock('@/lib/config', () => ({
  getAppUrl: vi.fn().mockResolvedValue('http://localhost:3000'),
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

// Import route after mocks
import { GET } from '@/app/api/rsvp/[token]/quick/route'
import { sendConfirmation } from '@/lib/email'
import { getAppUrl } from '@/lib/config'
import { NextRequest } from 'next/server'

// Helper to create mock request with search params
function createQuickRsvpRequest(token: string, status?: string): NextRequest {
  const url = status
    ? `http://localhost:3000/api/rsvp/${token}/quick?status=${status}`
    : `http://localhost:3000/api/rsvp/${token}/quick`
  return new NextRequest(url)
}

// Helper to create route context
function createRouteContext(token: string) {
  return { params: Promise.resolve({ token }) }
}

// Helper to set up Prisma mock
function setupPrismaMock(model: string, method: string, returnValue: unknown) {
  const modelMock = (prisma as any)[model]
  if (modelMock && modelMock[method]) {
    modelMock[method].mockReset()
    modelMock[method].mockResolvedValue(returnValue)
  }
}

describe('Quick RSVP API Route - GET /api/rsvp/[token]/quick', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAppUrl).mockResolvedValue('http://localhost:3000')
    vi.mocked(sendConfirmation).mockResolvedValue(undefined)
  })

  describe('Status parameter validation', () => {
    it('should redirect with error for missing status parameter', async () => {
      const request = createQuickRsvpRequest('valid-token')
      const context = createRouteContext('valid-token')

      const response = await GET(request, context)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/rsvp/valid-token?error=invalid_status'
      )
    })

    it('should redirect with error for invalid status parameter', async () => {
      const request = createQuickRsvpRequest('valid-token', 'INVALID_STATUS')
      const context = createRouteContext('valid-token')

      const response = await GET(request, context)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/rsvp/valid-token?error=invalid_status'
      )
    })

    it('should accept ATTENDING status', async () => {
      const mockEvent = createMockEvent({
        id: 'event-1',
        slug: 'test-event',
        rsvpDeadline: new Date('2099-12-31'),
      })
      const mockGuest = createMockGuest({
        id: 'guest-1',
        token: 'valid-token',
        email: 'guest@test.com',
        name: 'Test Guest',
        status: 'PENDING',
        event: mockEvent,
      })
      setupPrismaMock('guest', 'findUnique', mockGuest)
      setupPrismaMock('guest', 'update', { ...mockGuest, status: 'ATTENDING' })

      const request = createQuickRsvpRequest('valid-token', 'ATTENDING')
      const context = createRouteContext('valid-token')

      const response = await GET(request, context)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('success=rsvp_attending')
    })

    it('should accept NOT_ATTENDING status', async () => {
      const mockEvent = createMockEvent({
        id: 'event-1',
        slug: 'test-event',
        rsvpDeadline: new Date('2099-12-31'),
      })
      const mockGuest = createMockGuest({
        id: 'guest-1',
        token: 'valid-token',
        email: 'guest@test.com',
        name: 'Test Guest',
        status: 'PENDING',
        event: mockEvent,
      })
      setupPrismaMock('guest', 'findUnique', mockGuest)
      setupPrismaMock('guest', 'update', { ...mockGuest, status: 'NOT_ATTENDING' })

      const request = createQuickRsvpRequest('valid-token', 'NOT_ATTENDING')
      const context = createRouteContext('valid-token')

      const response = await GET(request, context)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('success=rsvp_not_attending')
    })

    it('should accept MAYBE status', async () => {
      const mockEvent = createMockEvent({
        id: 'event-1',
        slug: 'test-event',
        rsvpDeadline: new Date('2099-12-31'),
      })
      const mockGuest = createMockGuest({
        id: 'guest-1',
        token: 'valid-token',
        email: 'guest@test.com',
        name: 'Test Guest',
        status: 'PENDING',
        event: mockEvent,
      })
      setupPrismaMock('guest', 'findUnique', mockGuest)
      setupPrismaMock('guest', 'update', { ...mockGuest, status: 'MAYBE' })

      const request = createQuickRsvpRequest('valid-token', 'MAYBE')
      const context = createRouteContext('valid-token')

      const response = await GET(request, context)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('success=rsvp_maybe')
    })
  })

  describe('Token validation', () => {
    it('should redirect to home with error for invalid token', async () => {
      setupPrismaMock('guest', 'findUnique', null)

      const request = createQuickRsvpRequest('invalid-token', 'ATTENDING')
      const context = createRouteContext('invalid-token')

      const response = await GET(request, context)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('error=invalid_token')
    })
  })

  describe('RSVP deadline enforcement', () => {
    it('should redirect with deadline_passed error when deadline has passed', async () => {
      const mockEvent = createMockEvent({
        id: 'event-1',
        slug: 'test-event',
        rsvpDeadline: new Date('2020-01-01'), // Past deadline
      })
      const mockGuest = createMockGuest({
        id: 'guest-1',
        token: 'valid-token',
        email: 'guest@test.com',
        name: 'Test Guest',
        status: 'PENDING',
        event: mockEvent,
      })
      setupPrismaMock('guest', 'findUnique', mockGuest)

      const request = createQuickRsvpRequest('valid-token', 'ATTENDING')
      const context = createRouteContext('valid-token')

      const response = await GET(request, context)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/events/test-event?error=deadline_passed'
      )
    })

    it('should allow RSVP when no deadline is set', async () => {
      const mockEvent = createMockEvent({
        id: 'event-1',
        slug: 'test-event',
        rsvpDeadline: null,
      })
      const mockGuest = createMockGuest({
        id: 'guest-1',
        token: 'valid-token',
        email: 'guest@test.com',
        name: 'Test Guest',
        status: 'PENDING',
        event: mockEvent,
      })
      setupPrismaMock('guest', 'findUnique', mockGuest)
      setupPrismaMock('guest', 'update', { ...mockGuest, status: 'ATTENDING' })

      const request = createQuickRsvpRequest('valid-token', 'ATTENDING')
      const context = createRouteContext('valid-token')

      const response = await GET(request, context)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('success=rsvp_attending')
    })
  })

  describe('Status update', () => {
    it('should update guest status in database', async () => {
      const mockEvent = createMockEvent({
        id: 'event-1',
        slug: 'test-event',
        rsvpDeadline: null,
      })
      const mockGuest = createMockGuest({
        id: 'guest-1',
        token: 'valid-token',
        email: 'guest@test.com',
        name: 'Test Guest',
        status: 'PENDING',
        event: mockEvent,
      })
      setupPrismaMock('guest', 'findUnique', mockGuest)
      setupPrismaMock('guest', 'update', { ...mockGuest, status: 'ATTENDING' })

      const request = createQuickRsvpRequest('valid-token', 'ATTENDING')
      const context = createRouteContext('valid-token')

      await GET(request, context)

      expect(prisma.guest.update).toHaveBeenCalledWith({
        where: { id: 'guest-1' },
        data: expect.objectContaining({
          status: 'ATTENDING',
          respondedAt: expect.any(Date),
        }),
      })
    })

    it('should update respondedAt timestamp', async () => {
      const mockEvent = createMockEvent({
        id: 'event-1',
        slug: 'test-event',
        rsvpDeadline: null,
      })
      const mockGuest = createMockGuest({
        id: 'guest-1',
        token: 'valid-token',
        email: 'guest@test.com',
        name: 'Test Guest',
        status: 'PENDING',
        respondedAt: null,
        event: mockEvent,
      })
      setupPrismaMock('guest', 'findUnique', mockGuest)
      setupPrismaMock('guest', 'update', {
        ...mockGuest,
        status: 'ATTENDING',
        respondedAt: new Date(),
      })

      const request = createQuickRsvpRequest('valid-token', 'ATTENDING')
      const context = createRouteContext('valid-token')

      await GET(request, context)

      expect(prisma.guest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            respondedAt: expect.any(Date),
          }),
        })
      )
    })
  })

  describe('Confirmation email', () => {
    it('should send confirmation email after status update', async () => {
      const mockEvent = createMockEvent({
        id: 'event-1',
        title: 'Test Event',
        slug: 'test-event',
        rsvpDeadline: null,
        date: new Date('2024-12-25'),
        locationName: 'Test Venue',
      })
      const mockGuest = createMockGuest({
        id: 'guest-1',
        token: 'valid-token',
        email: 'guest@test.com',
        name: 'Test Guest',
        status: 'PENDING',
        event: mockEvent,
      })
      setupPrismaMock('guest', 'findUnique', mockGuest)
      setupPrismaMock('guest', 'update', { ...mockGuest, status: 'ATTENDING' })

      const request = createQuickRsvpRequest('valid-token', 'ATTENDING')
      const context = createRouteContext('valid-token')

      await GET(request, context)

      expect(sendConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'guest@test.com',
          guestName: 'Test Guest',
          status: 'ATTENDING',
          rsvpToken: 'valid-token',
        })
      )
    })

    it('should continue even if confirmation email fails', async () => {
      const mockEvent = createMockEvent({
        id: 'event-1',
        slug: 'test-event',
        rsvpDeadline: null,
      })
      const mockGuest = createMockGuest({
        id: 'guest-1',
        token: 'valid-token',
        email: 'guest@test.com',
        name: 'Test Guest',
        status: 'PENDING',
        event: mockEvent,
      })
      setupPrismaMock('guest', 'findUnique', mockGuest)
      setupPrismaMock('guest', 'update', { ...mockGuest, status: 'ATTENDING' })
      vi.mocked(sendConfirmation).mockRejectedValue(new Error('Email service down'))

      const request = createQuickRsvpRequest('valid-token', 'ATTENDING')
      const context = createRouteContext('valid-token')

      const response = await GET(request, context)

      // Should still redirect successfully
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('success=rsvp_attending')
    })
  })

  describe('Redirect behavior', () => {
    it('should redirect to event page with token on success', async () => {
      const mockEvent = createMockEvent({
        id: 'event-1',
        slug: 'my-test-event',
        rsvpDeadline: null,
      })
      const mockGuest = createMockGuest({
        id: 'guest-1',
        token: 'abc123',
        email: 'guest@test.com',
        name: 'Test Guest',
        status: 'PENDING',
        event: mockEvent,
      })
      setupPrismaMock('guest', 'findUnique', mockGuest)
      setupPrismaMock('guest', 'update', { ...mockGuest, status: 'ATTENDING' })

      const request = createQuickRsvpRequest('abc123', 'ATTENDING')
      const context = createRouteContext('abc123')

      const response = await GET(request, context)

      expect(response.status).toBe(307)
      const location = response.headers.get('location')
      expect(location).toContain('/events/my-test-event')
      expect(location).toContain('token=abc123')
      expect(location).toContain('success=rsvp_attending')
    })

    it('should include correct success message for each status', async () => {
      const mockEvent = createMockEvent({
        id: 'event-1',
        slug: 'test-event',
        rsvpDeadline: null,
      })

      const statuses = [
        { status: 'ATTENDING', expected: 'rsvp_attending' },
        { status: 'NOT_ATTENDING', expected: 'rsvp_not_attending' },
        { status: 'MAYBE', expected: 'rsvp_maybe' },
      ]

      for (const { status, expected } of statuses) {
        vi.clearAllMocks()

        const mockGuest = createMockGuest({
          id: 'guest-1',
          token: 'valid-token',
          email: 'guest@test.com',
          name: 'Test Guest',
          status: 'PENDING',
          event: mockEvent,
        })
        setupPrismaMock('guest', 'findUnique', mockGuest)
        setupPrismaMock('guest', 'update', { ...mockGuest, status })

        const request = createQuickRsvpRequest('valid-token', status)
        const context = createRouteContext('valid-token')

        const response = await GET(request, context)
        const location = response.headers.get('location')

        expect(location).toContain(`success=${expected}`)
      }
    })
  })

  describe('Error handling', () => {
    it('should redirect to home with error on database failure', async () => {
      vi.mocked(prisma.guest.findUnique).mockRejectedValue(
        new Error('Database connection failed')
      )

      const request = createQuickRsvpRequest('valid-token', 'ATTENDING')
      const context = createRouteContext('valid-token')

      const response = await GET(request, context)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('error=rsvp_failed')
    })

    it('should redirect to home with error on update failure', async () => {
      const mockEvent = createMockEvent({
        id: 'event-1',
        slug: 'test-event',
        rsvpDeadline: null,
      })
      const mockGuest = createMockGuest({
        id: 'guest-1',
        token: 'valid-token',
        email: 'guest@test.com',
        name: 'Test Guest',
        status: 'PENDING',
        event: mockEvent,
      })
      setupPrismaMock('guest', 'findUnique', mockGuest)
      vi.mocked(prisma.guest.update).mockRejectedValue(new Error('Update failed'))

      const request = createQuickRsvpRequest('valid-token', 'ATTENDING')
      const context = createRouteContext('valid-token')

      const response = await GET(request, context)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('error=rsvp_failed')
    })
  })
})
