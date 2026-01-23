import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createMockUser } from '../setup'
import {
  createMockRequest,
  createMockRouteContext,
  parseJsonResponse,
} from '../helpers/api-test-utils'

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)),
    compare: vi.fn((password: string, hash: string) =>
      Promise.resolve(hash === `hashed_${password}`)
    ),
  },
  hash: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)),
  compare: vi.fn((password: string, hash: string) =>
    Promise.resolve(hash === `hashed_${password}`)
  ),
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

// Import routes after mocks
import { GET, POST } from '@/app/api/auth/invite/[token]/route'
import bcrypt from 'bcryptjs'

// Helper to create mock invitation
function createMockInvitation(overrides = {}) {
  return {
    id: 'invitation-1',
    token: 'valid-invite-token',
    userId: 'user-1',
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    createdAt: new Date(),
    user: createMockUser({
      id: 'user-1',
      email: 'invited@test.com',
      username: 'invited_12345',
      name: 'Invited User',
      password: null, // Not yet accepted
    }),
    ...overrides,
  }
}

// Helper to set up Prisma mock
function setupPrismaMock(model: string, method: string, returnValue: unknown) {
  const modelMock = (prisma as any)[model]
  if (modelMock && modelMock[method]) {
    modelMock[method].mockReset()
    modelMock[method].mockResolvedValue(returnValue)
  }
}

describe('User Invitation API Routes - /api/auth/invite/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ===========================================
  // GET /api/auth/invite/[token] - Verify invitation token
  // ===========================================
  describe('GET /api/auth/invite/[token] - Verify invitation token', () => {
    describe('Valid token scenarios', () => {
      it('should return valid=true and user info for valid token', async () => {
        const mockInvitation = createMockInvitation()
        setupPrismaMock('userInvitation', 'findUnique', mockInvitation)

        const request = createMockRequest('GET', '/api/auth/invite/valid-invite-token')
        const context = createMockRouteContext({ token: 'valid-invite-token' })

        const response = await GET(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.valid).toBe(true)
        expect(body.email).toBe('invited@test.com')
        expect(body.name).toBe('Invited User')
      })

      it('should return hasTemporaryUsername=true for invited_ username', async () => {
        const mockInvitation = createMockInvitation({
          user: createMockUser({
            id: 'user-1',
            email: 'invited@test.com',
            username: 'invited_abc123',
            password: null,
          }),
        })
        setupPrismaMock('userInvitation', 'findUnique', mockInvitation)

        const request = createMockRequest('GET', '/api/auth/invite/valid-invite-token')
        const context = createMockRouteContext({ token: 'valid-invite-token' })

        const response = await GET(request, context)
        const body = await parseJsonResponse(response)

        expect(body.valid).toBe(true)
        expect(body.hasTemporaryUsername).toBe(true)
        expect(body.username).toBeNull()
      })

      it('should return hasTemporaryUsername=false for custom username', async () => {
        const mockInvitation = createMockInvitation({
          user: createMockUser({
            id: 'user-1',
            email: 'invited@test.com',
            username: 'customuser',
            password: null,
          }),
        })
        setupPrismaMock('userInvitation', 'findUnique', mockInvitation)

        const request = createMockRequest('GET', '/api/auth/invite/valid-invite-token')
        const context = createMockRouteContext({ token: 'valid-invite-token' })

        const response = await GET(request, context)
        const body = await parseJsonResponse(response)

        expect(body.valid).toBe(true)
        expect(body.hasTemporaryUsername).toBe(false)
        expect(body.username).toBe('customuser')
      })

      it('should return role information', async () => {
        const mockInvitation = createMockInvitation({
          user: createMockUser({
            id: 'user-1',
            role: 'USER',
            password: null,
          }),
        })
        setupPrismaMock('userInvitation', 'findUnique', mockInvitation)

        const request = createMockRequest('GET', '/api/auth/invite/valid-invite-token')
        const context = createMockRouteContext({ token: 'valid-invite-token' })

        const response = await GET(request, context)
        const body = await parseJsonResponse(response)

        expect(body.role).toBe('USER')
      })
    })

    describe('Invalid token scenarios', () => {
      it('should return valid=false for non-existent token', async () => {
        setupPrismaMock('userInvitation', 'findUnique', null)

        const request = createMockRequest('GET', '/api/auth/invite/invalid-token')
        const context = createMockRouteContext({ token: 'invalid-token' })

        const response = await GET(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.valid).toBe(false)
        expect(body.error).toBe('Invalid invitation link')
      })

      it('should return valid=false for expired token (>7 days)', async () => {
        const expiredInvitation = createMockInvitation({
          expires: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        })
        setupPrismaMock('userInvitation', 'findUnique', expiredInvitation)

        const request = createMockRequest('GET', '/api/auth/invite/expired-token')
        const context = createMockRouteContext({ token: 'expired-token' })

        const response = await GET(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.valid).toBe(false)
        expect(body.error).toBe('Invitation link has expired')
      })

      it('should return valid=false for already accepted invitation', async () => {
        const acceptedInvitation = createMockInvitation({
          user: createMockUser({
            id: 'user-1',
            email: 'invited@test.com',
            password: 'hashed_password', // Already has password = accepted
          }),
        })
        setupPrismaMock('userInvitation', 'findUnique', acceptedInvitation)

        const request = createMockRequest('GET', '/api/auth/invite/used-token')
        const context = createMockRouteContext({ token: 'used-token' })

        const response = await GET(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.valid).toBe(false)
        expect(body.error).toBe('This invitation has already been accepted')
        expect(body.alreadyAccepted).toBe(true)
      })
    })

    describe('Error handling', () => {
      it('should return 500 for database errors', async () => {
        vi.mocked(prisma.userInvitation.findUnique).mockRejectedValue(
          new Error('Database error')
        )

        const request = createMockRequest('GET', '/api/auth/invite/valid-token')
        const context = createMockRouteContext({ token: 'valid-token' })

        const response = await GET(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(500)
        expect(body.valid).toBe(false)
        expect(body.error).toBe('An error occurred')
      })
    })
  })

  // ===========================================
  // POST /api/auth/invite/[token] - Accept invitation
  // ===========================================
  describe('POST /api/auth/invite/[token] - Accept invitation', () => {
    describe('Validation', () => {
      it('should reject request with missing name', async () => {
        const request = createMockRequest('POST', '/api/auth/invite/valid-token', {
          body: {
            username: 'newuser',
            password: 'SecurePass123!',
          },
        })
        const context = createMockRouteContext({ token: 'valid-token' })

        const response = await POST(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBeDefined()
      })

      it('should reject request with missing username', async () => {
        const request = createMockRequest('POST', '/api/auth/invite/valid-token', {
          body: {
            name: 'New User',
            password: 'SecurePass123!',
          },
        })
        const context = createMockRouteContext({ token: 'valid-token' })

        const response = await POST(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBeDefined()
      })

      it('should reject request with missing password', async () => {
        const request = createMockRequest('POST', '/api/auth/invite/valid-token', {
          body: {
            name: 'New User',
            username: 'newuser',
          },
        })
        const context = createMockRouteContext({ token: 'valid-token' })

        const response = await POST(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBeDefined()
      })

      it('should reject password shorter than 6 characters', async () => {
        const request = createMockRequest('POST', '/api/auth/invite/valid-token', {
          body: {
            name: 'New User',
            username: 'newuser',
            password: '12345',
          },
        })
        const context = createMockRouteContext({ token: 'valid-token' })

        const response = await POST(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBe('Password must be at least 6 characters')
      })

      it('should reject username with invalid characters', async () => {
        const request = createMockRequest('POST', '/api/auth/invite/valid-token', {
          body: {
            name: 'New User',
            username: 'invalid user!',
            password: 'SecurePass123!',
          },
        })
        const context = createMockRouteContext({ token: 'valid-token' })

        const response = await POST(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toContain('only contain letters, numbers, and underscores')
      })
    })

    describe('Token validation', () => {
      it('should reject invalid token', async () => {
        setupPrismaMock('userInvitation', 'findUnique', null)

        const request = createMockRequest('POST', '/api/auth/invite/invalid-token', {
          body: {
            name: 'New User',
            username: 'newuser',
            password: 'SecurePass123!',
          },
        })
        const context = createMockRouteContext({ token: 'invalid-token' })

        const response = await POST(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBe('Invalid or expired invitation link')
      })

      it('should reject expired token and delete it', async () => {
        const expiredInvitation = createMockInvitation({
          expires: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired
        })
        setupPrismaMock('userInvitation', 'findUnique', expiredInvitation)
        setupPrismaMock('userInvitation', 'delete', expiredInvitation)

        const request = createMockRequest('POST', '/api/auth/invite/expired-token', {
          body: {
            name: 'New User',
            username: 'newuser',
            password: 'SecurePass123!',
          },
        })
        const context = createMockRouteContext({ token: 'expired-token' })

        const response = await POST(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toContain('expired')
        expect(prisma.userInvitation.delete).toHaveBeenCalled()
      })

      it('should reject already accepted invitation', async () => {
        const acceptedInvitation = createMockInvitation({
          user: createMockUser({
            id: 'user-1',
            password: 'hashed_password', // Already accepted
          }),
        })
        setupPrismaMock('userInvitation', 'findUnique', acceptedInvitation)

        const request = createMockRequest('POST', '/api/auth/invite/used-token', {
          body: {
            name: 'New User',
            username: 'newuser',
            password: 'SecurePass123!',
          },
        })
        const context = createMockRouteContext({ token: 'used-token' })

        const response = await POST(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBe('This invitation has already been accepted')
      })
    })

    describe('Username uniqueness', () => {
      it('should reject duplicate username', async () => {
        const mockInvitation = createMockInvitation()
        setupPrismaMock('userInvitation', 'findUnique', mockInvitation)

        // Mock another user with the same username
        const existingUser = createMockUser({
          id: 'other-user',
          username: 'taken_username',
        })
        setupPrismaMock('user', 'findUnique', existingUser)

        const request = createMockRequest('POST', '/api/auth/invite/valid-token', {
          body: {
            name: 'New User',
            username: 'taken_username',
            password: 'SecurePass123!',
          },
        })
        const context = createMockRouteContext({ token: 'valid-token' })

        const response = await POST(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toContain('username is already taken')
      })

      it('should allow user to keep their own username', async () => {
        const mockInvitation = createMockInvitation({
          user: createMockUser({
            id: 'user-1',
            username: 'myusername',
            password: null,
          }),
        })
        setupPrismaMock('userInvitation', 'findUnique', mockInvitation)

        // The same user is found when checking username
        setupPrismaMock('user', 'findUnique', mockInvitation.user)

        const updatedUser = {
          ...mockInvitation.user,
          name: 'Updated Name',
          username: 'myusername',
          password: 'hashed_SecurePass123!',
        }
        setupPrismaMock('user', 'update', updatedUser)
        setupPrismaMock('userInvitation', 'delete', mockInvitation)

        const request = createMockRequest('POST', '/api/auth/invite/valid-token', {
          body: {
            name: 'Updated Name',
            username: 'myusername',
            password: 'SecurePass123!',
          },
        })
        const context = createMockRouteContext({ token: 'valid-token' })

        const response = await POST(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.message).toContain('Account setup complete')
      })
    })

    describe('Successful acceptance', () => {
      it('should hash password with bcrypt', async () => {
        const mockInvitation = createMockInvitation()
        setupPrismaMock('userInvitation', 'findUnique', mockInvitation)
        setupPrismaMock('user', 'findUnique', null) // No duplicate username

        const updatedUser = {
          ...mockInvitation.user,
          name: 'New User',
          username: 'newuser',
          password: 'hashed_SecurePass123!',
        }
        setupPrismaMock('user', 'update', updatedUser)
        setupPrismaMock('userInvitation', 'delete', mockInvitation)

        const request = createMockRequest('POST', '/api/auth/invite/valid-token', {
          body: {
            name: 'New User',
            username: 'newuser',
            password: 'SecurePass123!',
          },
        })
        const context = createMockRouteContext({ token: 'valid-token' })

        await POST(request, context)

        expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass123!', 12)
      })

      it('should update user with new credentials', async () => {
        const mockInvitation = createMockInvitation()
        setupPrismaMock('userInvitation', 'findUnique', mockInvitation)
        setupPrismaMock('user', 'findUnique', null)

        const updatedUser = {
          ...mockInvitation.user,
          name: 'New User',
          username: 'newuser',
          password: 'hashed_SecurePass123!',
        }
        setupPrismaMock('user', 'update', updatedUser)
        setupPrismaMock('userInvitation', 'delete', mockInvitation)

        const request = createMockRequest('POST', '/api/auth/invite/valid-token', {
          body: {
            name: 'New User',
            username: 'newuser',
            password: 'SecurePass123!',
          },
        })
        const context = createMockRouteContext({ token: 'valid-token' })

        await POST(request, context)

        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'user-1' },
          data: {
            name: 'New User',
            username: 'newuser',
            password: 'hashed_SecurePass123!',
          },
        })
      })

      it('should delete invitation token after acceptance', async () => {
        const mockInvitation = createMockInvitation()
        setupPrismaMock('userInvitation', 'findUnique', mockInvitation)
        setupPrismaMock('user', 'findUnique', null)

        const updatedUser = {
          ...mockInvitation.user,
          name: 'New User',
          username: 'newuser',
          password: 'hashed_SecurePass123!',
        }
        setupPrismaMock('user', 'update', updatedUser)
        setupPrismaMock('userInvitation', 'delete', mockInvitation)

        const request = createMockRequest('POST', '/api/auth/invite/valid-token', {
          body: {
            name: 'New User',
            username: 'newuser',
            password: 'SecurePass123!',
          },
        })
        const context = createMockRouteContext({ token: 'valid-token' })

        await POST(request, context)

        expect(prisma.userInvitation.delete).toHaveBeenCalledWith({
          where: { id: 'invitation-1' },
        })
      })

      it('should return success message with user info', async () => {
        const mockInvitation = createMockInvitation()
        setupPrismaMock('userInvitation', 'findUnique', mockInvitation)
        setupPrismaMock('user', 'findUnique', null)

        const updatedUser = {
          ...mockInvitation.user,
          name: 'New User',
          username: 'newuser',
          password: 'hashed_SecurePass123!',
        }
        setupPrismaMock('user', 'update', updatedUser)
        setupPrismaMock('userInvitation', 'delete', mockInvitation)

        const request = createMockRequest('POST', '/api/auth/invite/valid-token', {
          body: {
            name: 'New User',
            username: 'newuser',
            password: 'SecurePass123!',
          },
        })
        const context = createMockRouteContext({ token: 'valid-token' })

        const response = await POST(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.message).toBe('Account setup complete! You can now sign in.')
        expect(body.user.email).toBe('invited@test.com')
        expect(body.user.name).toBe('New User')
        expect(body.user.username).toBe('newuser')
      })
    })

    describe('Error handling', () => {
      it('should handle database errors gracefully', async () => {
        vi.mocked(prisma.userInvitation.findUnique).mockRejectedValue(
          new Error('Database error')
        )

        const request = createMockRequest('POST', '/api/auth/invite/valid-token', {
          body: {
            name: 'New User',
            username: 'newuser',
            password: 'SecurePass123!',
          },
        })
        const context = createMockRouteContext({ token: 'valid-token' })

        const response = await POST(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(500)
        expect(body.error).toBe('An error occurred. Please try again.')
      })

      it('should handle user update errors', async () => {
        const mockInvitation = createMockInvitation()
        setupPrismaMock('userInvitation', 'findUnique', mockInvitation)
        setupPrismaMock('user', 'findUnique', null)
        vi.mocked(prisma.user.update).mockRejectedValue(new Error('Update failed'))

        const request = createMockRequest('POST', '/api/auth/invite/valid-token', {
          body: {
            name: 'New User',
            username: 'newuser',
            password: 'SecurePass123!',
          },
        })
        const context = createMockRouteContext({ token: 'valid-token' })

        const response = await POST(request, context)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(500)
        expect(body.error).toBe('An error occurred. Please try again.')
      })
    })
  })
})
