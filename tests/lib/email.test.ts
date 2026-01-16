import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import nodemailer from 'nodemailer'
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
} from '../setup'

// Store original env vars
const originalEnv = { ...process.env }

// Mock canManageEvent for broadcast tests
vi.mock('@/lib/event-access', () => ({
  canManageEvent: vi.fn(),
  canViewEvent: vi.fn(),
  getEventAccessLevel: vi.fn(),
}))

describe('Email System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset env vars to test defaults
    process.env.SMTP_HOST = 'smtp.test.com'
    process.env.SMTP_PORT = '587'
    process.env.SMTP_USER = 'test@test.com'
    process.env.SMTP_PASSWORD = 'test-password'
    process.env.SMTP_FROM = 'noreply@test.com'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  })

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  describe('Email Configuration (config.ts)', () => {
    describe('getEmailConfig', () => {
      it('should return config from database when available', async () => {
        const dbConfigs = [
          { category: 'email', key: 'SMTP_HOST', value: 'db-smtp.example.com' },
          { category: 'email', key: 'SMTP_PORT', value: '465' },
          { category: 'email', key: 'SMTP_USER', value: 'db-user@example.com' },
          { category: 'email', key: 'SMTP_PASSWORD', value: 'db-password' },
          { category: 'email', key: 'SMTP_FROM', value: 'DB Sender <db-from@example.com>' },
        ]

        vi.mocked(prisma.appConfig.findMany).mockResolvedValue(dbConfigs as any)

        const { getEmailConfig } = await import('@/lib/config')
        const config = await getEmailConfig()

        expect(config).toEqual({
          host: 'db-smtp.example.com',
          port: '465',
          user: 'db-user@example.com',
          password: 'db-password',
          from: 'DB Sender <db-from@example.com>',
        })
      })

      it('should fallback to env vars when database has no config', async () => {
        vi.mocked(prisma.appConfig.findMany).mockResolvedValue([])

        process.env.SMTP_HOST = 'env-smtp.example.com'
        process.env.SMTP_PORT = '587'
        process.env.SMTP_USER = 'env-user@example.com'
        process.env.SMTP_PASSWORD = 'env-password'
        process.env.SMTP_FROM = 'Env Sender <env-from@example.com>'

        const { getEmailConfig } = await import('@/lib/config')
        const config = await getEmailConfig()

        expect(config).toEqual({
          host: 'env-smtp.example.com',
          port: '587',
          user: 'env-user@example.com',
          password: 'env-password',
          from: 'Env Sender <env-from@example.com>',
        })
      })

      it('should return null when neither database nor env vars are configured', async () => {
        vi.mocked(prisma.appConfig.findMany).mockResolvedValue([])

        delete process.env.SMTP_HOST
        delete process.env.SMTP_USER
        delete process.env.SMTP_PASSWORD

        const { getEmailConfig } = await import('@/lib/config')
        const config = await getEmailConfig()

        expect(config).toBeNull()
      })

      it('should handle database errors gracefully and fallback to env vars', async () => {
        vi.mocked(prisma.appConfig.findMany).mockRejectedValue(new Error('DB Error'))

        const { getEmailConfig } = await import('@/lib/config')
        const config = await getEmailConfig()

        expect(config).toEqual({
          host: 'smtp.test.com',
          port: '587',
          user: 'test@test.com',
          password: 'test-password',
          from: 'noreply@test.com',
        })
      })

      it('should handle empty SMTP_FROM in database and fallback to env var', async () => {
        const dbConfigs = [
          { category: 'email', key: 'SMTP_HOST', value: 'db-smtp.example.com' },
          { category: 'email', key: 'SMTP_PORT', value: '587' },
          { category: 'email', key: 'SMTP_USER', value: 'db-user@example.com' },
          { category: 'email', key: 'SMTP_PASSWORD', value: 'db-password' },
          { category: 'email', key: 'SMTP_FROM', value: '   ' }, // Empty/whitespace
        ]

        vi.mocked(prisma.appConfig.findMany).mockResolvedValue(dbConfigs as any)
        process.env.SMTP_FROM = 'fallback@example.com'

        const { getEmailConfig } = await import('@/lib/config')
        const config = await getEmailConfig()

        expect(config?.from).toBe('fallback@example.com')
      })
    })

    describe('getAppUrl', () => {
      it('should return URL from database when available', async () => {
        vi.mocked(prisma.appConfig.findUnique).mockResolvedValue({
          id: '1',
          category: 'app',
          key: 'APP_URL',
          value: 'https://my-app.example.com',
          encrypted: false,
          updatedBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        const { getAppUrl } = await import('@/lib/config')
        const url = await getAppUrl()

        expect(url).toBe('https://my-app.example.com')
      })

      it('should fallback to env var when database has no URL', async () => {
        vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(null)
        process.env.NEXT_PUBLIC_APP_URL = 'https://env-app.example.com'

        const { getAppUrl } = await import('@/lib/config')
        const url = await getAppUrl()

        expect(url).toBe('https://env-app.example.com')
      })

      it('should return default localhost when nothing is configured', async () => {
        vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(null)
        delete process.env.NEXT_PUBLIC_APP_URL

        const { getAppUrl } = await import('@/lib/config')
        const url = await getAppUrl()

        expect(url).toBe('http://localhost:3000')
      })
    })

    describe('updateEmailConfig', () => {
      it('should upsert email config values to database', async () => {
        vi.mocked(prisma.appConfig.upsert).mockResolvedValue({} as any)
        vi.mocked(prisma.appConfig.deleteMany).mockResolvedValue({ count: 0 })

        const { updateEmailConfig } = await import('@/lib/config')
        await updateEmailConfig({
          host: 'new-smtp.example.com',
          port: '465',
          user: 'new-user@example.com',
          password: 'new-password',
          from: 'New Sender <new@example.com>',
        }, 'user-123')

        expect(prisma.appConfig.upsert).toHaveBeenCalledTimes(5)
        expect(prisma.appConfig.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { category_key: { category: 'email', key: 'SMTP_HOST' } },
            update: { value: 'new-smtp.example.com', updatedBy: 'user-123' },
          })
        )
      })

      it('should delete SMTP_FROM from database when cleared', async () => {
        vi.mocked(prisma.appConfig.upsert).mockResolvedValue({} as any)
        vi.mocked(prisma.appConfig.deleteMany).mockResolvedValue({ count: 1 })

        const { updateEmailConfig } = await import('@/lib/config')
        await updateEmailConfig({
          host: 'smtp.example.com',
          port: '587',
          user: 'user@example.com',
          password: 'password',
          from: '', // Empty - should be deleted
        })

        expect(prisma.appConfig.deleteMany).toHaveBeenCalledWith({
          where: { category: 'email', key: 'SMTP_FROM' },
        })
      })
    })
  })

  describe('SMTP Validation (env-validation.ts)', () => {
    describe('validateSmtpConfig', () => {
      it('should return valid when all SMTP config is present in database', async () => {
        const dbConfigs = [
          { category: 'email', key: 'SMTP_HOST', value: 'smtp.example.com' },
          { category: 'email', key: 'SMTP_PORT', value: '587' },
          { category: 'email', key: 'SMTP_USER', value: 'user@example.com' },
          { category: 'email', key: 'SMTP_PASSWORD', value: 'password' },
          { category: 'email', key: 'SMTP_FROM', value: 'sender@example.com' },
        ]

        vi.mocked(prisma.appConfig.findMany).mockResolvedValue(dbConfigs as any)

        const { validateSmtpConfig } = await import('@/lib/env-validation')
        const result = await validateSmtpConfig()

        expect(result.isValid).toBe(true)
        expect(result.missing).toHaveLength(0)
      })

      it('should return missing fields when SMTP config is incomplete', async () => {
        vi.mocked(prisma.appConfig.findMany).mockResolvedValue([])

        delete process.env.SMTP_HOST
        delete process.env.SMTP_PASSWORD

        const { validateSmtpConfig } = await import('@/lib/env-validation')
        const result = await validateSmtpConfig()

        expect(result.isValid).toBe(false)
        expect(result.missing).toContain('SMTP_HOST')
        expect(result.missing).toContain('SMTP_PASSWORD')
      })

      it('should add warning when SMTP_FROM is not set in database config', async () => {
        // Database config without SMTP_FROM
        const dbConfigs = [
          { category: 'email', key: 'SMTP_HOST', value: 'smtp.example.com' },
          { category: 'email', key: 'SMTP_PORT', value: '587' },
          { category: 'email', key: 'SMTP_USER', value: 'user@example.com' },
          { category: 'email', key: 'SMTP_PASSWORD', value: 'password' },
        ]

        vi.mocked(prisma.appConfig.findMany).mockResolvedValue(dbConfigs as any)
        delete process.env.SMTP_FROM // Also remove from env

        const { validateSmtpConfig } = await import('@/lib/env-validation')
        const result = await validateSmtpConfig()

        expect(result.isValid).toBe(true)
        expect(result.warnings).toContain('SMTP_FROM not set, will use SMTP_USER as sender')
      })

      it('should add warning when SMTP_FROM is not set in env fallback', async () => {
        vi.mocked(prisma.appConfig.findMany).mockResolvedValue([])

        // Set required env vars but not SMTP_FROM
        process.env.SMTP_HOST = 'smtp.example.com'
        process.env.SMTP_PORT = '587'
        process.env.SMTP_USER = 'user@example.com'
        process.env.SMTP_PASSWORD = 'password'
        delete process.env.SMTP_FROM

        const { validateSmtpConfig } = await import('@/lib/env-validation')
        const result = await validateSmtpConfig()

        expect(result.isValid).toBe(true)
        expect(result.warnings).toContain('SMTP_FROM not set, will use SMTP_USER as sender')
      })
    })

    describe('isEmailConfigured', () => {
      it('should return true when SMTP is properly configured', async () => {
        const dbConfigs = [
          { category: 'email', key: 'SMTP_HOST', value: 'smtp.example.com' },
          { category: 'email', key: 'SMTP_PORT', value: '587' },
          { category: 'email', key: 'SMTP_USER', value: 'user@example.com' },
          { category: 'email', key: 'SMTP_PASSWORD', value: 'password' },
        ]

        vi.mocked(prisma.appConfig.findMany).mockResolvedValue(dbConfigs as any)

        const { isEmailConfigured } = await import('@/lib/env-validation')
        const result = await isEmailConfigured()

        expect(result).toBe(true)
      })

      it('should return false when SMTP is not configured', async () => {
        vi.mocked(prisma.appConfig.findMany).mockResolvedValue([])

        delete process.env.SMTP_HOST
        delete process.env.SMTP_USER
        delete process.env.SMTP_PASSWORD

        const { isEmailConfigured } = await import('@/lib/env-validation')
        const result = await isEmailConfigured()

        expect(result).toBe(false)
      })
    })
  })

  describe('Email Sending Functions (email.ts)', () => {
    let mockSendMail: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-message-id' })
      vi.mocked(nodemailer.createTransport).mockReturnValue({
        sendMail: mockSendMail,
        verify: vi.fn().mockResolvedValue(true),
      } as any)

      // Setup valid SMTP config
      const dbConfigs = [
        { category: 'email', key: 'SMTP_HOST', value: 'smtp.example.com' },
        { category: 'email', key: 'SMTP_PORT', value: '587' },
        { category: 'email', key: 'SMTP_USER', value: 'user@example.com' },
        { category: 'email', key: 'SMTP_PASSWORD', value: 'password' },
        { category: 'email', key: 'SMTP_FROM', value: 'OwnRSVP <noreply@example.com>' },
      ]
      vi.mocked(prisma.appConfig.findMany).mockResolvedValue(dbConfigs as any)
      vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(null)
    })

    describe('sendInvitation', () => {
      it('should send invitation email with correct content', async () => {
        const { sendInvitation } = await import('@/lib/email')

        await sendInvitation({
          to: 'guest@example.com',
          guestName: 'John Doe',
          event: {
            title: 'Birthday Party',
            date: new Date('2024-12-25T18:00:00Z'),
            location: 'My House',
            description: 'A fun birthday celebration',
          },
          rsvpToken: 'abc123',
          hostName: 'Jane Host',
        })

        expect(mockSendMail).toHaveBeenCalledTimes(1)
        const callArgs = mockSendMail.mock.calls[0][0]
        expect(callArgs.to).toBe('guest@example.com')
        expect(callArgs.subject).toBe("You're invited to Birthday Party!")
        expect(callArgs.html).toContain('Hi John Doe')
        expect(callArgs.html).toContain('Jane Host has invited you')
        expect(callArgs.html).toContain('Birthday Party')
        expect(callArgs.html).toContain('My House')
        expect(callArgs.html).toContain('/rsvp/abc123')
      })

      it('should include custom reply-to when provided', async () => {
        const { sendInvitation } = await import('@/lib/email')

        await sendInvitation({
          to: 'guest@example.com',
          guestName: 'John Doe',
          event: {
            title: 'Event',
            date: new Date(),
          },
          rsvpToken: 'abc123',
          replyTo: 'custom-reply@example.com',
        })

        expect(mockSendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            replyTo: 'custom-reply@example.com',
          })
        )
      })

      it('should use generic greeting when guestName is not provided', async () => {
        const { sendInvitation } = await import('@/lib/email')

        await sendInvitation({
          to: 'guest@example.com',
          event: {
            title: 'Event',
            date: new Date(),
          },
          rsvpToken: 'abc123',
        })

        const callArgs = mockSendMail.mock.calls[0][0]
        expect(callArgs.html).toContain('Hello,')
      })

      it('should throw error when email is not configured', async () => {
        vi.mocked(prisma.appConfig.findMany).mockResolvedValue([])
        delete process.env.SMTP_HOST
        delete process.env.SMTP_USER
        delete process.env.SMTP_PASSWORD

        // Reset module to pick up new config
        vi.resetModules()
        const { sendInvitation } = await import('@/lib/email')

        await expect(
          sendInvitation({
            to: 'guest@example.com',
            event: { title: 'Event', date: new Date() },
            rsvpToken: 'abc123',
          })
        ).rejects.toThrow('Email service not configured')
      })
    })

    describe('sendReminder', () => {
      it('should send reminder email with correct content', async () => {
        const { sendReminder } = await import('@/lib/email')

        await sendReminder({
          to: 'guest@example.com',
          guestName: 'John Doe',
          event: {
            title: 'Birthday Party',
            date: new Date('2024-12-25T18:00:00Z'),
            location: 'My House',
          },
          rsvpToken: 'abc123',
        })

        expect(mockSendMail).toHaveBeenCalledTimes(1)
        const callArgs = mockSendMail.mock.calls[0][0]
        expect(callArgs.to).toBe('guest@example.com')
        expect(callArgs.subject).toBe('Reminder: Please RSVP for Birthday Party')
        expect(callArgs.html).toContain('Reminder: RSVP Needed')
        expect(callArgs.html).toContain('/rsvp/abc123')
      })

      it('should include custom reply-to when provided', async () => {
        const { sendReminder } = await import('@/lib/email')

        await sendReminder({
          to: 'guest@example.com',
          event: {
            title: 'Event',
            date: new Date(),
          },
          rsvpToken: 'abc123',
          replyTo: 'custom-reply@example.com',
        })

        expect(mockSendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            replyTo: 'custom-reply@example.com',
          })
        )
      })
    })

    describe('sendConfirmation', () => {
      it('should send confirmation email for ATTENDING status', async () => {
        const { sendConfirmation } = await import('@/lib/email')

        await sendConfirmation({
          to: 'guest@example.com',
          guestName: 'John Doe',
          event: {
            title: 'Birthday Party',
            date: new Date('2024-12-25T18:00:00Z'),
            location: 'My House',
          },
          status: 'ATTENDING',
          rsvpToken: 'abc123',
        })

        expect(mockSendMail).toHaveBeenCalledTimes(1)
        const callArgs = mockSendMail.mock.calls[0][0]
        expect(callArgs.subject).toBe('RSVP Confirmed for Birthday Party')
        expect(callArgs.html).toContain("We're excited to see you there!")
        expect(callArgs.html).toContain('Event Details')
      })

      it('should send confirmation email for NOT_ATTENDING status', async () => {
        const { sendConfirmation } = await import('@/lib/email')

        await sendConfirmation({
          to: 'guest@example.com',
          guestName: 'John Doe',
          event: {
            title: 'Birthday Party',
            date: new Date(),
          },
          status: 'NOT_ATTENDING',
        })

        const callArgs = mockSendMail.mock.calls[0][0]
        expect(callArgs.html).toContain("We're sorry you can't make it")
      })

      it('should send confirmation email for MAYBE status', async () => {
        const { sendConfirmation } = await import('@/lib/email')

        await sendConfirmation({
          to: 'guest@example.com',
          event: {
            title: 'Event',
            date: new Date(),
          },
          status: 'MAYBE',
        })

        const callArgs = mockSendMail.mock.calls[0][0]
        expect(callArgs.html).toContain('We hope you can make it!')
      })

      it('should include edit RSVP link when token is provided', async () => {
        const { sendConfirmation } = await import('@/lib/email')

        await sendConfirmation({
          to: 'guest@example.com',
          event: {
            title: 'Event',
            date: new Date(),
          },
          status: 'ATTENDING',
          rsvpToken: 'abc123',
        })

        const callArgs = mockSendMail.mock.calls[0][0]
        expect(callArgs.html).toContain('/rsvp/abc123/edit')
        expect(callArgs.html).toContain('Edit Your RSVP')
      })

      it('should include custom reply-to when provided', async () => {
        const { sendConfirmation } = await import('@/lib/email')

        await sendConfirmation({
          to: 'guest@example.com',
          event: {
            title: 'Event',
            date: new Date(),
          },
          status: 'ATTENDING',
          replyTo: 'host@example.com',
        })

        expect(mockSendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            replyTo: 'host@example.com',
          })
        )
      })
    })

    describe('sendBroadcastEmail', () => {
      it('should send broadcast email with correct content', async () => {
        const { sendBroadcastEmail } = await import('@/lib/email')

        await sendBroadcastEmail({
          to: 'guest@example.com',
          guestName: 'John Doe',
          subject: 'Important Update',
          message: 'The venue has changed!',
          eventTitle: 'Birthday Party',
        })

        expect(mockSendMail).toHaveBeenCalledTimes(1)
        const callArgs = mockSendMail.mock.calls[0][0]
        expect(callArgs.to).toBe('guest@example.com')
        expect(callArgs.subject).toBe('[Birthday Party] Important Update')
        expect(callArgs.html).toContain('Hi John Doe')
        expect(callArgs.html).toContain('Important Update')
        expect(callArgs.html).toContain('The venue has changed!')
      })

      it('should include custom reply-to when provided', async () => {
        const { sendBroadcastEmail } = await import('@/lib/email')

        await sendBroadcastEmail({
          to: 'guest@example.com',
          subject: 'Update',
          message: 'Message content',
          eventTitle: 'Event',
          replyTo: 'host@example.com',
        })

        expect(mockSendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            replyTo: 'host@example.com',
          })
        )
      })
    })

    describe('sendPasswordResetEmail', () => {
      it('should send password reset email with correct content', async () => {
        const { sendPasswordResetEmail } = await import('@/lib/email')

        await sendPasswordResetEmail(
          'user@example.com',
          'http://localhost:3000/reset?token=abc123',
          'John Doe'
        )

        expect(mockSendMail).toHaveBeenCalledTimes(1)
        const callArgs = mockSendMail.mock.calls[0][0]
        expect(callArgs.to).toBe('user@example.com')
        expect(callArgs.subject).toBe('Reset Your Password')
        expect(callArgs.html).toContain('Hi John Doe')
        expect(callArgs.html).toContain('http://localhost:3000/reset?token=abc123')
        expect(callArgs.html).toContain('1 hour')
      })
    })

    describe('sendEventChangeEmail', () => {
      it('should send event change notification with changes list', async () => {
        const { sendEventChangeEmail } = await import('@/lib/email')

        await sendEventChangeEmail({
          to: 'guest@example.com',
          guestName: 'John Doe',
          eventTitle: 'Birthday Party',
          changes: [
            { field: 'Date', oldValue: 'Dec 24', newValue: 'Dec 25' },
            { field: 'Location', oldValue: 'My House', newValue: 'Park' },
          ],
          rsvpToken: 'abc123',
        })

        expect(mockSendMail).toHaveBeenCalledTimes(1)
        const callArgs = mockSendMail.mock.calls[0][0]
        expect(callArgs.subject).toBe('Event Update: Birthday Party')
        expect(callArgs.html).toContain('Date')
        expect(callArgs.html).toContain('Dec 24')
        expect(callArgs.html).toContain('Dec 25')
        expect(callArgs.html).toContain('Location')
      })

      it('should include custom reply-to when provided', async () => {
        const { sendEventChangeEmail } = await import('@/lib/email')

        await sendEventChangeEmail({
          to: 'guest@example.com',
          eventTitle: 'Event',
          changes: [{ field: 'Date', oldValue: 'Old', newValue: 'New' }],
          rsvpToken: 'abc123',
          replyTo: 'host@example.com',
        })

        expect(mockSendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            replyTo: 'host@example.com',
          })
        )
      })
    })

    describe('sendUserInvitationEmail', () => {
      it('should send user invitation email with correct content', async () => {
        const { sendUserInvitationEmail } = await import('@/lib/email')

        await sendUserInvitationEmail({
          to: 'newuser@example.com',
          invitationUrl: 'http://localhost:3000/accept-invite?token=xyz',
          invitedByName: 'Admin User',
          role: 'USER',
        })

        expect(mockSendMail).toHaveBeenCalledTimes(1)
        const callArgs = mockSendMail.mock.calls[0][0]
        expect(callArgs.to).toBe('newuser@example.com')
        expect(callArgs.subject).toBe("You've Been Invited to OwnRSVP")
        expect(callArgs.html).toContain('Admin User has invited')
        expect(callArgs.html).toContain('http://localhost:3000/accept-invite?token=xyz')
        expect(callArgs.html).toContain('Role:</strong> User')
      })

      it('should show Admin role correctly', async () => {
        const { sendUserInvitationEmail } = await import('@/lib/email')

        await sendUserInvitationEmail({
          to: 'newadmin@example.com',
          invitationUrl: 'http://localhost:3000/accept-invite?token=xyz',
          role: 'ADMIN',
        })

        const callArgs = mockSendMail.mock.calls[0][0]
        expect(callArgs.html).toContain('Role:</strong> Administrator')
      })
    })

    describe('sendRsvpChangeNotification', () => {
      it('should send NEW RSVP notification to host', async () => {
        const { sendRsvpChangeNotification } = await import('@/lib/email')

        await sendRsvpChangeNotification({
          to: 'host@example.com',
          hostName: 'Event Host',
          event: {
            title: 'Birthday Party',
            date: new Date('2024-12-25T18:00:00Z'),
            location: 'My House',
          },
          guest: {
            name: 'John Doe',
            email: 'john@example.com',
            status: 'ATTENDING',
          },
          changeType: 'NEW',
          eventUrl: 'http://localhost:3000/dashboard/events/123',
        })

        expect(mockSendMail).toHaveBeenCalledTimes(1)
        const callArgs = mockSendMail.mock.calls[0][0]
        expect(callArgs.subject).toBe('New RSVP for Birthday Party')
        expect(callArgs.html).toContain('Hi Event Host')
        expect(callArgs.html).toContain('A guest has submitted an RSVP')
        expect(callArgs.html).toContain('John Doe')
        expect(callArgs.html).toContain('Attending')
      })

      it('should send STATUS_CHANGED notification with previous status', async () => {
        const { sendRsvpChangeNotification } = await import('@/lib/email')

        await sendRsvpChangeNotification({
          to: 'host@example.com',
          event: {
            title: 'Event',
            date: new Date(),
          },
          guest: {
            name: 'John Doe',
            email: 'john@example.com',
            status: 'NOT_ATTENDING',
          },
          changeType: 'STATUS_CHANGED',
          previousStatus: 'ATTENDING',
          eventUrl: 'http://localhost:3000/dashboard/events/123',
        })

        const callArgs = mockSendMail.mock.calls[0][0]
        expect(callArgs.subject).toBe('RSVP Status Changed for Event')
        expect(callArgs.html).toContain('Attending')
        expect(callArgs.html).toContain('Not Attending')
        expect(callArgs.html).toContain('Status Changed:')
      })

      it('should include additional guests in notification', async () => {
        const { sendRsvpChangeNotification } = await import('@/lib/email')

        await sendRsvpChangeNotification({
          to: 'host@example.com',
          event: {
            title: 'Event',
            date: new Date(),
          },
          guest: {
            name: 'John Doe',
            email: 'john@example.com',
            status: 'ATTENDING',
            additionalGuests: [{ name: 'Jane Doe' }, { name: 'Bob Smith' }],
          },
          changeType: 'NEW',
          eventUrl: 'http://localhost:3000/dashboard/events/123',
        })

        const callArgs = mockSendMail.mock.calls[0][0]
        expect(callArgs.html).toContain('Additional Guests')
        expect(callArgs.html).toContain('Jane Doe')
        expect(callArgs.html).toContain('Bob Smith')
      })

      it('should include dietary notes in notification', async () => {
        const { sendRsvpChangeNotification } = await import('@/lib/email')

        await sendRsvpChangeNotification({
          to: 'host@example.com',
          event: {
            title: 'Event',
            date: new Date(),
          },
          guest: {
            name: 'John Doe',
            email: 'john@example.com',
            status: 'ATTENDING',
            dietaryNotes: 'Vegetarian, no nuts',
          },
          changeType: 'NEW',
          eventUrl: 'http://localhost:3000/dashboard/events/123',
        })

        const callArgs = mockSendMail.mock.calls[0][0]
        expect(callArgs.html).toContain('Dietary Notes')
        expect(callArgs.html).toContain('Vegetarian, no nuts')
      })

      it('should not throw when email is not configured', async () => {
        vi.mocked(prisma.appConfig.findMany).mockResolvedValue([])
        delete process.env.SMTP_HOST
        delete process.env.SMTP_USER
        delete process.env.SMTP_PASSWORD

        vi.resetModules()
        const { sendRsvpChangeNotification } = await import('@/lib/email')

        // Should not throw, just silently skip
        await expect(
          sendRsvpChangeNotification({
            to: 'host@example.com',
            event: { title: 'Event', date: new Date() },
            guest: { name: 'Guest', email: 'guest@example.com', status: 'ATTENDING' },
            changeType: 'NEW',
            eventUrl: 'http://localhost:3000/dashboard/events/123',
          })
        ).resolves.not.toThrow()
      })
    })

    describe('getEventHostsForNotification', () => {
      it('should return hosts with notifications enabled', async () => {
        const mockEvent = {
          id: 'event-1',
          host: {
            id: 'user-1',
            name: 'Host User',
            email: 'host@example.com',
            notifyOnRsvpChanges: true,
            senderEmail: 'custom@example.com',
          },
          coHosts: [
            {
              user: {
                id: 'user-2',
                name: 'Co-Host',
                email: 'cohost@example.com',
                notifyOnRsvpChanges: true,
                senderEmail: null,
              },
            },
            {
              user: {
                id: 'user-3',
                name: 'Silent Co-Host',
                email: 'silent@example.com',
                notifyOnRsvpChanges: false,
              },
            },
          ],
        }

        vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)

        const { getEventHostsForNotification } = await import('@/lib/email')
        const hosts = await getEventHostsForNotification('event-1')

        expect(hosts).toHaveLength(2)
        expect(hosts[0]).toEqual({
          id: 'user-1',
          name: 'Host User',
          email: 'host@example.com',
          senderEmail: 'custom@example.com',
        })
        expect(hosts[1]).toEqual({
          id: 'user-2',
          name: 'Co-Host',
          email: 'cohost@example.com',
          senderEmail: null,
        })
      })

      it('should return empty array when event not found', async () => {
        vi.mocked(prisma.event.findUnique).mockResolvedValue(null)

        const { getEventHostsForNotification } = await import('@/lib/email')
        const hosts = await getEventHostsForNotification('nonexistent')

        expect(hosts).toHaveLength(0)
      })
    })

    describe('SMTP Transporter Creation', () => {
      it('should create transporter with database config', async () => {
        const dbConfigs = [
          { category: 'email', key: 'SMTP_HOST', value: 'db-smtp.example.com' },
          { category: 'email', key: 'SMTP_PORT', value: '465' },
          { category: 'email', key: 'SMTP_USER', value: 'db-user@example.com' },
          { category: 'email', key: 'SMTP_PASSWORD', value: 'db-password' },
        ]

        vi.mocked(prisma.appConfig.findMany).mockResolvedValue(dbConfigs as any)

        const { sendInvitation } = await import('@/lib/email')
        await sendInvitation({
          to: 'guest@example.com',
          event: { title: 'Event', date: new Date() },
          rsvpToken: 'abc123',
        })

        expect(nodemailer.createTransport).toHaveBeenCalledWith({
          host: 'db-smtp.example.com',
          port: 465,
          secure: true, // Port 465 should use secure
          auth: {
            user: 'db-user@example.com',
            pass: 'db-password',
          },
        })
      })

      it('should use secure connection for port 465', async () => {
        const dbConfigs = [
          { category: 'email', key: 'SMTP_HOST', value: 'smtp.example.com' },
          { category: 'email', key: 'SMTP_PORT', value: '465' },
          { category: 'email', key: 'SMTP_USER', value: 'user@example.com' },
          { category: 'email', key: 'SMTP_PASSWORD', value: 'password' },
        ]

        vi.mocked(prisma.appConfig.findMany).mockResolvedValue(dbConfigs as any)
        vi.resetModules()

        const { sendInvitation } = await import('@/lib/email')
        await sendInvitation({
          to: 'guest@example.com',
          event: { title: 'Event', date: new Date() },
          rsvpToken: 'abc123',
        })

        expect(nodemailer.createTransport).toHaveBeenCalledWith(
          expect.objectContaining({ secure: true })
        )
      })

      it('should not use secure connection for port 587', async () => {
        const dbConfigs = [
          { category: 'email', key: 'SMTP_HOST', value: 'smtp.example.com' },
          { category: 'email', key: 'SMTP_PORT', value: '587' },
          { category: 'email', key: 'SMTP_USER', value: 'user@example.com' },
          { category: 'email', key: 'SMTP_PASSWORD', value: 'password' },
        ]

        vi.mocked(prisma.appConfig.findMany).mockResolvedValue(dbConfigs as any)
        vi.resetModules()

        const { sendInvitation } = await import('@/lib/email')
        await sendInvitation({
          to: 'guest@example.com',
          event: { title: 'Event', date: new Date() },
          rsvpToken: 'abc123',
        })

        expect(nodemailer.createTransport).toHaveBeenCalledWith(
          expect.objectContaining({ secure: false })
        )
      })
    })

    describe('From Address Logic', () => {
      it('should use explicit from address when set', async () => {
        const dbConfigs = [
          { category: 'email', key: 'SMTP_HOST', value: 'smtp.example.com' },
          { category: 'email', key: 'SMTP_PORT', value: '587' },
          { category: 'email', key: 'SMTP_USER', value: 'user@example.com' },
          { category: 'email', key: 'SMTP_PASSWORD', value: 'password' },
          { category: 'email', key: 'SMTP_FROM', value: 'Custom Sender <custom@example.com>' },
        ]

        vi.mocked(prisma.appConfig.findMany).mockResolvedValue(dbConfigs as any)
        vi.resetModules()

        const { sendInvitation } = await import('@/lib/email')
        await sendInvitation({
          to: 'guest@example.com',
          event: { title: 'Event', date: new Date() },
          rsvpToken: 'abc123',
        })

        expect(mockSendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            from: 'Custom Sender <custom@example.com>',
          })
        )
      })

      it('should fallback to SMTP_USER with app name when from is not set in DB', async () => {
        // Database config without SMTP_FROM
        const dbConfigs = [
          { category: 'email', key: 'SMTP_HOST', value: 'smtp.example.com' },
          { category: 'email', key: 'SMTP_PORT', value: '587' },
          { category: 'email', key: 'SMTP_USER', value: 'user@example.com' },
          { category: 'email', key: 'SMTP_PASSWORD', value: 'password' },
        ]

        vi.mocked(prisma.appConfig.findMany).mockResolvedValue(dbConfigs as any)

        // Also remove env var fallback - need to remove before import
        delete process.env.SMTP_FROM
        delete process.env.SMTP_USER

        vi.resetModules()
        const { sendInvitation } = await import('@/lib/email')
        await sendInvitation({
          to: 'guest@example.com',
          event: { title: 'Event', date: new Date() },
          rsvpToken: 'abc123',
        })

        // The "from" should use the DB config SMTP_USER since SMTP_FROM is not set
        const callArgs = mockSendMail.mock.calls[0][0]
        expect(callArgs.from).toBe('OwnRSVP <user@example.com>')
      })
    })

    describe('Error Handling', () => {
      it('should throw when SMTP send fails', async () => {
        mockSendMail.mockRejectedValue(new Error('SMTP connection failed'))

        const { sendInvitation } = await import('@/lib/email')

        await expect(
          sendInvitation({
            to: 'guest@example.com',
            event: { title: 'Event', date: new Date() },
            rsvpToken: 'abc123',
          })
        ).rejects.toThrow('SMTP connection failed')
      })
    })
  })

  describe('Test Email Endpoint (/api/test-email)', () => {
    let authMock: ReturnType<typeof vi.fn>

    beforeEach(async () => {
      // Create auth mock
      authMock = vi.fn()

      // Re-mock @/auth with fresh mock before importing routes
      vi.doMock('@/auth', () => ({
        auth: authMock,
        signIn: vi.fn(),
        signOut: vi.fn(),
      }))

      // Setup valid SMTP config
      const dbConfigs = [
        { category: 'email', key: 'SMTP_HOST', value: 'smtp.example.com' },
        { category: 'email', key: 'SMTP_PORT', value: '587' },
        { category: 'email', key: 'SMTP_USER', value: 'user@example.com' },
        { category: 'email', key: 'SMTP_PASSWORD', value: 'password' },
        { category: 'email', key: 'SMTP_FROM', value: 'noreply@example.com' },
      ]
      vi.mocked(prisma.appConfig.findMany).mockResolvedValue(dbConfigs as any)
      vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(null)
    })

    describe('POST /api/test-email', () => {
      it('should return 401 when not authenticated', async () => {
        authMock.mockResolvedValue(null)

        const { POST } = await import('@/app/api/test-email/route')
        const request = createMockRequest('POST', '/api/test-email', {
          body: { testEmail: 'test@example.com' },
        })

        const response = await POST(request)
        expect(response.status).toBe(401)
      })

      it('should return 403 when user is not admin', async () => {
        authMock.mockResolvedValue({
          user: { id: 'user-1', email: 'user@example.com', role: 'USER', name: 'Test User' },
        })
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'USER' } as any)

        const { POST } = await import('@/app/api/test-email/route')
        const request = createMockRequest('POST', '/api/test-email', {
          body: { testEmail: 'test@example.com' },
        })

        const response = await POST(request)
        expect(response.status).toBe(403)
      })

      it('should return 400 when testEmail is missing', async () => {
        authMock.mockResolvedValue({
          user: { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN', name: 'Admin User' },
        })
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'ADMIN' } as any)

        const { POST } = await import('@/app/api/test-email/route')
        const request = createMockRequest('POST', '/api/test-email', {
          body: {},
        })

        const response = await POST(request)
        expect(response.status).toBe(400)
        const body = await parseJsonResponse(response)
        expect(body.error).toBe('testEmail is required')
      })

      it('should return 400 for invalid email format', async () => {
        authMock.mockResolvedValue({
          user: { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN', name: 'Admin User' },
        })
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'ADMIN' } as any)

        const { POST } = await import('@/app/api/test-email/route')
        const request = createMockRequest('POST', '/api/test-email', {
          body: { testEmail: 'invalid-email' },
        })

        const response = await POST(request)
        expect(response.status).toBe(400)
        const body = await parseJsonResponse(response)
        expect(body.error).toBe('Invalid email format')
      })

      it('should return 400 when SMTP is not configured', async () => {
        authMock.mockResolvedValue({
          user: { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN', name: 'Admin User' },
        })
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'ADMIN' } as any)
        vi.mocked(prisma.appConfig.findMany).mockResolvedValue([])

        delete process.env.SMTP_HOST
        delete process.env.SMTP_USER
        delete process.env.SMTP_PASSWORD

        const { POST } = await import('@/app/api/test-email/route')
        const request = createMockRequest('POST', '/api/test-email', {
          body: { testEmail: 'test@example.com' },
        })

        const response = await POST(request)
        expect(response.status).toBe(400)
        const body = await parseJsonResponse(response)
        expect(body.error).toBe('SMTP not configured')
      })

      it('should send test email successfully', async () => {
        authMock.mockResolvedValue({
          user: { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN', name: 'Admin User' },
        })
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'ADMIN' } as any)

        const { POST } = await import('@/app/api/test-email/route')
        const request = createMockRequest('POST', '/api/test-email', {
          body: { testEmail: 'test@example.com' },
        })

        const response = await POST(request)
        expect(response.status).toBe(200)
        const body = await parseJsonResponse(response)
        expect(body.success).toBe(true)
        expect(body.message).toContain('test@example.com')
      })
    })

    describe('GET /api/test-email', () => {
      it('should return 401 when not authenticated', async () => {
        authMock.mockResolvedValue(null)

        const { GET } = await import('@/app/api/test-email/route')
        const response = await GET()
        expect(response.status).toBe(401)
      })

      it('should return 403 when user is not admin', async () => {
        authMock.mockResolvedValue({
          user: { id: 'user-1', email: 'user@example.com', role: 'USER', name: 'Test User' },
        })
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'USER' } as any)

        const { GET } = await import('@/app/api/test-email/route')
        const response = await GET()
        expect(response.status).toBe(403)
      })

      it('should return SMTP config status for admin', async () => {
        authMock.mockResolvedValue({
          user: { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN', name: 'Admin User' },
        })
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'ADMIN' } as any)

        const { GET } = await import('@/app/api/test-email/route')
        const response = await GET()
        expect(response.status).toBe(200)
        const body = await parseJsonResponse(response)
        expect(body.configured).toBe(true)
        expect(body.config).toBeDefined()
        expect(body.config.host).toBe('smtp.example.com')
      })
    })
  })

  describe('Broadcast Endpoint (/api/events/[id]/broadcast)', () => {
    let authMock: ReturnType<typeof vi.fn>

    beforeEach(async () => {
      // Create auth mock
      authMock = vi.fn()

      // Re-mock @/auth with fresh mock before importing routes
      vi.doMock('@/auth', () => ({
        auth: authMock,
        signIn: vi.fn(),
        signOut: vi.fn(),
      }))

      // Setup valid SMTP config
      const dbConfigs = [
        { category: 'email', key: 'SMTP_HOST', value: 'smtp.example.com' },
        { category: 'email', key: 'SMTP_PORT', value: '587' },
        { category: 'email', key: 'SMTP_USER', value: 'user@example.com' },
        { category: 'email', key: 'SMTP_PASSWORD', value: 'password' },
      ]
      vi.mocked(prisma.appConfig.findMany).mockResolvedValue(dbConfigs as any)
      vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(null)
    })

    describe('POST /api/events/[id]/broadcast', () => {
      it('should return 401 when not authenticated', async () => {
        authMock.mockResolvedValue(null)

        const { POST } = await import('@/app/api/events/[id]/broadcast/route')
        const request = createMockRequest('POST', '/api/events/event-1/broadcast', {
          body: { subject: 'Test', message: 'Hello' },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await POST(request, context)
        expect(response.status).toBe(401)
      })

      it('should return 403 when user cannot manage event', async () => {
        authMock.mockResolvedValue({
          user: { id: 'user-1', email: 'user@example.com', role: 'USER', name: 'Test User' },
        })

        // Mock canManageEvent to return false
        const { canManageEvent } = await import('@/lib/event-access')
        vi.mocked(canManageEvent).mockResolvedValue(false)

        const { POST } = await import('@/app/api/events/[id]/broadcast/route')
        const request = createMockRequest('POST', '/api/events/event-1/broadcast', {
          body: { subject: 'Test', message: 'Hello' },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await POST(request, context)
        expect(response.status).toBe(403)
      })

      it('should return 400 when subject is missing', async () => {
        authMock.mockResolvedValue({
          user: { id: 'user-1', email: 'user@example.com', role: 'USER', name: 'Test User' },
        })

        const { canManageEvent } = await import('@/lib/event-access')
        vi.mocked(canManageEvent).mockResolvedValue(true)

        const { POST } = await import('@/app/api/events/[id]/broadcast/route')
        const request = createMockRequest('POST', '/api/events/event-1/broadcast', {
          body: { message: 'Hello' },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await POST(request, context)
        expect(response.status).toBe(400)
      })

      it('should send broadcast to all guests with notifyByEmail enabled', async () => {
        authMock.mockResolvedValue({
          user: { id: 'user-1', email: 'user@example.com', role: 'USER', name: 'Test User' },
        })

        const { canManageEvent } = await import('@/lib/event-access')
        vi.mocked(canManageEvent).mockResolvedValue(true)

        const mockEvent = {
          id: 'event-1',
          hostId: 'user-1',
          title: 'Test Event',
          replyTo: 'reply@example.com',
          guests: [
            { id: 'g1', email: 'guest1@example.com', name: 'Guest 1', notifyByEmail: true },
            { id: 'g2', email: 'guest2@example.com', name: 'Guest 2', notifyByEmail: true },
            { id: 'g3', email: 'guest3@example.com', name: 'Guest 3', notifyByEmail: false },
          ],
        }

        vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
        vi.mocked(prisma.eventUpdate.create).mockResolvedValue({} as any)

        const { POST } = await import('@/app/api/events/[id]/broadcast/route')
        const request = createMockRequest('POST', '/api/events/event-1/broadcast', {
          body: { subject: 'Important Update', message: 'Hello everyone!' },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await POST(request, context)
        expect(response.status).toBe(200)
        const body = await parseJsonResponse(response)
        expect(body.success).toBe(true)
        expect(body.sentTo).toBe(2) // Only guests with notifyByEmail: true
      })

      it('should filter guests by status when filterStatus is provided', async () => {
        authMock.mockResolvedValue({
          user: { id: 'user-1', email: 'user@example.com', role: 'USER', name: 'Test User' },
        })

        const { canManageEvent } = await import('@/lib/event-access')
        vi.mocked(canManageEvent).mockResolvedValue(true)

        const mockEvent = {
          id: 'event-1',
          hostId: 'user-1',
          title: 'Test Event',
          guests: [
            { id: 'g1', email: 'guest1@example.com', name: 'Guest 1', notifyByEmail: true, status: 'ATTENDING' },
          ],
        }

        vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
        vi.mocked(prisma.eventUpdate.create).mockResolvedValue({} as any)

        const { POST } = await import('@/app/api/events/[id]/broadcast/route')
        const request = createMockRequest('POST', '/api/events/event-1/broadcast', {
          body: { subject: 'Update', message: 'Hello', filterStatus: 'ATTENDING' },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await POST(request, context)
        expect(response.status).toBe(200)
      })

      it('should record broadcast in eventUpdate', async () => {
        authMock.mockResolvedValue({
          user: { id: 'user-1', email: 'user@example.com', role: 'USER', name: 'Test User' },
        })

        const { canManageEvent } = await import('@/lib/event-access')
        vi.mocked(canManageEvent).mockResolvedValue(true)

        const mockEvent = {
          id: 'event-1',
          hostId: 'user-1',
          title: 'Test Event',
          guests: [],
        }

        vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
        vi.mocked(prisma.eventUpdate.create).mockResolvedValue({} as any)

        const { POST } = await import('@/app/api/events/[id]/broadcast/route')
        const request = createMockRequest('POST', '/api/events/event-1/broadcast', {
          body: { subject: 'Update', message: 'Hello' },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        await POST(request, context)

        expect(prisma.eventUpdate.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            eventId: 'event-1',
            subject: 'Update',
            message: 'Hello',
            sentVia: 'EMAIL',
            sentTo: 0,
            sentBy: 'user-1',
          }),
        })
      })

      it('should return 404 when event not found', async () => {
        authMock.mockResolvedValue({
          user: { id: 'user-1', email: 'user@example.com', role: 'USER', name: 'Test User' },
        })

        const { canManageEvent } = await import('@/lib/event-access')
        vi.mocked(canManageEvent).mockResolvedValue(true)
        vi.mocked(prisma.event.findUnique).mockResolvedValue(null)

        const { POST } = await import('@/app/api/events/[id]/broadcast/route')
        const request = createMockRequest('POST', '/api/events/event-1/broadcast', {
          body: { subject: 'Update', message: 'Hello' },
        })
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await POST(request, context)
        expect(response.status).toBe(404)
      })
    })

    describe('GET /api/events/[id]/broadcast', () => {
      it('should return broadcast history', async () => {
        authMock.mockResolvedValue({
          user: { id: 'user-1', email: 'user@example.com', role: 'USER', name: 'Test User' },
        })

        const { canManageEvent } = await import('@/lib/event-access')
        vi.mocked(canManageEvent).mockResolvedValue(true)

        const mockUpdates = [
          { id: '1', subject: 'Update 1', sentAt: new Date() },
          { id: '2', subject: 'Update 2', sentAt: new Date() },
        ]
        vi.mocked(prisma.eventUpdate.findMany).mockResolvedValue(mockUpdates as any)

        const { GET } = await import('@/app/api/events/[id]/broadcast/route')
        const request = createMockRequest('GET', '/api/events/event-1/broadcast')
        const context = createMockRouteContext({ id: 'event-1' })

        const response = await GET(request, context)
        expect(response.status).toBe(200)
        const body = await parseJsonResponse(response)
        expect(body.updates).toHaveLength(2)
      })
    })
  })

  describe('Cron Reminders Endpoint (/api/cron/reminders)', () => {
    beforeEach(async () => {
      // Setup valid SMTP config
      const dbConfigs = [
        { category: 'email', key: 'SMTP_HOST', value: 'smtp.example.com' },
        { category: 'email', key: 'SMTP_PORT', value: '587' },
        { category: 'email', key: 'SMTP_USER', value: 'user@example.com' },
        { category: 'email', key: 'SMTP_PASSWORD', value: 'password' },
      ]
      vi.mocked(prisma.appConfig.findMany).mockResolvedValue(dbConfigs as any)
      vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(null)
    })

    describe('CRON_SECRET validation', () => {
      it('should return 401 when CRON_SECRET is set but request has no auth header', async () => {
        process.env.CRON_SECRET = 'my-secret'

        const { POST } = await import('@/app/api/cron/reminders/route')
        const request = createMockRequest('POST', '/api/cron/reminders')

        const response = await POST(request)
        expect(response.status).toBe(401)
      })

      it('should return 401 when CRON_SECRET does not match', async () => {
        process.env.CRON_SECRET = 'my-secret'

        const { POST } = await import('@/app/api/cron/reminders/route')
        const request = createMockRequest('POST', '/api/cron/reminders', {
          headers: { authorization: 'Bearer wrong-secret' },
        })

        const response = await POST(request)
        expect(response.status).toBe(401)
      })

      it('should allow request when CRON_SECRET matches', async () => {
        process.env.CRON_SECRET = 'my-secret'
        vi.mocked(prisma.event.findMany).mockResolvedValue([])

        const { POST } = await import('@/app/api/cron/reminders/route')
        const request = createMockRequest('POST', '/api/cron/reminders', {
          headers: { authorization: 'Bearer my-secret' },
        })

        const response = await POST(request)
        expect(response.status).toBe(200)
      })

      it('should allow request when CRON_SECRET is not set', async () => {
        delete process.env.CRON_SECRET
        vi.mocked(prisma.event.findMany).mockResolvedValue([])

        const { POST } = await import('@/app/api/cron/reminders/route')
        const request = createMockRequest('POST', '/api/cron/reminders')

        const response = await POST(request)
        expect(response.status).toBe(200)
      })
    })

    describe('Reminder sending logic', () => {
      beforeEach(() => {
        delete process.env.CRON_SECRET
      })

      it('should send reminders for events 2 days away (default schedule)', async () => {
        const twoDaysFromNow = new Date()
        twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2)

        const mockEvents = [
          {
            id: 'event-1',
            title: 'Upcoming Event',
            date: twoDaysFromNow,
            location: 'Test Location',
            reminderSchedule: null, // Default schedule
            replyTo: null,
            guests: [
              {
                id: 'guest-1',
                email: 'guest@example.com',
                name: 'Test Guest',
                token: 'abc123',
                status: 'PENDING',
                notifyByEmail: true,
                reminderSentAt: null,
              },
            ],
          },
        ]

        vi.mocked(prisma.event.findMany).mockResolvedValue(mockEvents as any)
        vi.mocked(prisma.guest.update).mockResolvedValue({} as any)

        const { POST } = await import('@/app/api/cron/reminders/route')
        const request = createMockRequest('POST', '/api/cron/reminders')

        const response = await POST(request)
        expect(response.status).toBe(200)
        const body = await parseJsonResponse(response)
        expect(body.emailsSent).toBe(1)
      })

      it('should not send reminders if already sent', async () => {
        const twoDaysFromNow = new Date()
        twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2)

        const mockEvents = [
          {
            id: 'event-1',
            title: 'Event',
            date: twoDaysFromNow,
            reminderSchedule: null,
            guests: [
              {
                id: 'guest-1',
                email: 'guest@example.com',
                name: 'Guest',
                token: 'abc123',
                status: 'PENDING',
                notifyByEmail: true,
                reminderSentAt: new Date(), // Already sent
              },
            ],
          },
        ]

        vi.mocked(prisma.event.findMany).mockResolvedValue(mockEvents as any)

        const { POST } = await import('@/app/api/cron/reminders/route')
        const request = createMockRequest('POST', '/api/cron/reminders')

        const response = await POST(request)
        const body = await parseJsonResponse(response)
        expect(body.emailsSent).toBe(0)
      })

      it('should not send reminders to guests with notifyByEmail: false', async () => {
        const twoDaysFromNow = new Date()
        twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2)

        const mockEvents = [
          {
            id: 'event-1',
            title: 'Event',
            date: twoDaysFromNow,
            reminderSchedule: null,
            guests: [
              {
                id: 'guest-1',
                email: 'guest@example.com',
                name: 'Guest',
                token: 'abc123',
                status: 'PENDING',
                notifyByEmail: false,
                reminderSentAt: null,
              },
            ],
          },
        ]

        vi.mocked(prisma.event.findMany).mockResolvedValue(mockEvents as any)

        const { POST } = await import('@/app/api/cron/reminders/route')
        const request = createMockRequest('POST', '/api/cron/reminders')

        const response = await POST(request)
        const body = await parseJsonResponse(response)
        expect(body.emailsSent).toBe(0)
      })

      it('should use custom reminder schedule when set', async () => {
        // Set event 7 days from now
        const sevenDaysFromNow = new Date()
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

        const mockEvents = [
          {
            id: 'event-1',
            title: 'Event',
            date: sevenDaysFromNow,
            reminderSchedule: '[{"type":"day","value":7}]',
            guests: [
              {
                id: 'guest-1',
                email: 'guest@example.com',
                name: 'Guest',
                token: 'abc123',
                status: 'PENDING',
                notifyByEmail: true,
                reminderSentAt: null,
              },
            ],
          },
        ]

        vi.mocked(prisma.event.findMany).mockResolvedValue(mockEvents as any)
        vi.mocked(prisma.guest.update).mockResolvedValue({} as any)

        const { POST } = await import('@/app/api/cron/reminders/route')
        const request = createMockRequest('POST', '/api/cron/reminders')

        const response = await POST(request)
        const body = await parseJsonResponse(response)
        expect(body.emailsSent).toBe(1)
      })

      it('should update reminderSentAt after sending', async () => {
        const twoDaysFromNow = new Date()
        twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2)

        const mockEvents = [
          {
            id: 'event-1',
            title: 'Event',
            date: twoDaysFromNow,
            reminderSchedule: null,
            guests: [
              {
                id: 'guest-1',
                email: 'guest@example.com',
                name: 'Guest',
                token: 'abc123',
                status: 'PENDING',
                notifyByEmail: true,
                reminderSentAt: null,
              },
            ],
          },
        ]

        vi.mocked(prisma.event.findMany).mockResolvedValue(mockEvents as any)
        vi.mocked(prisma.guest.update).mockResolvedValue({} as any)

        const { POST } = await import('@/app/api/cron/reminders/route')
        const request = createMockRequest('POST', '/api/cron/reminders')

        await POST(request)

        expect(prisma.guest.update).toHaveBeenCalledWith({
          where: { id: 'guest-1' },
          data: { reminderSentAt: expect.any(Date) },
        })
      })

      it('should include reply-to from event when sending reminders', async () => {
        const twoDaysFromNow = new Date()
        twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2)

        const mockEvents = [
          {
            id: 'event-1',
            title: 'Event',
            date: twoDaysFromNow,
            location: 'Location',
            reminderSchedule: null,
            replyTo: 'host@example.com',
            guests: [
              {
                id: 'guest-1',
                email: 'guest@example.com',
                name: 'Guest',
                token: 'abc123',
                status: 'PENDING',
                notifyByEmail: true,
                reminderSentAt: null,
              },
            ],
          },
        ]

        vi.mocked(prisma.event.findMany).mockResolvedValue(mockEvents as any)
        vi.mocked(prisma.guest.update).mockResolvedValue({} as any)

        const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test' })
        vi.mocked(nodemailer.createTransport).mockReturnValue({
          sendMail: mockSendMail,
        } as any)

        const { POST } = await import('@/app/api/cron/reminders/route')
        const request = createMockRequest('POST', '/api/cron/reminders')

        await POST(request)

        expect(mockSendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            replyTo: 'host@example.com',
          })
        )
      })

      it('should handle email send failures gracefully', async () => {
        const twoDaysFromNow = new Date()
        twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2)

        const mockEvents = [
          {
            id: 'event-1',
            title: 'Event',
            date: twoDaysFromNow,
            reminderSchedule: null,
            guests: [
              {
                id: 'guest-1',
                email: 'guest@example.com',
                name: 'Guest',
                token: 'abc123',
                status: 'PENDING',
                notifyByEmail: true,
                reminderSentAt: null,
              },
            ],
          },
        ]

        vi.mocked(prisma.event.findMany).mockResolvedValue(mockEvents as any)

        const mockSendMail = vi.fn().mockRejectedValue(new Error('SMTP error'))
        vi.mocked(nodemailer.createTransport).mockReturnValue({
          sendMail: mockSendMail,
        } as any)

        const { POST } = await import('@/app/api/cron/reminders/route')
        const request = createMockRequest('POST', '/api/cron/reminders')

        const response = await POST(request)
        expect(response.status).toBe(200) // Should not fail entirely
        const body = await parseJsonResponse(response)
        expect(body.errors).toBe(1)
        expect(body.emailsSent).toBe(0)
      })

      it('should return 500 when an unexpected error occurs', async () => {
        vi.mocked(prisma.event.findMany).mockRejectedValue(new Error('Database error'))

        const { POST } = await import('@/app/api/cron/reminders/route')
        const request = createMockRequest('POST', '/api/cron/reminders')

        const response = await POST(request)
        expect(response.status).toBe(500)
      })
    })
  })
})
