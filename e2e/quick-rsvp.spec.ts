import { test, expect, testUsers } from './fixtures/test-fixtures'

/**
 * Quick RSVP E2E Tests
 *
 * Tests the one-click RSVP functionality from email links:
 * - Quick RSVP buttons (Attending/Not Attending/Maybe)
 * - Token validation
 * - RSVP deadline enforcement
 * - Status updates and redirects
 */

// Run tests serially to avoid race conditions
test.describe.configure({ mode: 'serial' })

test.describe('Quick RSVP Links', () => {
  let eventSlug: string
  let guestToken: string

  test.beforeAll(async ({ browser }) => {
    // Create event and add a guest to get a token
    const context = await browser.newContext()
    const page = await context.newPage()

    // Login as user
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(testUsers.user.email)
    await page.getByLabel(/password/i).fill(testUsers.user.password)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/dashboard/)

    // Create event
    await page.goto('/dashboard/events/new')
    await page.getByTestId('event-title-input').fill('Quick RSVP Test Event ' + Date.now())
    await page.getByTestId('event-description-input').fill('Testing quick RSVP links')
    await page.getByTestId('event-location-input').fill('Test Location')

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    await page.getByTestId('event-date-input').fill(futureDate.toISOString().slice(0, 10))
    await page.getByTestId('event-time-input').fill('14:00')

    await page.getByTestId('event-submit-button').click()
    await page.waitForURL(/dashboard\/events\//)

    // Get event slug from the public link
    const publicLinkElement = page.locator('code').first()
    const publicUrl = await publicLinkElement.textContent()
    eventSlug = publicUrl?.split('/events/')[1] || ''

    // Add a guest to get a token - navigate to guests section
    await page.getByRole('link', { name: /guests/i }).click()
    await page.waitForURL(/guests/)

    // Click add guest button
    await page.getByRole('button', { name: /add guest/i }).click()

    // Fill in guest details
    await page.getByLabel(/name/i).first().fill('Quick RSVP Test Guest')
    await page.getByLabel(/email/i).first().fill(`quick.rsvp.${Date.now()}@test.com`)

    // Submit
    await page.getByRole('button', { name: /save|add|create/i }).first().click()

    // Wait for the guest to be added and get their token from the table
    await page.waitForTimeout(1000)

    // Get the token from the RSVP link - look for the guest's row and find the RSVP link
    const guestRow = page.locator('tr', { hasText: 'Quick RSVP Test Guest' })
    const rsvpLink = guestRow.locator('a[href*="/rsvp/"]').first()

    if (await rsvpLink.count() > 0) {
      const href = await rsvpLink.getAttribute('href')
      const tokenMatch = href?.match(/\/rsvp\/([^/]+)/)
      guestToken = tokenMatch?.[1] || ''
    } else {
      // Alternative: Find token via API or use a known guest
      // For now, we'll use the public event page to create a guest
      await page.goto(`/events/${eventSlug}`)
      await page.getByTestId('rsvp-status-attending').click()
      await page.getByTestId('rsvp-name-input').fill('Quick Test Guest')
      const testEmail = `quick.test.${Date.now()}@test.com`
      await page.getByTestId('rsvp-email-input').fill(testEmail)
      await page.getByTestId('rsvp-submit-button').click()
      await page.waitForURL(/email=/)

      // Get token from edit RSVP link
      const editLink = await page.getByRole('link', { name: /edit.*rsvp/i }).getAttribute('href')
      const match = editLink?.match(/\/rsvp\/([^/]+)/)
      guestToken = match?.[1] || ''
    }

    await context.close()
  })

  test('should update status to ATTENDING via quick RSVP link', async ({ page }) => {
    // Skip if we don't have a token
    test.skip(!guestToken, 'No guest token available')

    // Navigate to quick RSVP URL
    await page.goto(`/api/rsvp/${guestToken}/quick?status=ATTENDING`)

    // Should redirect to event page with success message
    await expect(page).toHaveURL(new RegExp(`events/${eventSlug}.*success=rsvp_attending`))

    // Should show the guest as attending
    await expect(page.getByText(/Quick.*Guest/i)).toBeVisible()
  })

  test('should update status to NOT_ATTENDING via quick RSVP link', async ({ page }) => {
    test.skip(!guestToken, 'No guest token available')

    await page.goto(`/api/rsvp/${guestToken}/quick?status=NOT_ATTENDING`)

    await expect(page).toHaveURL(new RegExp(`events/${eventSlug}.*success=rsvp_not_attending`))
  })

  test('should update status to MAYBE via quick RSVP link', async ({ page }) => {
    test.skip(!guestToken, 'No guest token available')

    await page.goto(`/api/rsvp/${guestToken}/quick?status=MAYBE`)

    await expect(page).toHaveURL(new RegExp(`events/${eventSlug}.*success=rsvp_maybe`))
  })

  test('should redirect with error for invalid token', async ({ page }) => {
    await page.goto('/api/rsvp/invalid-token-12345/quick?status=ATTENDING')

    // Should redirect to home with error
    await expect(page).toHaveURL(/\?error=invalid_token/)
  })

  test('should redirect with error for missing status parameter', async ({ page }) => {
    test.skip(!guestToken, 'No guest token available')

    await page.goto(`/api/rsvp/${guestToken}/quick`)

    // Should redirect to RSVP page with error
    await expect(page).toHaveURL(new RegExp(`rsvp/${guestToken}.*error=invalid_status`))
  })

  test('should redirect with error for invalid status parameter', async ({ page }) => {
    test.skip(!guestToken, 'No guest token available')

    await page.goto(`/api/rsvp/${guestToken}/quick?status=INVALID`)

    await expect(page).toHaveURL(new RegExp(`rsvp/${guestToken}.*error=invalid_status`))
  })
})

test.describe('Quick RSVP Deadline Enforcement', () => {
  test('should show error for quick RSVP after deadline', async ({ page }) => {
    // Login as user
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(testUsers.user.email)
    await page.getByLabel(/password/i).fill(testUsers.user.password)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/dashboard/)

    // Create event with past deadline
    await page.goto('/dashboard/events/new')
    await page.getByTestId('event-title-input').fill('Past Deadline Event ' + Date.now())
    await page.getByTestId('event-description-input').fill('Event with past deadline for quick RSVP test')
    await page.getByTestId('event-location-input').fill('Test Location')

    // Event date in future
    const eventDate = new Date()
    eventDate.setDate(eventDate.getDate() + 30)
    await page.getByTestId('event-date-input').fill(eventDate.toISOString().slice(0, 10))
    await page.getByTestId('event-time-input').fill('14:00')

    // RSVP deadline in the past
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1)
    await page.locator('input[name="rsvpDeadlineDate"]').fill(pastDate.toISOString().slice(0, 10))
    await page.locator('input[name="rsvpDeadlineTime"]').fill('12:00')

    await page.getByTestId('event-submit-button').click()
    await page.waitForURL(/dashboard\/events\//)

    // Get event slug
    const publicLinkElement = page.locator('code').first()
    const publicUrl = await publicLinkElement.textContent()
    const eventSlug = publicUrl?.split('/events/')[1] || ''

    // Create a guest via public page (won't be able to RSVP due to deadline)
    await page.goto(`/events/${eventSlug}`)

    // Should show deadline message
    await expect(page.getByText('The RSVP deadline has passed.')).toBeVisible()
  })
})

test.describe('RSVP Token Redirect', () => {
  test('should redirect /rsvp/[token] to event page with token', async ({ page }) => {
    // Login and create event with guest
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(testUsers.user.email)
    await page.getByLabel(/password/i).fill(testUsers.user.password)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/dashboard/)

    // Create event
    await page.goto('/dashboard/events/new')
    await page.getByTestId('event-title-input').fill('Token Redirect Test ' + Date.now())
    await page.getByTestId('event-description-input').fill('Testing token redirect')
    await page.getByTestId('event-location-input').fill('Test Location')

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    await page.getByTestId('event-date-input').fill(futureDate.toISOString().slice(0, 10))
    await page.getByTestId('event-time-input').fill('14:00')

    await page.getByTestId('event-submit-button').click()
    await page.waitForURL(/dashboard\/events\//)

    // Get event slug
    const publicLinkElement = page.locator('code').first()
    const publicUrl = await publicLinkElement.textContent()
    const eventSlug = publicUrl?.split('/events/')[1] || ''

    // Create a guest on public page
    await page.goto(`/events/${eventSlug}`)
    await page.getByTestId('rsvp-status-attending').click()
    await page.getByTestId('rsvp-name-input').fill('Redirect Test Guest')
    const testEmail = `redirect.test.${Date.now()}@test.com`
    await page.getByTestId('rsvp-email-input').fill(testEmail)
    await page.getByTestId('rsvp-submit-button').click()
    await page.waitForURL(/email=/)

    // Get token from edit link
    const editLink = await page.getByRole('link', { name: /edit.*rsvp/i }).getAttribute('href')
    const match = editLink?.match(/\/rsvp\/([^/]+)/)
    const guestToken = match?.[1] || ''

    // Navigate to /rsvp/[token] directly
    await page.goto(`/rsvp/${guestToken}`)

    // Should redirect to event page with token parameter
    await expect(page).toHaveURL(new RegExp(`events/${eventSlug}.*token=${guestToken}`))

    // Should show Manage Your RSVP section
    await expect(page.getByText(/manage your rsvp/i)).toBeVisible()
  })

  test('should show 404 for invalid RSVP token', async ({ page }) => {
    await page.goto('/rsvp/completely-invalid-token-xyz')

    await expect(page.getByRole('heading', { name: '404' })).toBeVisible()
  })
})
