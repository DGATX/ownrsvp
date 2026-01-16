import { describe, test, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  createMockUser,
  createMockEvent,
  createMockCoHost,
} from '../setup'

// Import functions under test
import {
  canManageEvent,
  canViewEvent,
  isEventHost,
  getEventRole,
} from '@/lib/event-access'

import { validateGuestLimit } from '@/lib/rsvp-validation'

import {
  parseReminderSchedule,
  formatReminder,
  validateReminders,
  shouldSendReminder,
  serializeReminderSchedule,
  Reminder,
} from '@/lib/reminder-utils'

// Type the mocked prisma for TypeScript
const mockedPrisma = vi.mocked(prisma)

describe('Event Access Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('canManageEvent', () => {
    test('returns true when user is an ADMIN', async () => {
      const adminUser = createMockUser({ id: 'admin-1', role: 'ADMIN' })
      mockedPrisma.user.findUnique.mockResolvedValue(adminUser)

      const result = await canManageEvent('admin-1', 'event-1')

      expect(result).toBe(true)
      expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'admin-1' },
        select: { role: true },
      })
      // Should not check event or co-host when user is admin
      expect(mockedPrisma.event.findUnique).not.toHaveBeenCalled()
      expect(mockedPrisma.eventCoHost.findUnique).not.toHaveBeenCalled()
    })

    test('returns true when user is the event host', async () => {
      const regularUser = createMockUser({ id: 'user-1', role: 'USER' })
      const event = createMockEvent({ id: 'event-1', hostId: 'user-1' })

      mockedPrisma.user.findUnique.mockResolvedValue(regularUser)
      mockedPrisma.event.findUnique.mockResolvedValue(event)

      const result = await canManageEvent('user-1', 'event-1')

      expect(result).toBe(true)
      expect(mockedPrisma.event.findUnique).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        select: { hostId: true },
      })
      // Should not check co-host when user is host
      expect(mockedPrisma.eventCoHost.findUnique).not.toHaveBeenCalled()
    })

    test('returns true when user is a co-host', async () => {
      const regularUser = createMockUser({ id: 'user-2', role: 'USER' })
      const event = createMockEvent({ id: 'event-1', hostId: 'user-1' })
      const coHost = createMockCoHost({ eventId: 'event-1', userId: 'user-2' })

      mockedPrisma.user.findUnique.mockResolvedValue(regularUser)
      mockedPrisma.event.findUnique.mockResolvedValue(event)
      mockedPrisma.eventCoHost.findUnique.mockResolvedValue(coHost)

      const result = await canManageEvent('user-2', 'event-1')

      expect(result).toBe(true)
      expect(mockedPrisma.eventCoHost.findUnique).toHaveBeenCalledWith({
        where: {
          eventId_userId: {
            eventId: 'event-1',
            userId: 'user-2',
          },
        },
      })
    })

    test('returns false when user has no access', async () => {
      const regularUser = createMockUser({ id: 'user-3', role: 'USER' })
      const event = createMockEvent({ id: 'event-1', hostId: 'user-1' })

      mockedPrisma.user.findUnique.mockResolvedValue(regularUser)
      mockedPrisma.event.findUnique.mockResolvedValue(event)
      mockedPrisma.eventCoHost.findUnique.mockResolvedValue(null)

      const result = await canManageEvent('user-3', 'event-1')

      expect(result).toBe(false)
    })

    test('returns false when user does not exist', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null)
      mockedPrisma.event.findUnique.mockResolvedValue(null)
      mockedPrisma.eventCoHost.findUnique.mockResolvedValue(null)

      const result = await canManageEvent('nonexistent-user', 'event-1')

      expect(result).toBe(false)
    })

    test('returns false when event does not exist', async () => {
      const regularUser = createMockUser({ id: 'user-1', role: 'USER' })

      mockedPrisma.user.findUnique.mockResolvedValue(regularUser)
      mockedPrisma.event.findUnique.mockResolvedValue(null)
      mockedPrisma.eventCoHost.findUnique.mockResolvedValue(null)

      const result = await canManageEvent('user-1', 'nonexistent-event')

      expect(result).toBe(false)
    })
  })

  describe('canViewEvent', () => {
    test('delegates to canManageEvent and returns true for admin', async () => {
      const adminUser = createMockUser({ id: 'admin-1', role: 'ADMIN' })
      mockedPrisma.user.findUnique.mockResolvedValue(adminUser)

      const result = await canViewEvent('admin-1', 'event-1')

      expect(result).toBe(true)
    })

    test('delegates to canManageEvent and returns true for host', async () => {
      const regularUser = createMockUser({ id: 'user-1', role: 'USER' })
      const event = createMockEvent({ id: 'event-1', hostId: 'user-1' })

      mockedPrisma.user.findUnique.mockResolvedValue(regularUser)
      mockedPrisma.event.findUnique.mockResolvedValue(event)

      const result = await canViewEvent('user-1', 'event-1')

      expect(result).toBe(true)
    })

    test('delegates to canManageEvent and returns false for unauthorized user', async () => {
      const regularUser = createMockUser({ id: 'user-3', role: 'USER' })
      const event = createMockEvent({ id: 'event-1', hostId: 'user-1' })

      mockedPrisma.user.findUnique.mockResolvedValue(regularUser)
      mockedPrisma.event.findUnique.mockResolvedValue(event)
      mockedPrisma.eventCoHost.findUnique.mockResolvedValue(null)

      const result = await canViewEvent('user-3', 'event-1')

      expect(result).toBe(false)
    })
  })

  describe('isEventHost', () => {
    test('returns true when user is the host', async () => {
      const event = createMockEvent({ id: 'event-1', hostId: 'user-1' })
      mockedPrisma.event.findUnique.mockResolvedValue(event)

      const result = await isEventHost('user-1', 'event-1')

      expect(result).toBe(true)
      expect(mockedPrisma.event.findUnique).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        select: { hostId: true },
      })
    })

    test('returns false when user is not the host', async () => {
      const event = createMockEvent({ id: 'event-1', hostId: 'user-1' })
      mockedPrisma.event.findUnique.mockResolvedValue(event)

      const result = await isEventHost('user-2', 'event-1')

      expect(result).toBe(false)
    })

    test('returns false when event does not exist', async () => {
      mockedPrisma.event.findUnique.mockResolvedValue(null)

      const result = await isEventHost('user-1', 'nonexistent-event')

      expect(result).toBe(false)
    })

    test('returns false for co-host (only host returns true)', async () => {
      const event = createMockEvent({ id: 'event-1', hostId: 'user-1' })
      mockedPrisma.event.findUnique.mockResolvedValue(event)

      // Even if user is a co-host, isEventHost should return false
      const result = await isEventHost('user-2', 'event-1')

      expect(result).toBe(false)
    })

    test('returns false for admin (admin is not automatically host)', async () => {
      const event = createMockEvent({ id: 'event-1', hostId: 'user-1' })
      mockedPrisma.event.findUnique.mockResolvedValue(event)

      // Admin role doesn't make them the host
      const result = await isEventHost('admin-1', 'event-1')

      expect(result).toBe(false)
    })
  })

  describe('getEventRole', () => {
    test('returns ADMIN when user is an admin', async () => {
      const adminUser = createMockUser({ id: 'admin-1', role: 'ADMIN' })
      mockedPrisma.user.findUnique.mockResolvedValue(adminUser)

      const result = await getEventRole('admin-1', 'event-1')

      expect(result).toBe('ADMIN')
      // Should return early without checking event or co-host
      expect(mockedPrisma.event.findUnique).not.toHaveBeenCalled()
    })

    test('returns HOST when user is the event host', async () => {
      const regularUser = createMockUser({ id: 'user-1', role: 'USER' })
      const event = createMockEvent({ id: 'event-1', hostId: 'user-1' })

      mockedPrisma.user.findUnique.mockResolvedValue(regularUser)
      mockedPrisma.event.findUnique.mockResolvedValue(event)

      const result = await getEventRole('user-1', 'event-1')

      expect(result).toBe('HOST')
      // Should not check co-host when user is host
      expect(mockedPrisma.eventCoHost.findUnique).not.toHaveBeenCalled()
    })

    test('returns COHOST when user is a co-host with COHOST role', async () => {
      const regularUser = createMockUser({ id: 'user-2', role: 'USER' })
      const event = createMockEvent({ id: 'event-1', hostId: 'user-1' })
      const coHost = createMockCoHost({
        eventId: 'event-1',
        userId: 'user-2',
        role: 'COHOST',
      })

      mockedPrisma.user.findUnique.mockResolvedValue(regularUser)
      mockedPrisma.event.findUnique.mockResolvedValue(event)
      mockedPrisma.eventCoHost.findUnique.mockResolvedValue(coHost)

      const result = await getEventRole('user-2', 'event-1')

      expect(result).toBe('COHOST')
      expect(mockedPrisma.eventCoHost.findUnique).toHaveBeenCalledWith({
        where: {
          eventId_userId: {
            eventId: 'event-1',
            userId: 'user-2',
          },
        },
        select: { role: true },
      })
    })

    test('returns VIEWER when user is a co-host with VIEWER role', async () => {
      const regularUser = createMockUser({ id: 'user-2', role: 'USER' })
      const event = createMockEvent({ id: 'event-1', hostId: 'user-1' })
      const coHost = createMockCoHost({
        eventId: 'event-1',
        userId: 'user-2',
        role: 'VIEWER',
      })

      mockedPrisma.user.findUnique.mockResolvedValue(regularUser)
      mockedPrisma.event.findUnique.mockResolvedValue(event)
      mockedPrisma.eventCoHost.findUnique.mockResolvedValue(coHost)

      const result = await getEventRole('user-2', 'event-1')

      expect(result).toBe('VIEWER')
    })

    test('returns null when user has no access', async () => {
      const regularUser = createMockUser({ id: 'user-3', role: 'USER' })
      const event = createMockEvent({ id: 'event-1', hostId: 'user-1' })

      mockedPrisma.user.findUnique.mockResolvedValue(regularUser)
      mockedPrisma.event.findUnique.mockResolvedValue(event)
      mockedPrisma.eventCoHost.findUnique.mockResolvedValue(null)

      const result = await getEventRole('user-3', 'event-1')

      expect(result).toBeNull()
    })

    test('returns null when user does not exist', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null)
      mockedPrisma.event.findUnique.mockResolvedValue(null)
      mockedPrisma.eventCoHost.findUnique.mockResolvedValue(null)

      const result = await getEventRole('nonexistent-user', 'event-1')

      expect(result).toBeNull()
    })

    test('returns null when event does not exist', async () => {
      const regularUser = createMockUser({ id: 'user-1', role: 'USER' })

      mockedPrisma.user.findUnique.mockResolvedValue(regularUser)
      mockedPrisma.event.findUnique.mockResolvedValue(null)
      mockedPrisma.eventCoHost.findUnique.mockResolvedValue(null)

      const result = await getEventRole('user-1', 'nonexistent-event')

      expect(result).toBeNull()
    })
  })
})

describe('RSVP Validation Functions', () => {
  describe('validateGuestLimit', () => {
    describe('with unlimited guests (null limits)', () => {
      test('returns valid with Infinity remaining when global max is null', () => {
        const result = validateGuestLimit(null, 5)

        expect(result.valid).toBe(true)
        expect(result.remaining).toBe(Infinity)
        expect(result.error).toBeUndefined()
      })

      test('returns valid with Infinity remaining when both limits are null', () => {
        const result = validateGuestLimit(null, 10, null)

        expect(result.valid).toBe(true)
        expect(result.remaining).toBe(Infinity)
      })

      test('uses global limit when per-guest is null', () => {
        // When guestMaxGuests is explicitly null, the condition `guestMaxGuests !== null` is false
        // so it falls back to globalMaxGuests
        const result = validateGuestLimit(5, 10, null)

        // With global max of 5 and 10 additional guests (11 total), this should be invalid
        expect(result.valid).toBe(false)
        expect(result.remaining).toBe(0)
      })
    })

    describe('with global limit only', () => {
      test('returns valid when total guests equals max', () => {
        // globalMaxGuests = 3 means invitee + 2 additional guests
        const result = validateGuestLimit(3, 2)

        expect(result.valid).toBe(true)
        expect(result.remaining).toBe(0)
      })

      test('returns valid when total guests is under max', () => {
        const result = validateGuestLimit(5, 2)

        expect(result.valid).toBe(true)
        expect(result.remaining).toBe(2) // 5 - (1 + 2) = 2
      })

      test('returns invalid when total guests exceeds max', () => {
        const result = validateGuestLimit(2, 3)

        expect(result.valid).toBe(false)
        expect(result.error).toBe(
          'You can only bring 1 additional guest (total of 2 including yourself)'
        )
        expect(result.remaining).toBe(0)
      })

      test('returns invalid with correct pluralization for 0 additional guests allowed', () => {
        const result = validateGuestLimit(1, 1)

        expect(result.valid).toBe(false)
        expect(result.error).toBe(
          'You can only bring 0 additional guests (total of 1 including yourself)'
        )
      })

      test('returns valid when no additional guests and max is 1', () => {
        const result = validateGuestLimit(1, 0)

        expect(result.valid).toBe(true)
        expect(result.remaining).toBe(0)
      })
    })

    describe('with per-guest limit override', () => {
      test('per-guest limit takes priority over global limit', () => {
        // Global limit is 5, but per-guest limit is 2
        const result = validateGuestLimit(5, 2, 2)

        expect(result.valid).toBe(false)
        expect(result.error).toBe(
          'You can only bring 1 additional guest (total of 2 including yourself)'
        )
      })

      test('per-guest limit allows more than global would', () => {
        // Global limit is 2, but per-guest limit is 5
        const result = validateGuestLimit(2, 3, 5)

        expect(result.valid).toBe(true)
        expect(result.remaining).toBe(1) // 5 - (1 + 3) = 1
      })

      test('per-guest limit of 0 returns remaining correctly', () => {
        const result = validateGuestLimit(5, 0, 0)

        // With max 0, even the invitee alone (count = 1) exceeds limit
        expect(result.valid).toBe(false)
        expect(result.remaining).toBe(0)
      })
    })

    describe('edge cases', () => {
      test('handles zero additional guests correctly', () => {
        const result = validateGuestLimit(3, 0)

        expect(result.valid).toBe(true)
        expect(result.remaining).toBe(2) // 3 - 1 = 2
      })

      test('handles large numbers correctly', () => {
        const result = validateGuestLimit(100, 50)

        expect(result.valid).toBe(true)
        expect(result.remaining).toBe(49) // 100 - 51 = 49
      })

      test('handles undefined guestMaxGuests (falls back to global)', () => {
        const result = validateGuestLimit(3, 1, undefined)

        expect(result.valid).toBe(true)
        expect(result.remaining).toBe(1) // 3 - 2 = 1
      })
    })
  })
})

describe('Reminder Utility Functions', () => {
  describe('parseReminderSchedule', () => {
    describe('handling null and empty inputs', () => {
      test('returns empty array for null input', () => {
        const result = parseReminderSchedule(null)
        expect(result).toEqual([])
      })

      test('returns empty array for empty string', () => {
        const result = parseReminderSchedule('')
        expect(result).toEqual([])
      })

      test('returns empty array for empty JSON array', () => {
        const result = parseReminderSchedule('[]')
        expect(result).toEqual([])
      })
    })

    describe('parsing old format (array of numbers)', () => {
      test('converts single day number to new format', () => {
        const result = parseReminderSchedule('[7]')

        expect(result).toEqual([{ type: 'day', value: 7 }])
      })

      test('converts multiple day numbers to new format', () => {
        const result = parseReminderSchedule('[7, 3, 1]')

        expect(result).toEqual([
          { type: 'day', value: 7 },
          { type: 'day', value: 3 },
          { type: 'day', value: 1 },
        ])
      })

      test('handles old format with various day values', () => {
        const result = parseReminderSchedule('[30, 14, 7, 1]')

        expect(result).toHaveLength(4)
        expect(result[0]).toEqual({ type: 'day', value: 30 })
        expect(result[3]).toEqual({ type: 'day', value: 1 })
      })
    })

    describe('parsing new format (array of objects)', () => {
      test('parses single day reminder', () => {
        const result = parseReminderSchedule('[{"type":"day","value":7}]')

        expect(result).toEqual([{ type: 'day', value: 7 }])
      })

      test('parses single hour reminder', () => {
        const result = parseReminderSchedule('[{"type":"hour","value":2}]')

        expect(result).toEqual([{ type: 'hour', value: 2 }])
      })

      test('parses mixed day and hour reminders', () => {
        const result = parseReminderSchedule(
          '[{"type":"day","value":7},{"type":"hour","value":2}]'
        )

        expect(result).toEqual([
          { type: 'day', value: 7 },
          { type: 'hour', value: 2 },
        ])
      })

      test('parses multiple reminders of same type', () => {
        const result = parseReminderSchedule(
          '[{"type":"day","value":7},{"type":"day","value":3},{"type":"day","value":1}]'
        )

        expect(result).toHaveLength(3)
        expect(result.every((r) => r.type === 'day')).toBe(true)
      })
    })

    describe('error handling', () => {
      test('returns empty array for invalid JSON', () => {
        const result = parseReminderSchedule('not valid json')
        expect(result).toEqual([])
      })

      test('returns empty array for malformed JSON', () => {
        const result = parseReminderSchedule('{invalid}')
        expect(result).toEqual([])
      })

      test('returns empty array for non-array JSON', () => {
        const result = parseReminderSchedule('{"type":"day","value":7}')
        expect(result).toEqual([])
      })

      test('returns empty array for array of strings', () => {
        const result = parseReminderSchedule('["one","two","three"]')
        expect(result).toEqual([])
      })

      test('returns empty array for array of invalid objects', () => {
        const result = parseReminderSchedule('[{"foo":"bar"}]')
        expect(result).toEqual([])
      })

      test('returns empty array for objects missing value property', () => {
        const result = parseReminderSchedule('[{"type":"day"}]')
        expect(result).toEqual([])
      })
    })
  })

  describe('formatReminder', () => {
    describe('day reminders', () => {
      test('formats singular day correctly', () => {
        const result = formatReminder({ type: 'day', value: 1 })
        expect(result).toBe('1 day before')
      })

      test('formats plural days correctly', () => {
        const result = formatReminder({ type: 'day', value: 7 })
        expect(result).toBe('7 days before')
      })

      test('formats 2 days correctly', () => {
        const result = formatReminder({ type: 'day', value: 2 })
        expect(result).toBe('2 days before')
      })

      test('formats large day values', () => {
        const result = formatReminder({ type: 'day', value: 30 })
        expect(result).toBe('30 days before')
      })
    })

    describe('hour reminders', () => {
      test('formats singular hour correctly', () => {
        const result = formatReminder({ type: 'hour', value: 1 })
        expect(result).toBe('1 hour before')
      })

      test('formats plural hours correctly', () => {
        const result = formatReminder({ type: 'hour', value: 2 })
        expect(result).toBe('2 hours before')
      })

      test('formats large hour values', () => {
        const result = formatReminder({ type: 'hour', value: 24 })
        expect(result).toBe('24 hours before')
      })
    })

    describe('edge cases', () => {
      test('formats zero days (edge case)', () => {
        const result = formatReminder({ type: 'day', value: 0 })
        expect(result).toBe('0 days before')
      })

      test('formats zero hours (edge case)', () => {
        const result = formatReminder({ type: 'hour', value: 0 })
        expect(result).toBe('0 hours before')
      })
    })
  })

  describe('validateReminders', () => {
    describe('valid reminders', () => {
      test('returns valid for empty array', () => {
        const result = validateReminders([])
        expect(result).toEqual({ valid: true })
      })

      test('returns valid for single day reminder', () => {
        const result = validateReminders([{ type: 'day', value: 7 }])
        expect(result).toEqual({ valid: true })
      })

      test('returns valid for single hour reminder', () => {
        const result = validateReminders([{ type: 'hour', value: 2 }])
        expect(result).toEqual({ valid: true })
      })

      test('returns valid for multiple unique reminders', () => {
        const reminders: Reminder[] = [
          { type: 'day', value: 7 },
          { type: 'day', value: 3 },
          { type: 'hour', value: 2 },
        ]
        const result = validateReminders(reminders)
        expect(result).toEqual({ valid: true })
      })

      test('returns valid for same value but different types', () => {
        const reminders: Reminder[] = [
          { type: 'day', value: 2 },
          { type: 'hour', value: 2 },
        ]
        const result = validateReminders(reminders)
        expect(result).toEqual({ valid: true })
      })
    })

    describe('duplicate detection', () => {
      test('returns invalid for duplicate day reminders', () => {
        const reminders: Reminder[] = [
          { type: 'day', value: 7 },
          { type: 'day', value: 7 },
        ]
        const result = validateReminders(reminders)

        expect(result.valid).toBe(false)
        expect(result.error).toBe('Duplicate reminder: 7 days before')
      })

      test('returns invalid for duplicate hour reminders', () => {
        const reminders: Reminder[] = [
          { type: 'hour', value: 2 },
          { type: 'hour', value: 2 },
        ]
        const result = validateReminders(reminders)

        expect(result.valid).toBe(false)
        expect(result.error).toBe('Duplicate reminder: 2 hours before')
      })

      test('detects duplicates among many reminders', () => {
        const reminders: Reminder[] = [
          { type: 'day', value: 7 },
          { type: 'day', value: 3 },
          { type: 'hour', value: 2 },
          { type: 'day', value: 3 }, // duplicate
        ]
        const result = validateReminders(reminders)

        expect(result.valid).toBe(false)
        expect(result.error).toBe('Duplicate reminder: 3 days before')
      })
    })

    describe('invalid values', () => {
      test('returns invalid for zero value', () => {
        const result = validateReminders([{ type: 'day', value: 0 }])

        expect(result.valid).toBe(false)
        expect(result.error).toBe('Reminder value must be positive: 0 days before')
      })

      test('returns invalid for negative value', () => {
        const result = validateReminders([{ type: 'hour', value: -1 }])

        expect(result.valid).toBe(false)
        expect(result.error).toBe('Reminder value must be positive: -1 hours before')
      })

      test('returns invalid for invalid type', () => {
        const reminders = [{ type: 'week' as 'day', value: 1 }]
        const result = validateReminders(reminders)

        expect(result.valid).toBe(false)
        expect(result.error).toBe('Invalid reminder type: week')
      })
    })

    describe('validation order', () => {
      test('checks positive value before duplicate (first item fails positive check)', () => {
        const reminders: Reminder[] = [
          { type: 'day', value: 0 },
          { type: 'day', value: 0 },
        ]
        const result = validateReminders(reminders)

        // The positive check happens first in the loop, so the first item with value 0 fails
        expect(result.valid).toBe(false)
        expect(result.error).toContain('Reminder value must be positive')
      })
    })
  })

  describe('shouldSendReminder', () => {
    describe('day-based reminders', () => {
      test('returns true when days until event matches reminder value exactly', () => {
        const eventDate = new Date('2024-12-25T18:00:00Z')
        // Exactly 7 days (168 hours) before
        const now = new Date('2024-12-18T18:00:00Z')

        const result = shouldSendReminder({ type: 'day', value: 7 }, eventDate, now)

        expect(result).toBe(true)
      })

      test('returns false when days until event does not match', () => {
        const eventDate = new Date('2024-12-25T18:00:00Z')
        // Exactly 7 days before
        const now = new Date('2024-12-18T18:00:00Z')

        const result = shouldSendReminder({ type: 'day', value: 3 }, eventDate, now)

        expect(result).toBe(false)
      })

      test('returns true for 1 day before reminder', () => {
        const eventDate = new Date('2024-12-25T18:00:00Z')
        // Exactly 1 day (24 hours) before
        const now = new Date('2024-12-24T18:00:00Z')

        const result = shouldSendReminder({ type: 'day', value: 1 }, eventDate, now)

        expect(result).toBe(true)
      })

      test('handles fractional days by rounding up', () => {
        const eventDate = new Date('2024-12-25T18:00:00Z')
        // 6 days and 12 hours before = 6.5 days -> Math.ceil = 7
        const now = new Date('2024-12-19T06:00:00Z')

        const result = shouldSendReminder({ type: 'day', value: 7 }, eventDate, now)

        expect(result).toBe(true)
      })

      test('returns false when event is in the past', () => {
        const eventDate = new Date('2024-12-25T18:00:00Z')
        const now = new Date('2024-12-26T10:00:00Z') // 1 day after

        const result = shouldSendReminder({ type: 'day', value: 1 }, eventDate, now)

        expect(result).toBe(false)
      })
    })

    describe('hour-based reminders', () => {
      test('returns true when hours until event matches reminder value', () => {
        const eventDate = new Date('2024-12-25T18:00:00Z')
        const now = new Date('2024-12-25T16:00:00Z') // 2 hours before

        const result = shouldSendReminder({ type: 'hour', value: 2 }, eventDate, now)

        expect(result).toBe(true)
      })

      test('returns false when hours until event does not match', () => {
        const eventDate = new Date('2024-12-25T18:00:00Z')
        const now = new Date('2024-12-25T16:00:00Z') // 2 hours before

        const result = shouldSendReminder({ type: 'hour', value: 4 }, eventDate, now)

        expect(result).toBe(false)
      })

      test('returns true for 1 hour before reminder', () => {
        const eventDate = new Date('2024-12-25T18:00:00Z')
        const now = new Date('2024-12-25T17:00:00Z') // 1 hour before

        const result = shouldSendReminder({ type: 'hour', value: 1 }, eventDate, now)

        expect(result).toBe(true)
      })

      test('handles fractional hours by rounding up', () => {
        const eventDate = new Date('2024-12-25T18:00:00Z')
        // 1.5 hours before (rounds up to 2)
        const now = new Date('2024-12-25T16:30:00Z')

        const result = shouldSendReminder({ type: 'hour', value: 2 }, eventDate, now)

        expect(result).toBe(true)
      })

      test('handles 24 hour reminder correctly', () => {
        const eventDate = new Date('2024-12-25T18:00:00Z')
        const now = new Date('2024-12-24T18:00:00Z') // 24 hours before

        const result = shouldSendReminder({ type: 'hour', value: 24 }, eventDate, now)

        expect(result).toBe(true)
      })
    })

    describe('edge cases', () => {
      test('returns true for value 0 when event time equals current time', () => {
        const eventDate = new Date('2024-12-25T18:00:00Z')
        const now = new Date('2024-12-25T18:00:00Z')

        // Math.ceil(0) === 0, so value 0 matches
        const dayResult = shouldSendReminder({ type: 'day', value: 0 }, eventDate, now)
        const hourResult = shouldSendReminder({ type: 'hour', value: 0 }, eventDate, now)

        expect(dayResult).toBe(true)
        expect(hourResult).toBe(true)
      })

      test('returns false for non-zero value when event time equals current time', () => {
        const eventDate = new Date('2024-12-25T18:00:00Z')
        const now = new Date('2024-12-25T18:00:00Z')

        const dayResult = shouldSendReminder({ type: 'day', value: 1 }, eventDate, now)
        const hourResult = shouldSendReminder({ type: 'hour', value: 1 }, eventDate, now)

        expect(dayResult).toBe(false)
        expect(hourResult).toBe(false)
      })

      test('handles very large values correctly', () => {
        const eventDate = new Date('2024-12-25T18:00:00Z')
        const now = new Date('2024-11-25T18:00:00Z') // 30 days before

        const result = shouldSendReminder({ type: 'day', value: 30 }, eventDate, now)

        expect(result).toBe(true)
      })
    })
  })

  describe('serializeReminderSchedule', () => {
    test('returns null for empty array', () => {
      const result = serializeReminderSchedule([])
      expect(result).toBeNull()
    })

    test('serializes single reminder', () => {
      const result = serializeReminderSchedule([{ type: 'day', value: 7 }])

      expect(result).toBe('[{"type":"day","value":7}]')
    })

    test('serializes multiple reminders', () => {
      const reminders: Reminder[] = [
        { type: 'day', value: 7 },
        { type: 'hour', value: 2 },
      ]
      const result = serializeReminderSchedule(reminders)

      expect(result).toBe('[{"type":"day","value":7},{"type":"hour","value":2}]')
    })

    test('serialized output can be parsed back', () => {
      const original: Reminder[] = [
        { type: 'day', value: 7 },
        { type: 'day', value: 3 },
        { type: 'hour', value: 2 },
      ]
      const serialized = serializeReminderSchedule(original)
      const parsed = parseReminderSchedule(serialized)

      expect(parsed).toEqual(original)
    })

    test('roundtrip preserves order', () => {
      const original: Reminder[] = [
        { type: 'hour', value: 2 },
        { type: 'day', value: 1 },
        { type: 'day', value: 7 },
      ]
      const serialized = serializeReminderSchedule(original)
      const parsed = parseReminderSchedule(serialized)

      expect(parsed).toEqual(original)
    })
  })
})
