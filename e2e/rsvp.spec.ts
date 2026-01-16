import { test, expect, testUsers, testEvent, testGuest } from './fixtures/test-fixtures'

/**
 * Public RSVP Flow E2E Tests
 *
 * These tests cover the complete public RSVP experience:
 * - Accessing RSVP pages via token
 * - Submitting RSVPs (attending, not attending, maybe)
 * - Managing additional guests (plus-ones)
 * - Guest limit enforcement
 * - Dietary notes
 * - Updating existing RSVPs
 * - RSVP deadline enforcement
 * - Invalid token handling
 * - Public event page RSVP
 * - Event comments/guest wall
 */

// Run tests serially to avoid race conditions and server crashes
test.describe.configure({ mode: 'serial' })

test.describe('Public RSVP Flow', () => {
  // Store created event data for tests
  let eventSlug: string
  let eventId: string

  test.beforeAll(async ({ browser }) => {
    // Create a single event that will be used by all tests in this describe block
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
    await page.getByTestId('event-title-input').fill('RSVP Test Event ' + Date.now())
    await page.getByTestId('event-description-input').fill('This is a test event for RSVP testing')
    await page.getByTestId('event-location-input').fill('123 Test Street, Test City')

    // Set date to 30 days from now
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    await page.getByTestId('event-date-input').fill(futureDate.toISOString().slice(0, 10))
    await page.getByTestId('event-time-input').fill('14:00')

    await page.getByTestId('event-submit-button').click()
    await page.waitForURL(/dashboard\/events\//)

    // Get event ID from URL
    eventId = page.url().split('/').pop() || ''

    // Get event slug from the public link
    const publicLinkElement = page.locator('code').first()
    const publicUrl = await publicLinkElement.textContent()
    eventSlug = publicUrl?.split('/events/')[1] || ''

    await context.close()
  })

  test('should display event details correctly on public page', async ({ page }) => {
    // Navigate to public event page
    await page.goto(`/events/${eventSlug}`)

    // Verify event information is displayed
    await expect(page.getByText(/you're invited to/i)).toBeVisible()
    await expect(page.getByText('123 Test Street, Test City')).toBeVisible()
    await expect(page.getByText(/rsvp/i).first()).toBeVisible()
    await expect(page.getByText(/guest wall/i)).toBeVisible()
  })

  test('should submit RSVP with attending status', async ({ page }) => {
    // Navigate to public event page
    await page.goto(`/events/${eventSlug}`)

    // Fill out RSVP form
    await page.getByTestId('rsvp-status-attending').click()
    await page.getByTestId('rsvp-name-input').fill('John Attending')
    await page.getByTestId('rsvp-email-input').fill(`john.attending.${Date.now()}@test.com`)

    // Submit RSVP
    await page.getByTestId('rsvp-submit-button').click()

    // Verify success - should redirect with email param
    await page.waitForURL(/email=/)

    // Check that the guest appears in "Who's Coming" section
    await expect(page.getByText('John Attending')).toBeVisible()
  })

  test('should submit RSVP with not attending status', async ({ page }) => {
    // Navigate to public event page
    await page.goto(`/events/${eventSlug}`)

    // Fill out RSVP form
    await page.getByTestId('rsvp-status-not-attending').click()
    await page.getByTestId('rsvp-name-input').fill('Jane NotAttending')
    await page.getByTestId('rsvp-email-input').fill(`jane.notattending.${Date.now()}@test.com`)

    // Submit RSVP
    await page.getByTestId('rsvp-submit-button').click()

    // Verify success
    await page.waitForURL(/email=/)
  })

  test('should submit RSVP with maybe status', async ({ page }) => {
    // Navigate to public event page
    await page.goto(`/events/${eventSlug}`)

    // Fill out RSVP form
    await page.getByTestId('rsvp-status-maybe').click()
    await page.getByTestId('rsvp-name-input').fill('Maybe Guest')
    await page.getByTestId('rsvp-email-input').fill(`maybe.guest.${Date.now()}@test.com`)

    // Submit RSVP
    await page.getByTestId('rsvp-submit-button').click()

    // Verify success
    await page.waitForURL(/email=/)
  })

  test('should add additional guests when attending', async ({ page }) => {
    // Navigate to public event page
    await page.goto(`/events/${eventSlug}`)

    // Select attending
    await page.getByTestId('rsvp-status-attending').click()
    await page.getByTestId('rsvp-name-input').fill('Host Guest')
    await page.getByTestId('rsvp-email-input').fill(`host.guest.${Date.now()}@test.com`)

    // Add additional guests
    await page.getByTestId('rsvp-add-guest-button').click()
    await page.getByPlaceholder(/guest 1 name/i).fill('Plus One')

    await page.getByTestId('rsvp-add-guest-button').click()
    await page.getByPlaceholder(/guest 2 name/i).fill('Plus Two')

    // Submit RSVP
    await page.getByTestId('rsvp-submit-button').click()

    // Verify success
    await page.waitForURL(/email=/)

    // Verify all guests appear in Who's Coming
    await expect(page.getByText('Host Guest')).toBeVisible()
    await expect(page.getByText('Plus One')).toBeVisible()
    await expect(page.getByText('Plus Two')).toBeVisible()
  })

  test('should remove additional guest from form', async ({ page }) => {
    // Navigate to public event page
    await page.goto(`/events/${eventSlug}`)

    // Select attending
    await page.getByTestId('rsvp-status-attending').click()

    // Add additional guest
    await page.getByTestId('rsvp-add-guest-button').click()
    await page.getByPlaceholder(/guest 1 name/i).fill('Will Be Removed')

    // Verify the guest input exists
    await expect(page.getByPlaceholder(/guest 1 name/i)).toBeVisible()

    // Remove the guest using the delete button
    await page.getByTestId('rsvp-remove-guest-0').click()

    // Verify guest field is removed
    await expect(page.getByPlaceholder(/guest 1 name/i)).not.toBeVisible()
  })

  test('should add dietary restrictions notes', async ({ page }) => {
    // Navigate to public event page
    await page.goto(`/events/${eventSlug}`)

    // Select attending
    await page.getByTestId('rsvp-status-attending').click()
    await page.getByTestId('rsvp-name-input').fill('Dietary Guest')
    await page.getByTestId('rsvp-email-input').fill(`dietary.guest.${Date.now()}@test.com`)

    // Add dietary notes
    await page.getByTestId('rsvp-dietary-input').fill('Vegetarian, no nuts please')

    // Submit RSVP
    await page.getByTestId('rsvp-submit-button').click()

    // Verify success
    await page.waitForURL(/email=/)
  })

  test('should add phone number for SMS updates', async ({ page }) => {
    // Navigate to public event page
    await page.goto(`/events/${eventSlug}`)

    // Fill out RSVP form including phone
    await page.getByTestId('rsvp-status-attending').click()
    await page.getByTestId('rsvp-name-input').fill('Phone Guest')
    await page.getByTestId('rsvp-email-input').fill(`phone.guest.${Date.now()}@test.com`)
    await page.getByTestId('rsvp-phone-input').fill('+1 555 123 4567')

    // Submit RSVP
    await page.getByTestId('rsvp-submit-button').click()

    // Verify success
    await page.waitForURL(/email=/)
  })

  test('should update existing RSVP response', async ({ page }) => {
    const uniqueEmail = `update.test.${Date.now()}@test.com`

    // Navigate to public event page
    await page.goto(`/events/${eventSlug}`)

    // Submit initial RSVP as attending
    await page.getByTestId('rsvp-status-attending').click()
    await page.getByTestId('rsvp-name-input').fill('Update Test Guest')
    await page.getByTestId('rsvp-email-input').fill(uniqueEmail)
    await page.getByTestId('rsvp-submit-button').click()
    await page.waitForURL(/email=/)

    // Should see "Manage Your RSVP" section
    await expect(page.getByText(/manage your rsvp/i)).toBeVisible()

    // Click edit RSVP
    await page.getByRole('link', { name: /edit.*rsvp/i }).click()
    await page.waitForURL(/rsvp\/.*\/edit/)

    // Change to Not Attending
    await page.locator('button', { hasText: /can't go/i }).click()

    // Submit update
    await page.getByRole('button', { name: /update rsvp/i }).click()

    // Verify redirect indicating success
    await page.waitForURL(/events\//)
  })

  test('should add comment on public event page', async ({ page }) => {
    // Navigate to public event page
    await page.goto(`/events/${eventSlug}`)

    // Fill out comment form using specific testids
    await page.getByTestId('comment-name-input').fill('Comment Author')
    await page.getByTestId('comment-content-input').fill('This is a test comment for the event!')

    // Submit comment
    await page.getByTestId('comment-submit-button').click()

    // Wait for comment to appear
    await expect(page.getByText('Comment Author')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('This is a test comment for the event!')).toBeVisible()
  })

  test('should display existing comments after reload', async ({ page }) => {
    const commentName = `Persistent Commenter ${Date.now()}`
    const commentText = `This comment should persist ${Date.now()}`

    // Navigate to public event page and add a comment first
    await page.goto(`/events/${eventSlug}`)
    await page.getByTestId('comment-name-input').fill(commentName)
    await page.getByTestId('comment-content-input').fill(commentText)
    await page.getByTestId('comment-submit-button').click()
    await expect(page.getByText(commentText)).toBeVisible({ timeout: 10000 })

    // Reload page and verify comment persists
    await page.reload()
    await expect(page.getByText(commentName)).toBeVisible()
    await expect(page.getByText(commentText)).toBeVisible()
  })

  test('should require status selection before submit', async ({ page }) => {
    // Navigate to public event page
    await page.goto(`/events/${eventSlug}`)

    // Fill name and email but don't select status
    await page.getByTestId('rsvp-name-input').fill('No Status Guest')
    await page.getByTestId('rsvp-email-input').fill('no.status@test.com')

    // Submit button should be disabled without status selection
    await expect(page.getByTestId('rsvp-submit-button')).toBeDisabled()
  })

  test('should show validation for required name field', async ({ page }) => {
    // Navigate to public event page
    await page.goto(`/events/${eventSlug}`)

    // Select status and email but not name
    await page.getByTestId('rsvp-status-attending').click()
    await page.getByTestId('rsvp-email-input').fill('no.name@test.com')

    // Check that the name input has required attribute
    const nameInput = page.getByTestId('rsvp-name-input')
    await expect(nameInput).toHaveAttribute('required', '')
  })

  test('should validate email format', async ({ page }) => {
    // Navigate to public event page
    await page.goto(`/events/${eventSlug}`)

    // Select status and name but use invalid email
    await page.getByTestId('rsvp-status-attending').click()
    await page.getByTestId('rsvp-name-input').fill('Invalid Email Guest')
    await page.getByTestId('rsvp-email-input').fill('invalid-email')

    // The email input has type="email" which provides browser validation
    const emailInput = page.getByTestId('rsvp-email-input')
    await expect(emailInput).toHaveAttribute('type', 'email')
  })

  test('should navigate from RSVP edit back to event page', async ({ page }) => {
    const uniqueEmail = `nav.test.${Date.now()}@test.com`

    // Navigate to public event page
    await page.goto(`/events/${eventSlug}`)

    // Submit RSVP
    await page.getByTestId('rsvp-status-attending').click()
    await page.getByTestId('rsvp-name-input').fill('Nav Test Guest')
    await page.getByTestId('rsvp-email-input').fill(uniqueEmail)
    await page.getByTestId('rsvp-submit-button').click()
    await page.waitForURL(/email=/)

    // Go to edit page
    await page.getByRole('link', { name: /edit.*rsvp/i }).click()
    await page.waitForURL(/rsvp\/.*\/edit/)

    // Click back to event link
    await page.getByRole('link', { name: /back to event/i }).click()

    // Verify we're back on event page
    await expect(page).toHaveURL(/events\//)
  })
})

test.describe('Guest Limit Enforcement', () => {
  test('should enforce max guests per invitee limit', async ({ page }) => {
    // Login as user
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(testUsers.user.email)
    await page.getByLabel(/password/i).fill(testUsers.user.password)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/dashboard/)

    // Create event with guest limit
    await page.goto('/dashboard/events/new')
    await page.getByTestId('event-title-input').fill('Limited Guest Event ' + Date.now())
    await page.getByTestId('event-description-input').fill('Event with guest limit')
    await page.getByTestId('event-location-input').fill('Test Location')

    // Set date to 30 days from now
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    await page.getByTestId('event-date-input').fill(futureDate.toISOString().slice(0, 10))
    await page.getByTestId('event-time-input').fill('14:00')

    // Set max guests per invitee (uncheck unlimited, set to 2)
    await page.getByLabel(/unlimited guests/i).uncheck()
    await page.getByRole('spinbutton').fill('2')

    // Create event
    await page.getByTestId('event-submit-button').click()
    await page.waitForURL(/dashboard\/events\//)

    // Get event slug
    const publicLinkElement = page.locator('code').first()
    const publicUrl = await publicLinkElement.textContent()
    const limitedEventSlug = publicUrl?.split('/events/')[1] || ''

    // Navigate to public event page
    await page.goto(`/events/${limitedEventSlug}`)

    // Select attending
    await page.getByTestId('rsvp-status-attending').click()
    await page.getByTestId('rsvp-name-input').fill('Limited Guest')
    await page.getByTestId('rsvp-email-input').fill(`limited.guest.${Date.now()}@test.com`)

    // Add one additional guest (limit is 2 total, so 1 additional)
    await page.getByTestId('rsvp-add-guest-button').click()
    await page.getByPlaceholder(/guest 1 name/i).fill('Allowed Guest')

    // The add button should now be disabled
    await expect(page.getByTestId('rsvp-add-guest-button')).toBeDisabled()

    // Verify max reached message
    await expect(page.getByText(/maximum number of guests/i)).toBeVisible()
  })
})

test.describe('RSVP Deadline', () => {
  test('should not allow RSVP after deadline has passed', async ({ page }) => {
    // Login as user
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(testUsers.user.email)
    await page.getByLabel(/password/i).fill(testUsers.user.password)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/dashboard/)

    // Create event with past RSVP deadline
    await page.goto('/dashboard/events/new')
    await page.getByTestId('event-title-input').fill('Past Deadline Event ' + Date.now())
    await page.getByTestId('event-description-input').fill('Event with past deadline')
    await page.getByTestId('event-location-input').fill('Test Location')

    // Set event date to 30 days from now
    const eventDate = new Date()
    eventDate.setDate(eventDate.getDate() + 30)
    await page.getByTestId('event-date-input').fill(eventDate.toISOString().slice(0, 10))
    await page.getByTestId('event-time-input').fill('14:00')

    // Set RSVP deadline to yesterday (past)
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1)
    await page.locator('input[name="rsvpDeadlineDate"]').fill(pastDate.toISOString().slice(0, 10))
    await page.locator('input[name="rsvpDeadlineTime"]').fill('12:00')

    // Create event
    await page.getByTestId('event-submit-button').click()
    await page.waitForURL(/dashboard\/events\//)

    // Get event slug
    const publicLinkElement = page.locator('code').first()
    const publicUrl = await publicLinkElement.textContent()
    const deadlineEventSlug = publicUrl?.split('/events/')[1] || ''

    // Navigate to public event page
    await page.goto(`/events/${deadlineEventSlug}`)

    // Verify deadline passed message (use exact match to avoid multiple matches)
    await expect(page.getByText('The RSVP deadline has passed.')).toBeVisible()

    // RSVP form should show deadline message
    await expect(page.getByText(/contact the host directly/i)).toBeVisible()
  })
})

test.describe('Invalid Token', () => {
  test('should show 404 page for invalid RSVP token', async ({ page }) => {
    // Navigate to invalid token URL
    await page.goto('/rsvp/invalid-token-12345')

    // Should show 404 page (use specific heading)
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible()
  })
})

test.describe('RSVP Status Change on Update', () => {
  test('should change RSVP from attending to not attending', async ({ page }) => {
    // Login as user
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(testUsers.user.email)
    await page.getByLabel(/password/i).fill(testUsers.user.password)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/dashboard/)

    // Create event
    await page.goto('/dashboard/events/new')
    await page.getByTestId('event-title-input').fill('Status Change Event ' + Date.now())
    await page.getByTestId('event-description-input').fill('Event for status change testing')
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

    const uniqueEmail = `status.change.${Date.now()}@test.com`

    // Submit initial RSVP as attending
    await page.goto(`/events/${eventSlug}`)
    await page.getByTestId('rsvp-status-attending').click()
    await page.getByTestId('rsvp-name-input').fill('Status Change Guest')
    await page.getByTestId('rsvp-email-input').fill(uniqueEmail)
    await page.getByTestId('rsvp-submit-button').click()
    await page.waitForURL(/email=/)

    // Verify guest appears in Who's Coming
    await expect(page.getByText('Status Change Guest')).toBeVisible()

    // Edit RSVP
    await page.getByRole('link', { name: /edit.*rsvp/i }).click()
    await page.waitForURL(/rsvp\/.*\/edit/)

    // Change to Not Attending
    await page.locator('button', { hasText: /can't go/i }).click()
    await page.getByRole('button', { name: /update rsvp/i }).click()

    // Wait for redirect
    await page.waitForURL(/events\//)
  })
})
