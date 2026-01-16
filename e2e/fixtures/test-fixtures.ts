import { test as base, expect, Page } from '@playwright/test'

/**
 * Test user credentials
 */
export const testUsers = {
  admin: {
    email: 'admin@test.com',
    username: 'testadmin',
    password: 'TestAdmin123!',
    name: 'Test Admin',
  },
  user: {
    email: 'user@test.com',
    username: 'testuser',
    password: 'TestUser123!',
    name: 'Test User',
  },
}

/**
 * Test event data
 */
export const testEvent = {
  title: 'E2E Test Event',
  description: 'This is a test event created by Playwright E2E tests',
  location: 'Test Location, 123 Test Street',
  maxGuests: 5,
}

/**
 * Test guest data
 */
export const testGuest = {
  name: 'Test Guest',
  email: 'guest@test.com',
}

/**
 * Extended test fixture with helper methods
 */
export const test = base.extend<{
  loginAsAdmin: () => Promise<void>
  loginAsUser: () => Promise<void>
  logout: () => Promise<void>
  createTestEvent: () => Promise<string>
}>({
  loginAsAdmin: async ({ page }, use) => {
    const login = async () => {
      await page.goto('/login')
      await page.getByLabel(/email/i).fill(testUsers.admin.email)
      await page.getByLabel(/password/i).fill(testUsers.admin.password)
      await page.getByRole('button', { name: /sign in|log in/i }).click()
      await page.waitForURL(/dashboard/)
    }
    await use(login)
  },
  loginAsUser: async ({ page }, use) => {
    const login = async () => {
      await page.goto('/login')
      await page.getByLabel(/email/i).fill(testUsers.user.email)
      await page.getByLabel(/password/i).fill(testUsers.user.password)
      await page.getByRole('button', { name: /sign in|log in/i }).click()
      await page.waitForURL(/dashboard/)
    }
    await use(login)
  },
  logout: async ({ page }, use) => {
    const logout = async () => {
      // Click user menu and logout
      await page.getByRole('button', { name: /user|profile|menu/i }).click()
      await page.getByRole('menuitem', { name: /sign out|log out/i }).click()
      await page.waitForURL(/login|\//)
    }
    await use(logout)
  },
  createTestEvent: async ({ page }, use) => {
    const createEvent = async (): Promise<string> => {
      await page.goto('/dashboard/events/new')
      await page.getByTestId('event-title-input').fill(testEvent.title + ' ' + Date.now())
      await page.getByTestId('event-description-input').fill(testEvent.description)
      await page.getByTestId('event-location-input').fill(testEvent.location)

      // Set date to 30 days from now using separate date and time inputs
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)
      await page.getByTestId('event-date-input').fill(futureDate.toISOString().slice(0, 10))
      await page.getByTestId('event-time-input').fill('14:00')

      await page.getByTestId('event-submit-button').click()
      await page.waitForURL(/dashboard\/events\//)

      // Extract event ID from URL
      const url = page.url()
      const eventId = url.split('/').pop() || ''
      return eventId
    }
    await use(createEvent)
  },
})

export { expect }

/**
 * Helper to wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle')
}

/**
 * Helper to fill a form field by label
 */
export async function fillFormField(page: Page, label: string, value: string) {
  await page.getByLabel(new RegExp(label, 'i')).fill(value)
}

/**
 * Helper to click a button by text
 */
export async function clickButton(page: Page, text: string) {
  await page.getByRole('button', { name: new RegExp(text, 'i') }).click()
}

/**
 * Helper to check if toast message appears
 * Uses .first() to handle cases where the message might appear in multiple elements
 */
export async function expectToast(page: Page, message: string) {
  await expect(page.getByText(new RegExp(message, 'i')).first()).toBeVisible({ timeout: 10000 })
}

/**
 * Helper to navigate to dashboard section
 */
export async function navigateToDashboard(page: Page, section?: string) {
  if (section) {
    await page.goto(`/dashboard/${section}`)
  } else {
    await page.goto('/dashboard')
  }
  await waitForPageLoad(page)
}
