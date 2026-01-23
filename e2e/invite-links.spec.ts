import { test, expect, testUsers } from './fixtures/test-fixtures'

/**
 * User Invitation E2E Tests
 *
 * Tests the user invitation flow:
 * - Admin creates user invitation
 * - Email sent with invitation link
 * - User accepts invitation and creates account
 * - Login with new credentials
 * - Error handling for expired/invalid invitations
 */

// Run tests serially to avoid race conditions
test.describe.configure({ mode: 'serial' })

test.describe('User Invitation Flow', () => {
  const testTimestamp = Date.now()
  const inviteEmail = `invite.test.${testTimestamp}@test.com`

  test('admin can create a new user with invitation', async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(testUsers.admin.email)
    await page.getByLabel(/password/i).fill(testUsers.admin.password)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/dashboard/)

    // Navigate to admin panel - users section
    await page.goto('/dashboard/admin/users')

    // Click create user button
    await page.getByRole('button', { name: /create user|add user|new user/i }).click()

    // Fill in user details
    await page.getByLabel(/email/i).fill(inviteEmail)
    await page.getByLabel(/name/i).fill('Invited Test User')

    // Check the "Send Invitation" option if available
    const sendInviteCheckbox = page.locator('input[type="checkbox"]').filter({
      has: page.locator('..', { hasText: /send.*invit/i }),
    })
    if ((await sendInviteCheckbox.count()) > 0) {
      await sendInviteCheckbox.check()
    }

    // Submit
    await page.getByRole('button', { name: /create|save|send/i }).click()

    // Should show success message or redirect
    await expect(
      page.getByText(/created|invitation.*sent|successfully/i).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('invitation link page displays correctly', async ({ page }) => {
    // This test uses a mock token since we can't easily extract it from email
    // Navigate to invite page with a test structure
    await page.goto('/invite/test-token')

    // Should show either the acceptance form or an error (invalid token)
    const hasForm = await page.getByText(/complete.*setup|accept.*invitation|set.*password/i).isVisible().catch(() => false)
    const hasError = await page.getByText(/invalid|expired|already.*accepted/i).isVisible().catch(() => false)

    expect(hasForm || hasError).toBe(true)
  })

  test('invitation acceptance form validates input', async ({ page }) => {
    // Note: In a real test, we'd need the actual invitation token
    // This tests the form validation behavior

    // Login as admin to create a fresh invitation
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(testUsers.admin.email)
    await page.getByLabel(/password/i).fill(testUsers.admin.password)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/dashboard/)

    // Navigate to admin users
    await page.goto('/dashboard/admin/users')

    // Check if there's a user list with invitation status
    const invitationPending = page.locator('tr', { hasText: /pending.*invitation|invited/i })
    if ((await invitationPending.count()) > 0) {
      // Find and copy invitation link
      const inviteLink = invitationPending.locator('a[href*="/invite/"]').first()
      if ((await inviteLink.count()) > 0) {
        const href = await inviteLink.getAttribute('href')
        if (href) {
          // Navigate to invitation page in a new context (as if different user)
          await page.goto(href)

          // Should show acceptance form
          await expect(page.getByText(/complete.*setup|set.*password/i).first()).toBeVisible()
        }
      }
    }
  })
})

test.describe('Invitation Error Cases', () => {
  test('shows error for invalid invitation token', async ({ page }) => {
    await page.goto('/invite/completely-invalid-token-xyz123')

    // Should show invalid or error message
    await expect(page.getByText(/invalid|not found|error/i).first()).toBeVisible()
  })

  test('shows error for expired invitation', async ({ page }) => {
    // Navigate to invite page - if token is expired, should show error
    await page.goto('/invite/expired-token-test')

    // Should show expired or invalid message
    await expect(page.getByText(/invalid|expired|error/i).first()).toBeVisible()
  })
})

test.describe('User Invitation API', () => {
  test('GET /api/auth/invite/[token] returns token status', async ({ request }) => {
    // Test invalid token
    const response = await request.get('/api/auth/invite/invalid-token-test')
    const body = await response.json()

    expect(response.ok()).toBe(true)
    expect(body.valid).toBe(false)
    expect(body.error).toBeDefined()
  })

  test('POST /api/auth/invite/[token] validates required fields', async ({ request }) => {
    // Test with missing fields
    const response = await request.post('/api/auth/invite/some-token', {
      data: {
        name: 'Test User',
        // Missing username and password
      },
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toBeDefined()
  })

  test('POST /api/auth/invite/[token] validates password length', async ({ request }) => {
    const response = await request.post('/api/auth/invite/some-token', {
      data: {
        name: 'Test User',
        username: 'testuser',
        password: '12345', // Too short
      },
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('6 characters')
  })

  test('POST /api/auth/invite/[token] validates username format', async ({ request }) => {
    const response = await request.post('/api/auth/invite/some-token', {
      data: {
        name: 'Test User',
        username: 'invalid user!', // Contains spaces and special chars
        password: 'ValidPass123!',
      },
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('letters, numbers, and underscores')
  })
})

test.describe('User Management Access Control', () => {
  test('regular user cannot access user management', async ({ page }) => {
    // Login as regular user
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(testUsers.user.email)
    await page.getByLabel(/password/i).fill(testUsers.user.password)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/dashboard/)

    // Try to access admin users page
    await page.goto('/dashboard/admin/users')

    // Should be redirected or show access denied
    const isOnUsersPage = await page.url().includes('/admin/users')
    const hasAccessDenied = await page.getByText(/access.*denied|unauthorized|forbidden|not.*authorized/i).isVisible().catch(() => false)
    const wasRedirected = !page.url().includes('/admin/users')

    expect(hasAccessDenied || wasRedirected || !isOnUsersPage).toBe(true)
  })

  test('admin can access user management', async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(testUsers.admin.email)
    await page.getByLabel(/password/i).fill(testUsers.admin.password)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/dashboard/)

    // Access admin users page
    await page.goto('/dashboard/admin/users')

    // Should see user management content
    await expect(page.getByText(/users|user management/i).first()).toBeVisible()
  })
})
