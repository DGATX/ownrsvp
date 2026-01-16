import { vi, beforeEach, afterEach } from 'vitest'

// Mock Prisma Client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    guest: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    additionalGuest: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    eventCoHost: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    comment: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    eventUpdate: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    appConfig: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    passwordResetToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    userInvitation: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    account: {
      deleteMany: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
    },
    verificationToken: {
      deleteMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    event: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback({
      user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      event: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      guest: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
      additionalGuest: { deleteMany: vi.fn(), createMany: vi.fn() },
      eventCoHost: { deleteMany: vi.fn() },
      comment: { deleteMany: vi.fn() },
      eventUpdate: { deleteMany: vi.fn() },
    })),
  },
}))

// Mock NextAuth
vi.mock('@/auth', () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
      verify: vi.fn().mockResolvedValue(true),
    })),
  },
  createTransport: vi.fn(() => ({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    verify: vi.fn().mockResolvedValue(true),
  })),
}))

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'mock-nanoid-token'),
}))

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)),
    compare: vi.fn((password: string, hash: string) => Promise.resolve(hash === `hashed_${password}`)),
  },
  hash: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)),
  compare: vi.fn((password: string, hash: string) => Promise.resolve(hash === `hashed_${password}`)),
}))

// Mock environment variables
process.env.AUTH_SECRET = 'test-auth-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.SMTP_HOST = 'smtp.test.com'
process.env.SMTP_PORT = '587'
process.env.SMTP_USER = 'test@test.com'
process.env.SMTP_PASS = 'test-password'
process.env.SMTP_FROM = 'noreply@test.com'

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})

// Clean up after each test
afterEach(() => {
  vi.resetAllMocks()
})

// Global test utilities
export const mockSession = (user: { id: string; email: string; role: string; name?: string }) => {
  const { auth } = require('@/auth')
  auth.mockResolvedValue({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name || 'Test User',
    },
  })
}

export const mockNoSession = () => {
  const { auth } = require('@/auth')
  auth.mockResolvedValue(null)
}

export const createMockUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'test@example.com',
  username: 'testuser',
  name: 'Test User',
  password: 'hashed_password123',
  role: 'USER',
  theme: 'system',
  notifyOnRsvp: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
})

export const createMockEvent = (overrides = {}) => ({
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
})

export const createMockGuest = (overrides = {}) => ({
  id: 'guest-1',
  name: 'Test Guest',
  email: 'guest@example.com',
  phone: null,
  status: 'PENDING',
  dietaryNotes: null,
  token: 'guest-token-123',
  emailNotifications: true,
  smsNotifications: false,
  maxGuests: null,
  invitationSentAt: null,
  reminderSentAt: null,
  respondedAt: null,
  eventId: 'event-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
})

export const createMockAdditionalGuest = (overrides = {}) => ({
  id: 'additional-guest-1',
  name: 'Additional Guest',
  guestId: 'guest-1',
  createdAt: new Date('2024-01-01'),
  ...overrides,
})

export const createMockCoHost = (overrides = {}) => ({
  id: 'cohost-1',
  eventId: 'event-1',
  userId: 'user-2',
  role: 'COHOST',
  createdAt: new Date('2024-01-01'),
  ...overrides,
})
