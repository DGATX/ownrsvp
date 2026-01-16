import { vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Create a mock NextRequest for API route testing
 */
export function createMockRequest(
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
export function createMockRouteContext(params: Record<string, string>) {
  return { params: Promise.resolve(params) }
}

/**
 * Parse JSON response from API route
 */
export async function parseJsonResponse(response: Response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * Assert API response status and optionally body
 */
export async function assertApiResponse(
  response: Response,
  expectedStatus: number,
  expectedBody?: Record<string, unknown>
) {
  expect(response.status).toBe(expectedStatus)

  if (expectedBody) {
    const body = await parseJsonResponse(response)
    expect(body).toMatchObject(expectedBody)
  }
}

/**
 * Mock authenticated session for API tests
 */
export function mockAuthSession(user: {
  id: string
  email: string
  role: 'USER' | 'ADMIN'
  name?: string
}) {
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

/**
 * Mock unauthenticated session
 */
export function mockNoAuthSession() {
  const { auth } = require('@/auth')
  auth.mockResolvedValue(null)
}

/**
 * Setup Prisma mock for a specific model and method
 */
export function setupPrismaMock(
  model: string,
  method: string,
  returnValue: unknown
) {
  const { prisma } = require('@/lib/prisma')
  const modelMock = prisma[model]
  if (modelMock && modelMock[method]) {
    modelMock[method].mockResolvedValue(returnValue)
  }
}

/**
 * Setup Prisma mock to throw an error
 */
export function setupPrismaError(
  model: string,
  method: string,
  error: Error
) {
  const { prisma } = require('@/lib/prisma')
  const modelMock = prisma[model]
  if (modelMock && modelMock[method]) {
    modelMock[method].mockRejectedValue(error)
  }
}

/**
 * Create a Prisma-style error
 */
export function createPrismaError(code: string, message: string) {
  const error = new Error(message) as Error & { code: string }
  error.code = code
  return error
}

/**
 * Test data generators
 */
export const testData = {
  validEmail: 'test@example.com',
  invalidEmail: 'not-an-email',
  validPassword: 'SecurePassword123!',
  shortPassword: '12345',

  validEvent: {
    title: 'Test Event',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    location: 'Test Location',
    description: 'Test Description',
    isPublic: false,
    maxGuestsPerInvitee: 2,
  },

  validGuest: {
    name: 'Test Guest',
    email: 'guest@example.com',
  },

  validRsvp: {
    status: 'ATTENDING',
    dietaryNotes: 'No allergies',
    additionalGuests: [],
  },
}
