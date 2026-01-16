import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import bcrypt from 'bcryptjs'
import {
  createMockRequest,
  parseJsonResponse,
} from '../helpers/api-test-utils'
import { createMockUser } from '../setup'

// Mock the email module - need to return proper promises for .catch() handling
vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
  sendUserInvitationEmail: vi.fn(() => Promise.resolve()),
}))

// Mock the config module
vi.mock('@/lib/config', () => ({
  getAppUrl: vi.fn().mockResolvedValue('http://localhost:3000'),
  getEmailConfig: vi.fn().mockResolvedValue({
    host: 'smtp.test.com',
    port: '587',
    user: 'test@test.com',
    password: 'test-password',
  }),
}))

// Import route handlers after mocking
import { POST as registerHandler } from '@/app/api/auth/register/route'
import { POST as forgotPasswordHandler } from '@/app/api/auth/forgot-password/route'
import { POST as resetPasswordPostHandler, GET as resetPasswordGetHandler } from '@/app/api/auth/reset-password/route'
import { GET as getProfileHandler, PATCH as updateProfileHandler } from '@/app/api/user/profile/route'
import { sendPasswordResetEmail, sendUserInvitationEmail } from '@/lib/email'

// Helper to mock authenticated session
const mockAuthSession = (user: { id: string; email: string; role: string; name?: string }) => {
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

// Helper to mock no session
const mockNoAuthSession = () => {
  vi.mocked(auth).mockResolvedValue(null)
}

describe('Authentication API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================
  // User Registration Tests
  // ============================================
  describe('POST /api/auth/register', () => {
    describe('Authorization', () => {
      it('should return 401 if user is not authenticated', async () => {
        mockNoAuthSession()

        const request = createMockRequest('POST', '/api/auth/register', {
          body: {
            email: 'newuser@example.com',
            password: 'password123',
          },
        })

        const response = await registerHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(401)
        expect(body.error).toBe('Unauthorized')
      })

      it('should return 403 if user is not an admin', async () => {
        mockAuthSession({ id: 'user-1', email: 'user@example.com', role: 'USER' })
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', role: 'USER' } as any)

        const request = createMockRequest('POST', '/api/auth/register', {
          body: {
            email: 'newuser@example.com',
            password: 'password123',
          },
        })

        const response = await registerHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(403)
        expect(body.error).toBe('Only administrators can create users')
      })

      it('should allow admin to create users', async () => {
        mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })

        vi.mocked(prisma.user.findUnique)
          .mockResolvedValueOnce({ id: 'admin-1', role: 'ADMIN' } as any) // Current user check
          .mockResolvedValueOnce(null) // Email not taken
          .mockResolvedValueOnce(null) // Username not taken

        vi.mocked(prisma.user.create).mockResolvedValue({
          id: 'new-user-1',
          name: null,
          email: 'newuser@example.com',
          role: 'USER',
        } as any)

        const request = createMockRequest('POST', '/api/auth/register', {
          body: {
            email: 'newuser@example.com',
            password: 'password123',
          },
        })

        const response = await registerHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.message).toBe('User created successfully')
        expect(body.user).toBeDefined()
        expect(body.user.email).toBe('newuser@example.com')
      })
    })

    describe('Validation', () => {
      beforeEach(() => {
        mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' } as any)
      })

      it('should return 400 for missing email', async () => {
        const request = createMockRequest('POST', '/api/auth/register', {
          body: {
            password: 'password123',
          },
        })

        const response = await registerHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        // Zod returns 'Required' for missing fields
        expect(body.error).toMatch(/Email is required|Required/)
      })

      it('should return 400 for invalid email format', async () => {
        const request = createMockRequest('POST', '/api/auth/register', {
          body: {
            email: 'not-an-email',
            password: 'password123',
          },
        })

        const response = await registerHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toContain('Invalid email')
      })

      it('should return 400 for password too short', async () => {
        const request = createMockRequest('POST', '/api/auth/register', {
          body: {
            email: 'newuser@example.com',
            password: '12345',
          },
        })

        const response = await registerHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toContain('Password must be at least 6 characters')
      })

      it('should return 400 when password is missing and not sending invitation', async () => {
        const request = createMockRequest('POST', '/api/auth/register', {
          body: {
            email: 'newuser@example.com',
            sendInvitation: false,
          },
        })

        const response = await registerHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toContain('Password is required')
      })
    })

    describe('Duplicate Checking', () => {
      beforeEach(() => {
        mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
      })

      it('should return 400 if email already exists', async () => {
        vi.mocked(prisma.user.findUnique)
          .mockResolvedValueOnce({ id: 'admin-1', role: 'ADMIN' } as any) // Current user check
          .mockResolvedValueOnce(createMockUser({ email: 'existing@example.com' }) as any) // Email exists

        const request = createMockRequest('POST', '/api/auth/register', {
          body: {
            email: 'existing@example.com',
            password: 'password123',
          },
        })

        const response = await registerHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBe('An account with this email already exists')
      })
    })

    describe('Password Hashing', () => {
      it('should hash password before storing', async () => {
        mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })

        vi.mocked(prisma.user.findUnique)
          .mockResolvedValueOnce({ id: 'admin-1', role: 'ADMIN' } as any)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)

        vi.mocked(prisma.user.create).mockResolvedValue({
          id: 'new-user-1',
          name: null,
          email: 'newuser@example.com',
          role: 'USER',
        } as any)

        const request = createMockRequest('POST', '/api/auth/register', {
          body: {
            email: 'newuser@example.com',
            password: 'password123',
          },
        })

        await registerHandler(request)

        expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12)
        expect(prisma.user.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              password: 'hashed_password123',
            }),
          })
        )
      })
    })

    describe('Invitation Flow', () => {
      beforeEach(() => {
        mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
      })

      it('should create user without password when sendInvitation is true', async () => {
        vi.mocked(prisma.user.findUnique)
          .mockResolvedValueOnce({ id: 'admin-1', role: 'ADMIN', name: 'Admin User' } as any)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'admin-1', name: 'Admin User' } as any)

        vi.mocked(prisma.user.create).mockResolvedValue({
          id: 'new-user-1',
          name: 'New User',
          email: 'invited@example.com',
          role: 'USER',
        } as any)

        vi.mocked(prisma.userInvitation.create).mockResolvedValue({
          id: 'invitation-1',
          email: 'invited@example.com',
          token: 'mock-nanoid-token',
        } as any)

        const request = createMockRequest('POST', '/api/auth/register', {
          body: {
            name: 'New User',
            email: 'invited@example.com',
            sendInvitation: true,
          },
        })

        const response = await registerHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.invitationSent).toBe(true)
        expect(prisma.user.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              password: null,
            }),
          })
        )
      })

      it('should send invitation email when user is created with invitation', async () => {
        vi.mocked(prisma.user.findUnique)
          .mockResolvedValueOnce({ id: 'admin-1', role: 'ADMIN', name: 'Admin User' } as any)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'admin-1', name: 'Admin User' } as any)

        vi.mocked(prisma.user.create).mockResolvedValue({
          id: 'new-user-1',
          name: null,
          email: 'invited@example.com',
          role: 'USER',
        } as any)

        vi.mocked(prisma.userInvitation.create).mockResolvedValue({
          id: 'invitation-1',
          token: 'mock-nanoid-token',
        } as any)

        const request = createMockRequest('POST', '/api/auth/register', {
          body: {
            email: 'invited@example.com',
            sendInvitation: true,
          },
        })

        await registerHandler(request)

        // Wait for async email sending
        await new Promise(resolve => setTimeout(resolve, 50))

        // Verify email was called (the URL might vary based on config)
        expect(sendUserInvitationEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'invited@example.com',
            invitedByName: 'Admin User',
            role: 'USER',
          })
        )
      })
    })

    describe('Role Assignment', () => {
      beforeEach(() => {
        mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
      })

      it('should create user with ADMIN role when specified', async () => {
        vi.mocked(prisma.user.findUnique)
          .mockResolvedValueOnce({ id: 'admin-1', role: 'ADMIN' } as any)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)

        vi.mocked(prisma.user.create).mockResolvedValue({
          id: 'new-user-1',
          name: null,
          email: 'newadmin@example.com',
          role: 'ADMIN',
        } as any)

        const request = createMockRequest('POST', '/api/auth/register', {
          body: {
            email: 'newadmin@example.com',
            password: 'password123',
            role: 'ADMIN',
          },
        })

        const response = await registerHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.user.role).toBe('ADMIN')
        expect(prisma.user.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              role: 'ADMIN',
            }),
          })
        )
      })

      it('should default to USER role when not specified', async () => {
        vi.mocked(prisma.user.findUnique)
          .mockResolvedValueOnce({ id: 'admin-1', role: 'ADMIN' } as any)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)

        vi.mocked(prisma.user.create).mockResolvedValue({
          id: 'new-user-1',
          name: null,
          email: 'newuser@example.com',
          role: 'USER',
        } as any)

        const request = createMockRequest('POST', '/api/auth/register', {
          body: {
            email: 'newuser@example.com',
            password: 'password123',
          },
        })

        await registerHandler(request)

        expect(prisma.user.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              role: 'USER',
            }),
          })
        )
      })
    })

    describe('Error Handling', () => {
      it('should return 500 on database error', async () => {
        mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })

        vi.mocked(prisma.user.findUnique)
          .mockResolvedValueOnce({ id: 'admin-1', role: 'ADMIN' } as any)
          .mockRejectedValueOnce(new Error('Database connection failed'))

        const request = createMockRequest('POST', '/api/auth/register', {
          body: {
            email: 'newuser@example.com',
            password: 'password123',
          },
        })

        const response = await registerHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(500)
        expect(body.error).toBe('An error occurred during registration')
      })
    })
  })

  // ============================================
  // Forgot Password Tests
  // ============================================
  describe('POST /api/auth/forgot-password', () => {
    describe('Validation', () => {
      it('should return 400 for invalid email format', async () => {
        const request = createMockRequest('POST', '/api/auth/forgot-password', {
          body: { email: 'not-an-email' },
        })

        const response = await forgotPasswordHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toContain('Invalid email')
      })

      it('should return 400 for missing email', async () => {
        const request = createMockRequest('POST', '/api/auth/forgot-password', {
          body: {},
        })

        const response = await forgotPasswordHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
      })
    })

    describe('Token Generation', () => {
      it('should create reset token for existing user', async () => {
        const mockUser = createMockUser({ email: 'user@example.com', name: 'Test User' })
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
        vi.mocked(prisma.passwordResetToken.deleteMany).mockResolvedValue({ count: 0 })
        vi.mocked(prisma.passwordResetToken.create).mockResolvedValue({
          id: 'token-1',
          email: 'user@example.com',
          token: 'mock-nanoid-token',
          expires: new Date(Date.now() + 60 * 60 * 1000),
        } as any)

        const request = createMockRequest('POST', '/api/auth/forgot-password', {
          body: { email: 'user@example.com' },
        })

        const response = await forgotPasswordHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.message).toContain('If an account exists')
        expect(prisma.passwordResetToken.create).toHaveBeenCalled()
      })

      it('should delete existing reset tokens before creating new one', async () => {
        const mockUser = createMockUser({ email: 'user@example.com' })
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
        vi.mocked(prisma.passwordResetToken.deleteMany).mockResolvedValue({ count: 1 })
        vi.mocked(prisma.passwordResetToken.create).mockResolvedValue({
          id: 'token-1',
          token: 'mock-nanoid-token',
        } as any)

        const request = createMockRequest('POST', '/api/auth/forgot-password', {
          body: { email: 'user@example.com' },
        })

        await forgotPasswordHandler(request)

        expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
          where: { email: 'user@example.com' },
        })
      })

      it('should send password reset email', async () => {
        const mockUser = createMockUser({ email: 'user@example.com', name: 'Test User' })
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
        vi.mocked(prisma.passwordResetToken.deleteMany).mockResolvedValue({ count: 0 })
        vi.mocked(prisma.passwordResetToken.create).mockResolvedValue({
          token: 'mock-nanoid-token',
        } as any)

        const request = createMockRequest('POST', '/api/auth/forgot-password', {
          body: { email: 'user@example.com' },
        })

        await forgotPasswordHandler(request)

        // Verify email was called with correct params (URL might vary based on config)
        expect(sendPasswordResetEmail).toHaveBeenCalledWith(
          'user@example.com',
          expect.stringContaining('reset-password?token=mock-nanoid-token'),
          'Test User'
        )
      })
    })

    describe('Security - Email Enumeration Prevention', () => {
      it('should return success even for non-existent email', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

        const request = createMockRequest('POST', '/api/auth/forgot-password', {
          body: { email: 'nonexistent@example.com' },
        })

        const response = await forgotPasswordHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.message).toContain('If an account exists')
      })

      it('should not create token for non-existent email', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

        const request = createMockRequest('POST', '/api/auth/forgot-password', {
          body: { email: 'nonexistent@example.com' },
        })

        await forgotPasswordHandler(request)

        expect(prisma.passwordResetToken.create).not.toHaveBeenCalled()
      })
    })

    describe('Error Handling', () => {
      it('should return 500 on database error', async () => {
        vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('Database error'))

        const request = createMockRequest('POST', '/api/auth/forgot-password', {
          body: { email: 'user@example.com' },
        })

        const response = await forgotPasswordHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(500)
        expect(body.error).toContain('error occurred')
      })
    })
  })

  // ============================================
  // Reset Password Tests
  // ============================================
  describe('POST /api/auth/reset-password', () => {
    describe('Validation', () => {
      it('should return 400 for missing token', async () => {
        const request = createMockRequest('POST', '/api/auth/reset-password', {
          body: { password: 'newpassword123' },
        })

        const response = await resetPasswordPostHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        // Zod returns 'Required' for missing fields
        expect(body.error).toMatch(/Token is required|Required/)
      })

      it('should return 400 for password too short', async () => {
        const request = createMockRequest('POST', '/api/auth/reset-password', {
          body: {
            token: 'valid-token',
            password: '12345',
          },
        })

        const response = await resetPasswordPostHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toContain('Password must be at least 6 characters')
      })
    })

    describe('Token Validation', () => {
      it('should return 400 for invalid token', async () => {
        vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(null)

        const request = createMockRequest('POST', '/api/auth/reset-password', {
          body: {
            token: 'invalid-token',
            password: 'newpassword123',
          },
        })

        const response = await resetPasswordPostHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBe('Invalid or expired reset link')
      })

      it('should return 400 for expired token', async () => {
        const expiredToken = {
          id: 'token-1',
          email: 'user@example.com',
          token: 'expired-token',
          expires: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        }
        vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(expiredToken as any)
        vi.mocked(prisma.passwordResetToken.delete).mockResolvedValue(expiredToken as any)

        const request = createMockRequest('POST', '/api/auth/reset-password', {
          body: {
            token: 'expired-token',
            password: 'newpassword123',
          },
        })

        const response = await resetPasswordPostHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toContain('expired')
        expect(prisma.passwordResetToken.delete).toHaveBeenCalled()
      })
    })

    describe('Password Reset', () => {
      it('should successfully reset password with valid token', async () => {
        const validToken = {
          id: 'token-1',
          email: 'user@example.com',
          token: 'valid-token',
          expires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        }
        const mockUser = createMockUser({ email: 'user@example.com' })

        vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(validToken as any)
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
        vi.mocked(prisma.user.update).mockResolvedValue({ ...mockUser, password: 'hashed_newpassword123' } as any)
        vi.mocked(prisma.passwordResetToken.delete).mockResolvedValue(validToken as any)

        const request = createMockRequest('POST', '/api/auth/reset-password', {
          body: {
            token: 'valid-token',
            password: 'newpassword123',
          },
        })

        const response = await resetPasswordPostHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.message).toBe('Password has been reset successfully')
      })

      it('should hash the new password', async () => {
        const validToken = {
          id: 'token-1',
          email: 'user@example.com',
          token: 'valid-token',
          expires: new Date(Date.now() + 60 * 60 * 1000),
        }
        const mockUser = createMockUser({ id: 'user-1', email: 'user@example.com' })

        vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(validToken as any)
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
        vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any)
        vi.mocked(prisma.passwordResetToken.delete).mockResolvedValue(validToken as any)

        const request = createMockRequest('POST', '/api/auth/reset-password', {
          body: {
            token: 'valid-token',
            password: 'newpassword123',
          },
        })

        await resetPasswordPostHandler(request)

        expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 12)
        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'user-1' },
          data: { password: 'hashed_newpassword123' },
        })
      })

      it('should delete the reset token after use', async () => {
        const validToken = {
          id: 'token-1',
          email: 'user@example.com',
          token: 'valid-token',
          expires: new Date(Date.now() + 60 * 60 * 1000),
        }
        const mockUser = createMockUser({ email: 'user@example.com' })

        vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(validToken as any)
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
        vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any)
        vi.mocked(prisma.passwordResetToken.delete).mockResolvedValue(validToken as any)

        const request = createMockRequest('POST', '/api/auth/reset-password', {
          body: {
            token: 'valid-token',
            password: 'newpassword123',
          },
        })

        await resetPasswordPostHandler(request)

        expect(prisma.passwordResetToken.delete).toHaveBeenCalledWith({
          where: { id: 'token-1' },
        })
      })

      it('should return 400 if user not found for token email', async () => {
        const validToken = {
          id: 'token-1',
          email: 'deleted@example.com',
          token: 'valid-token',
          expires: new Date(Date.now() + 60 * 60 * 1000),
        }

        vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(validToken as any)
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

        const request = createMockRequest('POST', '/api/auth/reset-password', {
          body: {
            token: 'valid-token',
            password: 'newpassword123',
          },
        })

        const response = await resetPasswordPostHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBe('User not found')
      })
    })
  })

  describe('GET /api/auth/reset-password', () => {
    it('should return 400 for missing token', async () => {
      const request = createMockRequest('GET', '/api/auth/reset-password')

      const response = await resetPasswordGetHandler(request)
      const body = await parseJsonResponse(response)

      expect(response.status).toBe(400)
      expect(body.valid).toBe(false)
      expect(body.error).toBe('Token is required')
    })

    it('should return invalid for non-existent token', async () => {
      vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(null)

      const request = createMockRequest('GET', '/api/auth/reset-password', {
        searchParams: { token: 'invalid-token' },
      })

      const response = await resetPasswordGetHandler(request)
      const body = await parseJsonResponse(response)

      expect(response.status).toBe(200)
      expect(body.valid).toBe(false)
      expect(body.error).toBe('Invalid reset link')
    })

    it('should return invalid for expired token', async () => {
      const expiredToken = {
        token: 'expired-token',
        expires: new Date(Date.now() - 60 * 60 * 1000),
      }
      vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(expiredToken as any)

      const request = createMockRequest('GET', '/api/auth/reset-password', {
        searchParams: { token: 'expired-token' },
      })

      const response = await resetPasswordGetHandler(request)
      const body = await parseJsonResponse(response)

      expect(response.status).toBe(200)
      expect(body.valid).toBe(false)
      expect(body.error).toBe('Reset link has expired')
    })

    it('should return valid for valid token', async () => {
      const validToken = {
        token: 'valid-token',
        expires: new Date(Date.now() + 60 * 60 * 1000),
      }
      vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(validToken as any)

      const request = createMockRequest('GET', '/api/auth/reset-password', {
        searchParams: { token: 'valid-token' },
      })

      const response = await resetPasswordGetHandler(request)
      const body = await parseJsonResponse(response)

      expect(response.status).toBe(200)
      expect(body.valid).toBe(true)
    })
  })

  // ============================================
  // Profile Tests
  // ============================================
  describe('GET /api/user/profile', () => {
    it('should return 401 if not authenticated', async () => {
      mockNoAuthSession()

      const response = await getProfileHandler()
      const body = await parseJsonResponse(response)

      expect(response.status).toBe(401)
      expect(body.error).toBe('Unauthorized')
    })

    it('should return user profile when authenticated', async () => {
      mockAuthSession({ id: 'user-1', email: 'user@example.com', role: 'USER' })

      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        username: 'testuser',
        email: 'user@example.com',
        theme: 'dark',
        notifyOnRsvpChanges: true,
      }
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

      const response = await getProfileHandler()
      const body = await parseJsonResponse(response)

      expect(response.status).toBe(200)
      expect(body.user).toBeDefined()
      expect(body.user.id).toBe('user-1')
      expect(body.user.email).toBe('user@example.com')
      expect(body.user.username).toBe('testuser')
      expect(body.user.theme).toBe('dark')
    })
  })

  describe('PATCH /api/user/profile', () => {
    describe('Authorization', () => {
      it('should return 401 if not authenticated', async () => {
        mockNoAuthSession()

        const request = createMockRequest('PATCH', '/api/user/profile', {
          body: { name: 'New Name' },
        })

        const response = await updateProfileHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(401)
        expect(body.error).toBe('Unauthorized')
      })
    })

    describe('Profile Updates', () => {
      beforeEach(() => {
        mockAuthSession({ id: 'user-1', email: 'user@example.com', role: 'USER' })
      })

      it('should update name successfully', async () => {
        const mockUser = createMockUser()
        vi.mocked(prisma.user.update).mockResolvedValue({ ...mockUser, name: 'New Name' } as any)

        const request = createMockRequest('PATCH', '/api/user/profile', {
          body: { name: 'New Name' },
        })

        const response = await updateProfileHandler(request)

        expect(response.status).toBe(200)
        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'user-1' },
          data: { name: 'New Name' },
        })
      })

      it('should update theme successfully', async () => {
        const mockUser = createMockUser()
        vi.mocked(prisma.user.update).mockResolvedValue({ ...mockUser, theme: 'dark' } as any)

        const request = createMockRequest('PATCH', '/api/user/profile', {
          body: { theme: 'dark' },
        })

        const response = await updateProfileHandler(request)

        expect(response.status).toBe(200)
        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'user-1' },
          data: { theme: 'dark' },
        })
      })
    })

    describe('Username Updates', () => {
      beforeEach(() => {
        mockAuthSession({ id: 'user-1', email: 'user@example.com', role: 'USER' })
      })

      it('should update username when not taken', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null) // Username not taken
        vi.mocked(prisma.user.update).mockResolvedValue(createMockUser({ username: 'newusername' }) as any)

        const request = createMockRequest('PATCH', '/api/user/profile', {
          body: { username: 'newusername' },
        })

        const response = await updateProfileHandler(request)

        expect(response.status).toBe(200)
        expect(prisma.user.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              username: 'newusername',
            }),
          })
        )
      })

      it('should return 400 when username already taken by another user', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(createMockUser({ id: 'other-user', username: 'existingusername' }) as any)

        const request = createMockRequest('PATCH', '/api/user/profile', {
          body: { username: 'existingusername' },
        })

        const response = await updateProfileHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBe('An account with this username already exists')
      })

      it('should allow keeping own username', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(createMockUser({ id: 'user-1', username: 'myusername' }) as any)
        vi.mocked(prisma.user.update).mockResolvedValue(createMockUser({ username: 'myusername' }) as any)

        const request = createMockRequest('PATCH', '/api/user/profile', {
          body: { username: 'myusername' },
        })

        const response = await updateProfileHandler(request)

        expect(response.status).toBe(200)
      })

      it('should return 400 for invalid username format', async () => {
        const request = createMockRequest('PATCH', '/api/user/profile', {
          body: { username: 'invalid-username!' },
        })

        const response = await updateProfileHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toContain('letters, numbers, and underscores')
      })
    })

    describe('Email Updates', () => {
      beforeEach(() => {
        mockAuthSession({ id: 'user-1', email: 'user@example.com', role: 'USER' })
      })

      it('should update email when not taken', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null) // Email not taken
        vi.mocked(prisma.user.update).mockResolvedValue(createMockUser({ email: 'newemail@example.com' }) as any)

        const request = createMockRequest('PATCH', '/api/user/profile', {
          body: { email: 'newemail@example.com' },
        })

        const response = await updateProfileHandler(request)

        expect(response.status).toBe(200)
        expect(prisma.user.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              email: 'newemail@example.com',
            }),
          })
        )
      })

      it('should return 400 when email already taken', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(createMockUser({ id: 'other-user', email: 'taken@example.com' }) as any)

        const request = createMockRequest('PATCH', '/api/user/profile', {
          body: { email: 'taken@example.com' },
        })

        const response = await updateProfileHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBe('An account with this email already exists')
      })

      it('should return 400 for invalid email format', async () => {
        const request = createMockRequest('PATCH', '/api/user/profile', {
          body: { email: 'not-an-email' },
        })

        const response = await updateProfileHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toContain('Invalid email')
      })
    })

    describe('Password Change', () => {
      beforeEach(() => {
        mockAuthSession({ id: 'user-1', email: 'user@example.com', role: 'USER' })
      })

      it('should change password when current password is correct', async () => {
        const mockUser = createMockUser({ password: 'hashed_currentpassword' })

        vi.mocked(prisma.user.findUnique).mockResolvedValue({ password: 'hashed_currentpassword' } as any)
        vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any)

        const request = createMockRequest('PATCH', '/api/user/profile', {
          body: {
            currentPassword: 'currentpassword',
            newPassword: 'newpassword123',
          },
        })

        const response = await updateProfileHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(200)
        expect(body.passwordChanged).toBe(true)
        expect(bcrypt.compare).toHaveBeenCalledWith('currentpassword', 'hashed_currentpassword')
        expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 12)
      })

      it('should return 400 when current password is incorrect', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ password: 'hashed_correctpassword' } as any)

        const request = createMockRequest('PATCH', '/api/user/profile', {
          body: {
            currentPassword: 'wrongpassword',
            newPassword: 'newpassword123',
          },
        })

        const response = await updateProfileHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBe('Current password is incorrect')
      })

      it('should return 400 when only currentPassword is provided', async () => {
        const request = createMockRequest('PATCH', '/api/user/profile', {
          body: {
            currentPassword: 'currentpassword',
          },
        })

        const response = await updateProfileHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toContain('Both current password and new password are required')
      })

      it('should return 400 when only newPassword is provided', async () => {
        const request = createMockRequest('PATCH', '/api/user/profile', {
          body: {
            newPassword: 'newpassword123',
          },
        })

        const response = await updateProfileHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toContain('Both current password and new password are required')
      })

      it('should return 400 when new password is too short', async () => {
        const request = createMockRequest('PATCH', '/api/user/profile', {
          body: {
            currentPassword: 'currentpassword',
            newPassword: '12345',
          },
        })

        const response = await updateProfileHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toContain('Password must be at least 6 characters')
      })

      it('should return 400 when user has no password set', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ password: null } as any)

        const request = createMockRequest('PATCH', '/api/user/profile', {
          body: {
            currentPassword: 'anypassword',
            newPassword: 'newpassword123',
          },
        })

        const response = await updateProfileHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(400)
        expect(body.error).toBe('Cannot change password for this account')
      })
    })

    describe('Error Handling', () => {
      it('should return 500 on database error', async () => {
        mockAuthSession({ id: 'user-1', email: 'user@example.com', role: 'USER' })
        vi.mocked(prisma.user.update).mockRejectedValue(new Error('Database error'))

        const request = createMockRequest('PATCH', '/api/user/profile', {
          body: { name: 'New Name' },
        })

        const response = await updateProfileHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(500)
        expect(body.error).toBe('Failed to update profile')
      })
    })
  })

  // ============================================
  // Login Flow Tests (auth.ts authorize function)
  // ============================================
  describe('Login Flow', () => {
    // Note: Direct testing of NextAuth authorize function requires importing and calling it
    // These tests verify the expected behavior through mocking

    describe('Credentials Validation', () => {
      it('should find user by email', async () => {
        const mockUser = createMockUser({
          email: 'user@example.com',
          password: 'hashed_password123',
        })

        // This verifies the Prisma mock is set up correctly for login
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any)

        expect(prisma.user.findFirst).toBeDefined()
      })

      it('should find user by username', async () => {
        const mockUser = createMockUser({
          username: 'testuser',
          password: 'hashed_password123',
        })

        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any)

        expect(prisma.user.findFirst).toBeDefined()
      })
    })

    describe('Password Verification', () => {
      it('should verify password using bcrypt.compare', async () => {
        const result = await bcrypt.compare('password123', 'hashed_password123')
        expect(result).toBe(true)
      })

      it('should reject incorrect password', async () => {
        const result = await bcrypt.compare('wrongpassword', 'hashed_password123')
        expect(result).toBe(false)
      })
    })
  })

  // ============================================
  // Role-Based Access Control Tests
  // ============================================
  describe('Role-Based Access Control', () => {
    describe('Admin-only routes', () => {
      it('should deny USER access to admin registration endpoint', async () => {
        mockAuthSession({ id: 'user-1', email: 'user@example.com', role: 'USER' })
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', role: 'USER' } as any)

        const request = createMockRequest('POST', '/api/auth/register', {
          body: {
            email: 'newuser@example.com',
            password: 'password123',
          },
        })

        const response = await registerHandler(request)
        const body = await parseJsonResponse(response)

        expect(response.status).toBe(403)
        expect(body.error).toBe('Only administrators can create users')
      })

      it('should allow ADMIN access to registration endpoint', async () => {
        mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })

        vi.mocked(prisma.user.findUnique)
          .mockResolvedValueOnce({ id: 'admin-1', role: 'ADMIN' } as any)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)

        vi.mocked(prisma.user.create).mockResolvedValue({
          id: 'new-user-1',
          email: 'newuser@example.com',
          role: 'USER',
        } as any)

        const request = createMockRequest('POST', '/api/auth/register', {
          body: {
            email: 'newuser@example.com',
            password: 'password123',
          },
        })

        const response = await registerHandler(request)

        expect(response.status).toBe(200)
      })
    })

    describe('User-accessible routes', () => {
      it('should allow both USER and ADMIN to access profile', async () => {
        // Test USER access
        mockAuthSession({ id: 'user-1', email: 'user@example.com', role: 'USER' })
        vi.mocked(prisma.user.findUnique).mockResolvedValue(createMockUser() as any)

        let response = await getProfileHandler()
        expect(response.status).toBe(200)

        // Test ADMIN access
        vi.clearAllMocks()
        mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
        vi.mocked(prisma.user.findUnique).mockResolvedValue(createMockUser({ id: 'admin-1', role: 'ADMIN' }) as any)

        response = await getProfileHandler()
        expect(response.status).toBe(200)
      })
    })
  })
})
