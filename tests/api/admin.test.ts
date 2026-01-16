import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { NextRequest } from 'next/server'
import { createMockUser, createMockEvent } from '../setup'

// Mock config functions
vi.mock('@/lib/config', () => ({
  getEmailConfig: vi.fn(),
  updateEmailConfig: vi.fn(),
  syncToEnvFile: vi.fn(),
  getAppUrl: vi.fn(),
  updateAppUrl: vi.fn(),
}))

// Mock email function
vi.mock('@/lib/email', () => ({
  sendInvitation: vi.fn(),
}))

import { PATCH as updateUser, DELETE as deleteUser } from '@/app/api/admin/users/[userId]/route'
import { GET as getEmailConfig, PATCH as updateEmailConfigRoute, POST as sendTestEmail } from '@/app/api/admin/config/email/route'
import { GET as getAppUrlConfig, PATCH as updateAppUrlConfig } from '@/app/api/admin/config/app/route'
import { POST as factoryReset } from '@/app/api/admin/factory-reset/route'
import { POST as bulkDeleteEvents } from '@/app/api/admin/events/bulk-delete/route'
import { getEmailConfig as getEmailConfigFn, updateEmailConfig as updateEmailConfigFn, syncToEnvFile, getAppUrl, updateAppUrl } from '@/lib/config'
import { sendInvitation } from '@/lib/email'

// Helper to create mock NextRequest
function createMockRequest(
  method: string,
  url: string,
  options: { body?: Record<string, unknown> } = {}
): NextRequest {
  const { body } = options
  const urlObj = new URL(url, 'http://localhost:3000')

  const requestInit: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }

  if (body && method !== 'GET' && method !== 'HEAD') {
    requestInit.body = JSON.stringify(body)
  }

  return new NextRequest(urlObj, requestInit)
}

// Helper to create route context with params
function createMockRouteContext(params: Record<string, string>) {
  return { params: Promise.resolve(params) }
}

// Helper to parse JSON response
async function parseJsonResponse(response: Response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// Helper to mock authenticated session
const mockAuthSession = (user: { id: string; email: string; role: 'USER' | 'ADMIN'; name?: string }) => {
  (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name || 'Test User',
    },
  })
}

// Helper to mock no session
const mockNoAuthSession = () => {
  (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)
}

// ------------------------------------------------------------------
// User Management Tests: PATCH /api/admin/users/[userId]
// ------------------------------------------------------------------
describe('Admin User Management - PATCH /api/admin/users/[userId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockNoAuthSession()

    const request = createMockRequest('PATCH', '/api/admin/users/user-1', {
      body: { name: 'New Name' },
    })
    const context = createMockRouteContext({ userId: 'user-1' })

    const response = await updateUser(request, context)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 403 when user is not an admin', async () => {
    mockAuthSession({ id: 'user-1', email: 'user@example.com', role: 'USER' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'USER' })

    const request = createMockRequest('PATCH', '/api/admin/users/user-2', {
      body: { name: 'New Name' },
    })
    const context = createMockRouteContext({ userId: 'user-2' })

    const response = await updateUser(request, context)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(403)
    expect(data.error).toBe('Only administrators can update users')
  })

  it('successfully updates user name', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })
    ;(prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user-1',
      name: 'Updated Name',
      email: 'user@example.com',
      role: 'USER',
    })

    const request = createMockRequest('PATCH', '/api/admin/users/user-1', {
      body: { name: 'Updated Name' },
    })
    const context = createMockRouteContext({ userId: 'user-1' })

    const response = await updateUser(request, context)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.user.name).toBe('Updated Name')
  })

  it('successfully updates user role from USER to ADMIN', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })
    ;(prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      email: 'user@example.com',
      role: 'ADMIN',
    })

    const request = createMockRequest('PATCH', '/api/admin/users/user-1', {
      body: { role: 'ADMIN' },
    })
    const context = createMockRouteContext({ userId: 'user-1' })

    const response = await updateUser(request, context)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.user.role).toBe('ADMIN')
  })

  it('prevents updating email to an already existing email', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })

    // First call returns admin role, second call finds existing user with that email
    const mockFindUnique = vi.fn()
      .mockResolvedValueOnce({ role: 'ADMIN' })
      .mockResolvedValueOnce({ id: 'other-user', email: 'existing@example.com' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockImplementation(mockFindUnique)

    const request = createMockRequest('PATCH', '/api/admin/users/user-1', {
      body: { email: 'existing@example.com' },
    })
    const context = createMockRouteContext({ userId: 'user-1' })

    const response = await updateUser(request, context)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect(data.error).toBe('An account with this email already exists')
  })

  it('allows updating email if same user already has it', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })

    const mockFindUnique = vi.fn()
      .mockResolvedValueOnce({ role: 'ADMIN' })
      .mockResolvedValueOnce({ id: 'user-1', email: 'same@example.com' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockImplementation(mockFindUnique)

    ;(prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      email: 'same@example.com',
      role: 'USER',
    })

    const request = createMockRequest('PATCH', '/api/admin/users/user-1', {
      body: { email: 'same@example.com' },
    })
    const context = createMockRouteContext({ userId: 'user-1' })

    const response = await updateUser(request, context)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('successfully updates user password (hashed)', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })
    ;(prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      email: 'user@example.com',
      role: 'USER',
    })

    const request = createMockRequest('PATCH', '/api/admin/users/user-1', {
      body: { password: 'newSecurePassword123' },
    })
    const context = createMockRouteContext({ userId: 'user-1' })

    const response = await updateUser(request, context)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    // Verify password was passed to update (it gets hashed by bcrypt mock)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          password: expect.stringContaining('hashed_'),
        }),
      })
    )
  })

  it('returns 400 for invalid role value', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })

    const request = createMockRequest('PATCH', '/api/admin/users/user-1', {
      body: { role: 'SUPERADMIN' },
    })
    const context = createMockRouteContext({ userId: 'user-1' })

    const response = await updateUser(request, context)

    expect(response.status).toBe(400)
  })

  it('returns 400 for password shorter than 6 characters', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })

    const request = createMockRequest('PATCH', '/api/admin/users/user-1', {
      body: { password: '12345' },
    })
    const context = createMockRouteContext({ userId: 'user-1' })

    const response = await updateUser(request, context)

    expect(response.status).toBe(400)
  })

  it('returns 400 for invalid email format', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })

    const request = createMockRequest('PATCH', '/api/admin/users/user-1', {
      body: { email: 'not-an-email' },
    })
    const context = createMockRouteContext({ userId: 'user-1' })

    const response = await updateUser(request, context)

    expect(response.status).toBe(400)
  })
})

// ------------------------------------------------------------------
// User Management Tests: DELETE /api/admin/users/[userId]
// ------------------------------------------------------------------
describe('Admin User Management - DELETE /api/admin/users/[userId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockNoAuthSession()

    const request = createMockRequest('DELETE', '/api/admin/users/user-1')
    const context = createMockRouteContext({ userId: 'user-1' })

    const response = await deleteUser(request, context)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 403 when user is not an admin', async () => {
    mockAuthSession({ id: 'user-1', email: 'user@example.com', role: 'USER' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'USER' })

    const request = createMockRequest('DELETE', '/api/admin/users/user-2')
    const context = createMockRouteContext({ userId: 'user-2' })

    const response = await deleteUser(request, context)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(403)
    expect(data.error).toBe('Only administrators can delete users')
  })

  it('prevents admin from deleting their own account', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })

    const request = createMockRequest('DELETE', '/api/admin/users/admin-1')
    const context = createMockRouteContext({ userId: 'admin-1' })

    const response = await deleteUser(request, context)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect(data.error).toBe('You cannot delete your own account')
  })

  it('returns 404 when user to delete does not exist', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })

    const mockFindUnique = vi.fn()
      .mockResolvedValueOnce({ role: 'ADMIN' })
      .mockResolvedValueOnce(null)
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockImplementation(mockFindUnique)

    const request = createMockRequest('DELETE', '/api/admin/users/nonexistent')
    const context = createMockRouteContext({ userId: 'nonexistent' })

    const response = await deleteUser(request, context)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(404)
    expect(data.error).toBe('User not found')
  })

  it('successfully deletes a user without invitation', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })

    const mockFindUnique = vi.fn()
      .mockResolvedValueOnce({ role: 'ADMIN' })
      .mockResolvedValueOnce({ id: 'user-1', invitation: null })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockImplementation(mockFindUnique)

    ;(prisma.user.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'user-1' })

    const request = createMockRequest('DELETE', '/api/admin/users/user-1')
    const context = createMockRouteContext({ userId: 'user-1' })

    const response = await deleteUser(request, context)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } })
  })

  it('deletes user invitation before deleting user', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })

    const mockFindUnique = vi.fn()
      .mockResolvedValueOnce({ role: 'ADMIN' })
      .mockResolvedValueOnce({ id: 'user-1', invitation: { id: 'invitation-1' } })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockImplementation(mockFindUnique)

    ;(prisma.userInvitation.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'invitation-1' })
    ;(prisma.user.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'user-1' })

    const request = createMockRequest('DELETE', '/api/admin/users/user-1')
    const context = createMockRouteContext({ userId: 'user-1' })

    const response = await deleteUser(request, context)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(prisma.userInvitation.delete).toHaveBeenCalledWith({ where: { id: 'invitation-1' } })
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } })
  })
})

// ------------------------------------------------------------------
// Email Configuration Tests: GET /api/admin/config/email
// ------------------------------------------------------------------
describe('Admin Email Config - GET /api/admin/config/email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockNoAuthSession()

    const request = createMockRequest('GET', '/api/admin/config/email')

    const response = await getEmailConfig(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 403 when user is not an admin', async () => {
    mockAuthSession({ id: 'user-1', email: 'user@example.com', role: 'USER' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'USER' })

    const request = createMockRequest('GET', '/api/admin/config/email')

    const response = await getEmailConfig(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(403)
    expect(data.error).toBe('Admin access required')
  })

  it('returns configured: false when no email config exists', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })
    ;(getEmailConfigFn as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const request = createMockRequest('GET', '/api/admin/config/email')

    const response = await getEmailConfig(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.configured).toBe(false)
    expect(data.config).toBeNull()
  })

  it('returns email config when configured', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })

    const mockConfig = {
      host: 'smtp.example.com',
      port: '587',
      user: 'user@example.com',
      password: 'secretPassword',
      from: 'noreply@example.com',
    }
    ;(getEmailConfigFn as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfig)

    const request = createMockRequest('GET', '/api/admin/config/email')

    const response = await getEmailConfig(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.configured).toBe(true)
    expect(data.config).toEqual(mockConfig)
  })
})

// ------------------------------------------------------------------
// Email Configuration Tests: PATCH /api/admin/config/email
// ------------------------------------------------------------------
describe('Admin Email Config - PATCH /api/admin/config/email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockNoAuthSession()

    const request = createMockRequest('PATCH', '/api/admin/config/email', {
      body: { host: 'smtp.example.com', port: '587', user: 'user', password: 'pass' },
    })

    const response = await updateEmailConfigRoute(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 403 when user is not an admin', async () => {
    mockAuthSession({ id: 'user-1', email: 'user@example.com', role: 'USER' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'USER' })

    const request = createMockRequest('PATCH', '/api/admin/config/email', {
      body: { host: 'smtp.example.com', port: '587', user: 'user', password: 'pass' },
    })

    const response = await updateEmailConfigRoute(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(403)
    expect(data.error).toBe('Admin access required')
  })

  it('returns 400 when required fields are missing', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })

    const request = createMockRequest('PATCH', '/api/admin/config/email', {
      body: { host: 'smtp.example.com' }, // missing port, user, password
    })

    const response = await updateEmailConfigRoute(request)

    expect(response.status).toBe(400)
  })

  it('successfully updates email config and masks password in response', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })
    ;(updateEmailConfigFn as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(syncToEnvFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const request = createMockRequest('PATCH', '/api/admin/config/email', {
      body: {
        host: 'smtp.example.com',
        port: '587',
        user: 'smtpuser@example.com',
        password: 'mySecretPassword123',
      },
    })

    const response = await updateEmailConfigRoute(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toBe('Email configuration updated successfully')
    expect(data.restartRequired).toBe(true)
    // Password should be masked (last 4 chars visible)
    expect(data.config.password).toBe('***************d123')
    expect(updateEmailConfigFn).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: '587',
        user: 'smtpuser@example.com',
        password: 'mySecretPassword123',
      }),
      'admin-1'
    )
  })

  it('masks short passwords with asterisks only', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })
    ;(updateEmailConfigFn as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(syncToEnvFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const request = createMockRequest('PATCH', '/api/admin/config/email', {
      body: {
        host: 'smtp.example.com',
        port: '587',
        user: 'user@example.com',
        password: '1234', // 4 chars or less
      },
    })

    const response = await updateEmailConfigRoute(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.config.password).toBe('****')
  })

  it('continues even if syncToEnvFile fails', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })
    ;(updateEmailConfigFn as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(syncToEnvFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('File write failed'))

    const request = createMockRequest('PATCH', '/api/admin/config/email', {
      body: {
        host: 'smtp.example.com',
        port: '587',
        user: 'user@example.com',
        password: 'password123',
      },
    })

    const response = await updateEmailConfigRoute(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })
})

// ------------------------------------------------------------------
// Email Configuration Tests: POST /api/admin/config/email (test email)
// ------------------------------------------------------------------
describe('Admin Email Config - POST /api/admin/config/email (send test email)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockNoAuthSession()

    const request = createMockRequest('POST', '/api/admin/config/email', {
      body: { testEmail: 'test@example.com' },
    })

    const response = await sendTestEmail(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 403 when user is not an admin', async () => {
    mockAuthSession({ id: 'user-1', email: 'user@example.com', role: 'USER' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'USER' })

    const request = createMockRequest('POST', '/api/admin/config/email', {
      body: { testEmail: 'test@example.com' },
    })

    const response = await sendTestEmail(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(403)
    expect(data.error).toBe('Admin access required')
  })

  it('returns 400 when testEmail is missing', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })

    const request = createMockRequest('POST', '/api/admin/config/email', {
      body: {},
    })

    const response = await sendTestEmail(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect(data.error).toBe('testEmail is required')
  })

  it('returns 400 for invalid email format', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })

    const request = createMockRequest('POST', '/api/admin/config/email', {
      body: { testEmail: 'not-an-email' },
    })

    const response = await sendTestEmail(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid email format')
  })

  it('returns 400 when email is not configured', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })
    ;(getEmailConfigFn as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const request = createMockRequest('POST', '/api/admin/config/email', {
      body: { testEmail: 'test@example.com' },
    })

    const response = await sendTestEmail(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Email not configured')
  })

  it('successfully sends test email', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })
    ;(getEmailConfigFn as ReturnType<typeof vi.fn>).mockResolvedValue({
      host: 'smtp.example.com',
      port: '587',
      user: 'user',
      password: 'pass',
    })
    ;(sendInvitation as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const request = createMockRequest('POST', '/api/admin/config/email', {
      body: { testEmail: 'recipient@example.com' },
    })

    const response = await sendTestEmail(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toContain('recipient@example.com')
    expect(sendInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'recipient@example.com',
        guestName: 'Test User',
      })
    )
  })

  it('returns 500 when email sending fails', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })
    ;(getEmailConfigFn as ReturnType<typeof vi.fn>).mockResolvedValue({
      host: 'smtp.example.com',
      port: '587',
      user: 'user',
      password: 'pass',
    })
    ;(sendInvitation as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('SMTP connection failed'))

    const request = createMockRequest('POST', '/api/admin/config/email', {
      body: { testEmail: 'recipient@example.com' },
    })

    const response = await sendTestEmail(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Failed to send test email')
    expect(data.details).toBe('SMTP connection failed')
  })
})

// ------------------------------------------------------------------
// App URL Configuration Tests: GET /api/admin/config/app
// ------------------------------------------------------------------
describe('Admin App URL Config - GET /api/admin/config/app', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockNoAuthSession()

    const request = createMockRequest('GET', '/api/admin/config/app')

    const response = await getAppUrlConfig(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 403 when user is not an admin', async () => {
    mockAuthSession({ id: 'user-1', email: 'user@example.com', role: 'USER' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'USER' })

    const request = createMockRequest('GET', '/api/admin/config/app')

    const response = await getAppUrlConfig(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(403)
    expect(data.error).toBe('Admin access required')
  })

  it('returns app URL from database when configured', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })
    ;(getAppUrl as ReturnType<typeof vi.fn>).mockResolvedValue('https://myapp.example.com')
    ;(prisma.appConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ category: 'app', key: 'APP_URL', value: 'https://myapp.example.com' })

    const request = createMockRequest('GET', '/api/admin/config/app')

    const response = await getAppUrlConfig(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.appUrl).toBe('https://myapp.example.com')
    expect(data.configured).toBe(true)
    expect(data.source).toBe('database')
  })

  it('returns app URL from environment when not in database', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })
    ;(getAppUrl as ReturnType<typeof vi.fn>).mockResolvedValue('http://localhost:3000')
    ;(prisma.appConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const request = createMockRequest('GET', '/api/admin/config/app')

    const response = await getAppUrlConfig(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.appUrl).toBe('http://localhost:3000')
    expect(data.configured).toBe(false)
    expect(data.source).toBe('environment')
  })
})

// ------------------------------------------------------------------
// App URL Configuration Tests: PATCH /api/admin/config/app
// ------------------------------------------------------------------
describe('Admin App URL Config - PATCH /api/admin/config/app', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockNoAuthSession()

    const request = createMockRequest('PATCH', '/api/admin/config/app', {
      body: { appUrl: 'https://example.com' },
    })

    const response = await updateAppUrlConfig(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 403 when user is not an admin', async () => {
    mockAuthSession({ id: 'user-1', email: 'user@example.com', role: 'USER' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'USER' })

    const request = createMockRequest('PATCH', '/api/admin/config/app', {
      body: { appUrl: 'https://example.com' },
    })

    const response = await updateAppUrlConfig(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(403)
    expect(data.error).toBe('Admin access required')
  })

  it('returns 400 when appUrl is missing', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })

    const request = createMockRequest('PATCH', '/api/admin/config/app', {
      body: {},
    })

    const response = await updateAppUrlConfig(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    // Zod returns 'Required' for missing fields by default
    expect(data.error).toBe('Required')
  })

  it('returns 400 for invalid URL format', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })

    const request = createMockRequest('PATCH', '/api/admin/config/app', {
      body: { appUrl: 'not-a-valid-url' },
    })

    const response = await updateAppUrlConfig(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect(data.error).toContain('valid URL')
  })

  it('successfully updates app URL', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })
    ;(updateAppUrl as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(getAppUrl as ReturnType<typeof vi.fn>).mockResolvedValue('https://rsvp.example.com')

    const request = createMockRequest('PATCH', '/api/admin/config/app', {
      body: { appUrl: 'https://rsvp.example.com' },
    })

    const response = await updateAppUrlConfig(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toBe('App URL updated successfully')
    expect(data.appUrl).toBe('https://rsvp.example.com')
    expect(updateAppUrl).toHaveBeenCalledWith('https://rsvp.example.com', 'admin-1')
  })
})

// ------------------------------------------------------------------
// Factory Reset Tests: POST /api/admin/factory-reset
// ------------------------------------------------------------------
describe('Admin Factory Reset - POST /api/admin/factory-reset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Setup deleteMany mocks for factory reset
    ;(prisma.event.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 5 })
    ;(prisma.userInvitation.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 })
    ;(prisma.passwordResetToken.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 })
    ;(prisma.appConfig.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 10 })
    ;(prisma.account.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 3 })
    ;(prisma.session.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 5 })
    ;(prisma.verificationToken.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 })
    ;(prisma.user.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 3 })
  })

  it('returns 401 when not authenticated', async () => {
    mockNoAuthSession()

    const request = createMockRequest('POST', '/api/admin/factory-reset')

    const response = await factoryReset(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 403 when user is not an admin', async () => {
    mockAuthSession({ id: 'user-1', email: 'user@example.com', role: 'USER' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'USER' })

    const request = createMockRequest('POST', '/api/admin/factory-reset')

    const response = await factoryReset(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(403)
    expect(data.error).toBe('Only administrators can perform factory reset')
  })

  it('successfully performs factory reset and deletes all data', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })

    const request = createMockRequest('POST', '/api/admin/factory-reset')

    const response = await factoryReset(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toContain('Factory reset completed')

    // Verify all deleteMany operations were called
    expect(prisma.event.deleteMany).toHaveBeenCalled()
    expect(prisma.userInvitation.deleteMany).toHaveBeenCalled()
    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalled()
    expect(prisma.appConfig.deleteMany).toHaveBeenCalled()
    expect(prisma.account.deleteMany).toHaveBeenCalled()
    expect(prisma.session.deleteMany).toHaveBeenCalled()
    expect(prisma.verificationToken.deleteMany).toHaveBeenCalled()
    expect(prisma.user.deleteMany).toHaveBeenCalled()
  })

  it('returns 500 when database deletion fails', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })
    ;(prisma.event.deleteMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Database error'))

    const request = createMockRequest('POST', '/api/admin/factory-reset')

    const response = await factoryReset(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to reset to factory defaults')
    expect(data.details).toBe('Database error')
  })
})

// ------------------------------------------------------------------
// Bulk Delete Events Tests: POST /api/admin/events/bulk-delete
// ------------------------------------------------------------------
describe('Admin Bulk Delete Events - POST /api/admin/events/bulk-delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockNoAuthSession()

    const request = createMockRequest('POST', '/api/admin/events/bulk-delete', {
      body: { eventIds: ['event-1', 'event-2'] },
    })

    const response = await bulkDeleteEvents(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 403 when user is not an admin', async () => {
    mockAuthSession({ id: 'user-1', email: 'user@example.com', role: 'USER' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'USER' })

    const request = createMockRequest('POST', '/api/admin/events/bulk-delete', {
      body: { eventIds: ['event-1', 'event-2'] },
    })

    const response = await bulkDeleteEvents(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(403)
    expect(data.error).toBe('Forbidden - Admin access required')
  })

  it('returns 400 when eventIds is missing or empty', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })

    const request = createMockRequest('POST', '/api/admin/events/bulk-delete', {
      body: { eventIds: [] },
    })

    const response = await bulkDeleteEvents(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect(data.error).toBe('At least one event ID is required')
  })

  it('returns 404 when some events are not found', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })

    // Only return one event when two are requested
    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ;(prisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'event-1', title: 'Past Event 1', date: pastDate },
    ])

    const request = createMockRequest('POST', '/api/admin/events/bulk-delete', {
      body: { eventIds: ['event-1', 'event-2'] },
    })

    const response = await bulkDeleteEvents(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(404)
    expect(data.error).toContain('Some events not found')
    expect(data.error).toContain('event-2')
  })

  it('returns 400 when trying to delete future events', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ;(prisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'event-1', title: 'Past Event', date: pastDate },
      { id: 'event-2', title: 'Future Event', date: futureDate },
    ])

    const request = createMockRequest('POST', '/api/admin/events/bulk-delete', {
      body: { eventIds: ['event-1', 'event-2'] },
    })

    const response = await bulkDeleteEvents(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect(data.error).toContain('Cannot delete future events')
    expect(data.error).toContain('Future Event')
    expect(data.futureEventIds).toContain('event-2')
  })

  it('successfully deletes past events', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })

    const pastDate1 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const pastDate2 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ;(prisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'event-1', title: 'Old Event 1', date: pastDate1 },
      { id: 'event-2', title: 'Old Event 2', date: pastDate2 },
    ])
    ;(prisma.event.delete as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const request = createMockRequest('POST', '/api/admin/events/bulk-delete', {
      body: { eventIds: ['event-1', 'event-2'] },
    })

    const response = await bulkDeleteEvents(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.successCount).toBe(2)
    expect(data.failedCount).toBe(0)
    expect(prisma.event.delete).toHaveBeenCalledTimes(2)
    expect(prisma.event.delete).toHaveBeenCalledWith({ where: { id: 'event-1' } })
    expect(prisma.event.delete).toHaveBeenCalledWith({ where: { id: 'event-2' } })
  })

  it('returns 207 multi-status when some deletions fail', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })

    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ;(prisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'event-1', title: 'Event 1', date: pastDate },
      { id: 'event-2', title: 'Event 2', date: pastDate },
    ])

    // First delete succeeds, second fails
    const mockDelete = vi.fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Foreign key constraint'))
    ;(prisma.event.delete as ReturnType<typeof vi.fn>).mockImplementation(mockDelete)

    const request = createMockRequest('POST', '/api/admin/events/bulk-delete', {
      body: { eventIds: ['event-1', 'event-2'] },
    })

    const response = await bulkDeleteEvents(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(207)
    expect(data.successCount).toBe(1)
    expect(data.failedCount).toBe(1)
    expect(data.errors).toHaveLength(1)
    expect(data.errors[0]).toContain('Event 2')
  })

  it('deletes single event successfully', async () => {
    mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })

    const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ;(prisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'event-1', title: 'Very Old Event', date: pastDate },
    ])
    ;(prisma.event.delete as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const request = createMockRequest('POST', '/api/admin/events/bulk-delete', {
      body: { eventIds: ['event-1'] },
    })

    const response = await bulkDeleteEvents(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.successCount).toBe(1)
    expect(data.failedCount).toBe(0)
  })
})

// ------------------------------------------------------------------
// Additional edge case tests
// ------------------------------------------------------------------
describe('Admin API - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('User update validation edge cases', () => {
    it('rejects empty name string', async () => {
      mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
      ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })

      const request = createMockRequest('PATCH', '/api/admin/users/user-1', {
        body: { name: '' },
      })
      const context = createMockRouteContext({ userId: 'user-1' })

      const response = await updateUser(request, context)

      // Schema requires min(1) for name, so empty string should fail
      expect(response.status).toBe(400)
    })

    it('handles database error during user update', async () => {
      mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
      ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })
      ;(prisma.user.update as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Connection timeout'))

      const request = createMockRequest('PATCH', '/api/admin/users/user-1', {
        body: { name: 'New Name' },
      })
      const context = createMockRouteContext({ userId: 'user-1' })

      const response = await updateUser(request, context)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to update user')
    })
  })

  describe('Email config with optional from field', () => {
    it('accepts email config without from field', async () => {
      mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
      ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })
      ;(updateEmailConfigFn as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
      ;(syncToEnvFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

      const request = createMockRequest('PATCH', '/api/admin/config/email', {
        body: {
          host: 'smtp.example.com',
          port: '587',
          user: 'user@example.com',
          password: 'password',
          // No 'from' field
        },
      })

      const response = await updateEmailConfigRoute(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('accepts email config with from field', async () => {
      mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
      ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })
      ;(updateEmailConfigFn as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
      ;(syncToEnvFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

      const request = createMockRequest('PATCH', '/api/admin/config/email', {
        body: {
          host: 'smtp.example.com',
          port: '587',
          user: 'user@example.com',
          password: 'password',
          from: 'noreply@example.com',
        },
      })

      const response = await updateEmailConfigRoute(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.config.from).toBe('noreply@example.com')
    })
  })

  describe('App URL normalization', () => {
    it('normalizes URL with trailing slash', async () => {
      mockAuthSession({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })
      ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: 'ADMIN' })
      ;(updateAppUrl as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
      ;(getAppUrl as ReturnType<typeof vi.fn>).mockResolvedValue('https://example.com')

      const request = createMockRequest('PATCH', '/api/admin/config/app', {
        body: { appUrl: 'https://example.com/' },
      })

      const response = await updateAppUrlConfig(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(200)
      expect(updateAppUrl).toHaveBeenCalledWith('https://example.com/', 'admin-1')
    })
  })
})
