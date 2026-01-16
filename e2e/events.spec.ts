import { test, expect, testUsers, testEvent, waitForPageLoad } from './fixtures/test-fixtures'

/**
 * E2E Tests for Event Management
 * Tests dashboard, event creation, editing, deletion, and public events
 */

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page, loginAsUser }) => {
    await loginAsUser()
  })

  test('should display dashboard with event list', async ({ page }) => {
    await page.goto('/dashboard')
    await waitForPageLoad(page)

    // Check page title and header
    await expect(page.locator('h1')).toContainText(/Events/i)

    // Check for "Create Event" button
    await expect(page.getByRole('link', { name: /Create Event/i })).toBeVisible()
  })

  test('should show empty state when no events exist', async ({ page }) => {
    await page.goto('/dashboard')
    await waitForPageLoad(page)

    // For a fresh user with no events, should show empty state
    // This might show events if the user already has some, so we check for either state
    const hasEvents = await page.locator('[class*="grid"]').locator('a[href^="/dashboard/events/"]').count()

    if (hasEvents === 0) {
      // Empty state should be visible
      await expect(page.getByText(/No events yet|Create your first event/i)).toBeVisible()
      await expect(page.getByRole('link', { name: /Create.*Event/i })).toBeVisible()
    } else {
      // Events should be displayed in cards
      await expect(page.locator('a[href^="/dashboard/events/"]').first()).toBeVisible()
    }
  })

  test('should display event cards with correct information', async ({ page, createTestEvent }) => {
    // Create a test event first
    const eventId = await createTestEvent()

    await page.goto('/dashboard')
    await waitForPageLoad(page)

    // Find the event card by looking for the event link
    const eventCard = page.locator(`a[href="/dashboard/events/${eventId}"]`)
    await expect(eventCard).toBeVisible()

    // Check that the card contains expected elements (date, attending count)
    await expect(eventCard.locator('text=/attending/')).toBeVisible()
  })

  test('should navigate to event details from dashboard', async ({ page, createTestEvent }) => {
    const eventId = await createTestEvent()

    await page.goto('/dashboard')
    await waitForPageLoad(page)

    // Click on the event card
    const eventLink = page.locator(`a[href="/dashboard/events/${eventId}"]`)
    await eventLink.click()

    // Should navigate to event details page
    await expect(page).toHaveURL(`/dashboard/events/${eventId}`)
    await expect(page.locator('h1')).toBeVisible()
  })
})

test.describe('Create Event', () => {
  test.beforeEach(async ({ page, loginAsUser }) => {
    await loginAsUser()
  })

  test('should navigate to create event form', async ({ page }) => {
    await page.goto('/dashboard')
    await waitForPageLoad(page)

    // Click create event button
    await page.getByRole('link', { name: /Create Event/i }).first().click()

    // Should be on the new event page
    await expect(page).toHaveURL('/dashboard/events/new')
    await expect(page.getByRole('heading', { name: /Create New Event/i })).toBeVisible()
  })

  test('should fill all fields and create event successfully', async ({ page }) => {
    await page.goto('/dashboard/events/new')
    await waitForPageLoad(page)

    // Generate unique event title
    const uniqueTitle = `E2E Test Event ${Date.now()}`

    // Fill in the form
    await page.getByLabel(/Event Title/i).fill(uniqueTitle)
    await page.getByLabel(/Description/i).fill('This is a comprehensive test event created by Playwright E2E tests')
    await page.getByLabel(/Location/i).fill('123 Test Street, Test City, TC 12345')

    // Set date to 30 days from now
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const dateStr = futureDate.toISOString().split('T')[0]

    await page.locator('input[name="date"]').fill(dateStr)
    await page.locator('input[name="time"]').fill('14:00')

    // Submit the form
    await page.getByRole('button', { name: /Create Event/i }).click()

    // Should redirect to event page
    await expect(page).toHaveURL(/\/dashboard\/events\/[a-zA-Z0-9-]+/)

    // Event title should be visible on the page
    await expect(page.getByText(uniqueTitle)).toBeVisible()

    // Success toast should appear
    await expect(page.getByText(/Event created/i)).toBeVisible({ timeout: 10000 })
  })

  test('should handle optional fields correctly', async ({ page }) => {
    await page.goto('/dashboard/events/new')
    await waitForPageLoad(page)

    const uniqueTitle = `Minimal Event ${Date.now()}`

    // Fill only required fields
    await page.getByLabel(/Event Title/i).fill(uniqueTitle)

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const dateStr = futureDate.toISOString().split('T')[0]

    await page.locator('input[name="date"]').fill(dateStr)
    await page.locator('input[name="time"]').fill('10:00')

    // Submit without optional fields
    await page.getByRole('button', { name: /Create Event/i }).click()

    // Should still create successfully
    await expect(page).toHaveURL(/\/dashboard\/events\/[a-zA-Z0-9-]+/)
    await expect(page.getByText(uniqueTitle)).toBeVisible()
  })

  test('should set end date and time', async ({ page }) => {
    await page.goto('/dashboard/events/new')
    await waitForPageLoad(page)

    const uniqueTitle = `Event with End Time ${Date.now()}`

    await page.getByLabel(/Event Title/i).fill(uniqueTitle)

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const dateStr = futureDate.toISOString().split('T')[0]

    await page.locator('input[name="date"]').fill(dateStr)
    await page.locator('input[name="time"]').fill('14:00')
    await page.locator('input[name="endDate"]').fill(dateStr)
    await page.locator('input[name="endTime"]').fill('18:00')

    await page.getByRole('button', { name: /Create Event/i }).click()

    await expect(page).toHaveURL(/\/dashboard\/events\/[a-zA-Z0-9-]+/)
  })
})

test.describe('Event Validation', () => {
  test.beforeEach(async ({ page, loginAsUser }) => {
    await loginAsUser()
    await page.goto('/dashboard/events/new')
    await waitForPageLoad(page)
  })

  test('should require event title', async ({ page }) => {
    // Try to submit without title
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const dateStr = futureDate.toISOString().split('T')[0]

    await page.locator('input[name="date"]').fill(dateStr)
    await page.locator('input[name="time"]').fill('14:00')

    await page.getByRole('button', { name: /Create Event/i }).click()

    // Form should not submit - HTML5 validation will prevent it
    // We should still be on the same page
    await expect(page).toHaveURL('/dashboard/events/new')
  })

  test('should require date', async ({ page }) => {
    // Fill title but not date
    await page.getByLabel(/Event Title/i).fill('Test Event')
    await page.locator('input[name="time"]').fill('14:00')

    await page.getByRole('button', { name: /Create Event/i }).click()

    // Should stay on the form page
    await expect(page).toHaveURL('/dashboard/events/new')
  })

  test('should require time', async ({ page }) => {
    // Fill title and date but not time
    await page.getByLabel(/Event Title/i).fill('Test Event')

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const dateStr = futureDate.toISOString().split('T')[0]

    await page.locator('input[name="date"]').fill(dateStr)
    // Clear the default time
    await page.locator('input[name="time"]').fill('')

    await page.getByRole('button', { name: /Create Event/i }).click()

    // Should stay on the form page or show error
    await expect(page).toHaveURL('/dashboard/events/new')
  })

  test('should validate email format for reply-to field', async ({ page }) => {
    await page.getByLabel(/Event Title/i).fill('Test Event')

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const dateStr = futureDate.toISOString().split('T')[0]

    await page.locator('input[name="date"]').fill(dateStr)
    await page.locator('input[name="time"]').fill('14:00')

    // Enter invalid email
    await page.getByLabel(/Reply-To Email/i).fill('invalid-email')

    await page.getByRole('button', { name: /Create Event/i }).click()

    // HTML5 email validation should prevent submission
    await expect(page).toHaveURL('/dashboard/events/new')
  })
})

test.describe('View Event', () => {
  test.beforeEach(async ({ page, loginAsUser }) => {
    await loginAsUser()
  })

  test('should display event details page', async ({ page, createTestEvent }) => {
    const eventId = await createTestEvent()

    await page.goto(`/dashboard/events/${eventId}`)
    await waitForPageLoad(page)

    // Check main event elements are visible
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.getByRole('link', { name: /Edit/i })).toBeVisible()
    await expect(page.getByText(/Back to Events/i)).toBeVisible()
  })

  test('should show RSVP summary statistics', async ({ page, createTestEvent }) => {
    const eventId = await createTestEvent()

    await page.goto(`/dashboard/events/${eventId}`)
    await waitForPageLoad(page)

    // Check for guest statistics
    await expect(page.getByText(/attending/i)).toBeVisible()
    await expect(page.getByText(/pending|Total/i)).toBeVisible()
  })

  test('should display public event link', async ({ page, createTestEvent }) => {
    const eventId = await createTestEvent()

    await page.goto(`/dashboard/events/${eventId}`)
    await waitForPageLoad(page)

    // Check for public link section
    await expect(page.getByText(/Public Event Link/i)).toBeVisible()

    // Check for copy button
    await expect(page.getByRole('button', { name: /Copy/i })).toBeVisible()
  })

  test('should show add to calendar button', async ({ page, createTestEvent }) => {
    const eventId = await createTestEvent()

    await page.goto(`/dashboard/events/${eventId}`)
    await waitForPageLoad(page)

    // Check for add to calendar
    await expect(page.getByRole('button', { name: /Add to Calendar/i })).toBeVisible()
  })

  test('should navigate to edit page from event details', async ({ page, createTestEvent }) => {
    const eventId = await createTestEvent()

    await page.goto(`/dashboard/events/${eventId}`)
    await waitForPageLoad(page)

    // Click edit button
    await page.getByRole('link', { name: /Edit/i }).click()

    // Should navigate to edit page
    await expect(page).toHaveURL(`/dashboard/events/${eventId}/edit`)
  })
})

test.describe('Edit Event', () => {
  test.beforeEach(async ({ page, loginAsUser }) => {
    await loginAsUser()
  })

  test('should navigate to edit page and load existing data', async ({ page, createTestEvent }) => {
    const eventId = await createTestEvent()

    await page.goto(`/dashboard/events/${eventId}/edit`)
    await waitForPageLoad(page)

    // Check that the form is pre-filled
    await expect(page.getByRole('heading', { name: /Edit Event/i })).toBeVisible()

    // Title input should have a value
    const titleInput = page.getByLabel(/Event Title/i)
    await expect(titleInput).toHaveValue(/.+/)
  })

  test('should modify event fields and save changes', async ({ page, createTestEvent }) => {
    const eventId = await createTestEvent()

    await page.goto(`/dashboard/events/${eventId}/edit`)
    await waitForPageLoad(page)

    // Modify the title
    const newTitle = `Updated Event ${Date.now()}`
    await page.getByLabel(/Event Title/i).fill(newTitle)

    // Modify description
    await page.getByLabel(/Description/i).fill('This description has been updated')

    // Modify location
    await page.getByLabel(/Location/i).fill('New Updated Location, 456 Test Ave')

    // Submit changes
    await page.getByRole('button', { name: /Save Changes/i }).click()

    // Should redirect to event page
    await expect(page).toHaveURL(`/dashboard/events/${eventId}`)

    // Updated title should be visible
    await expect(page.getByText(newTitle)).toBeVisible()
  })

  test('should show notify guests option', async ({ page, createTestEvent }) => {
    const eventId = await createTestEvent()

    await page.goto(`/dashboard/events/${eventId}/edit`)
    await waitForPageLoad(page)

    // Check for notify guests checkbox
    await expect(page.getByText(/Notify guests of changes/i)).toBeVisible()
  })

  test('should navigate back to event from edit page', async ({ page, createTestEvent }) => {
    const eventId = await createTestEvent()

    await page.goto(`/dashboard/events/${eventId}/edit`)
    await waitForPageLoad(page)

    // Click back link
    await page.getByText(/Back to Event/i).click()

    // Should navigate back to event page
    await expect(page).toHaveURL(`/dashboard/events/${eventId}`)
  })

  test('should update date and time', async ({ page, createTestEvent }) => {
    const eventId = await createTestEvent()

    await page.goto(`/dashboard/events/${eventId}/edit`)
    await waitForPageLoad(page)

    // Update date to 60 days from now
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 60)
    const dateStr = futureDate.toISOString().split('T')[0]

    await page.locator('input[name="date"]').fill(dateStr)
    await page.locator('input[name="time"]').fill('16:00')

    await page.getByRole('button', { name: /Save Changes/i }).click()

    // Should save successfully
    await expect(page).toHaveURL(`/dashboard/events/${eventId}`)
  })
})

test.describe('Delete Event', () => {
  test.beforeEach(async ({ page, loginAsUser }) => {
    await loginAsUser()
  })

  test('should show delete button on event page', async ({ page, createTestEvent }) => {
    const eventId = await createTestEvent()

    await page.goto(`/dashboard/events/${eventId}`)
    await waitForPageLoad(page)

    // Check for delete button
    await expect(page.getByRole('button', { name: /Delete/i })).toBeVisible()
  })

  test('should show delete button on edit page', async ({ page, createTestEvent }) => {
    const eventId = await createTestEvent()

    await page.goto(`/dashboard/events/${eventId}/edit`)
    await waitForPageLoad(page)

    // Check for delete button (destructive variant with trash icon)
    const deleteButton = page.locator('button[class*="destructive"]')
    await expect(deleteButton).toBeVisible()
  })

  test('should delete event with confirmation', async ({ page, createTestEvent }) => {
    const eventId = await createTestEvent()

    await page.goto(`/dashboard/events/${eventId}`)
    await waitForPageLoad(page)

    // Set up dialog handler before clicking delete
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('delete')
      await dialog.accept()
    })

    // Click delete button
    await page.getByRole('button', { name: /Delete/i }).click()

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard')

    // Success toast should appear
    await expect(page.getByText(/Event deleted/i)).toBeVisible({ timeout: 10000 })
  })

  test('should cancel delete when confirmation is dismissed', async ({ page, createTestEvent }) => {
    const eventId = await createTestEvent()

    await page.goto(`/dashboard/events/${eventId}`)
    await waitForPageLoad(page)

    // Set up dialog handler to dismiss
    page.on('dialog', async (dialog) => {
      await dialog.dismiss()
    })

    // Click delete button
    await page.getByRole('button', { name: /Delete/i }).click()

    // Should still be on the same page
    await expect(page).toHaveURL(`/dashboard/events/${eventId}`)
  })
})

test.describe('Public Events', () => {
  test('should display public events page', async ({ page }) => {
    await page.goto('/events')
    await waitForPageLoad(page)

    // Check page title
    await expect(page.getByRole('heading', { name: /Upcoming Events/i })).toBeVisible()
    await expect(page.getByText(/Browse public events/i)).toBeVisible()
  })

  test('should show empty state when no public events', async ({ page }) => {
    await page.goto('/events')
    await waitForPageLoad(page)

    // Check for either events grid or empty state
    const hasEvents = await page.locator('a[href^="/events/"]').count()

    if (hasEvents === 0) {
      await expect(page.getByText(/No upcoming events/i)).toBeVisible()
      await expect(page.getByRole('link', { name: /Create an Event/i })).toBeVisible()
    }
  })

  test('should navigate to public event details', async ({ page, loginAsUser, createTestEvent }) => {
    // First create a public event
    await loginAsUser()
    await page.goto('/dashboard/events/new')
    await waitForPageLoad(page)

    const uniqueTitle = `Public Event ${Date.now()}`
    await page.getByLabel(/Event Title/i).fill(uniqueTitle)

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const dateStr = futureDate.toISOString().split('T')[0]

    await page.locator('input[name="date"]').fill(dateStr)
    await page.locator('input[name="time"]').fill('14:00')

    await page.getByRole('button', { name: /Create Event/i }).click()
    await expect(page).toHaveURL(/\/dashboard\/events\/[a-zA-Z0-9-]+/)

    // Get the slug from the page (public link contains it)
    const publicLinkElement = await page.locator('code').textContent()
    const slugMatch = publicLinkElement?.match(/\/events\/([a-zA-Z0-9-]+)/)

    if (slugMatch) {
      const slug = slugMatch[1]

      // Now visit the public events page
      await page.goto(`/events/${slug}`)
      await waitForPageLoad(page)

      // Check that event details are shown
      await expect(page.getByText(uniqueTitle)).toBeVisible()
      await expect(page.getByText(/RSVP/i)).toBeVisible()
    }
  })

  test('should display RSVP form on public event page', async ({ page, loginAsUser, createTestEvent }) => {
    // Create an event and get its slug
    await loginAsUser()
    await page.goto('/dashboard/events/new')
    await waitForPageLoad(page)

    const uniqueTitle = `RSVP Form Test Event ${Date.now()}`
    await page.getByLabel(/Event Title/i).fill(uniqueTitle)

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const dateStr = futureDate.toISOString().split('T')[0]

    await page.locator('input[name="date"]').fill(dateStr)
    await page.locator('input[name="time"]').fill('14:00')

    await page.getByRole('button', { name: /Create Event/i }).click()
    await expect(page).toHaveURL(/\/dashboard\/events\/[a-zA-Z0-9-]+/)

    // Get the slug
    const publicLinkElement = await page.locator('code').textContent()
    const slugMatch = publicLinkElement?.match(/\/events\/([a-zA-Z0-9-]+)/)

    if (slugMatch) {
      const slug = slugMatch[1]

      await page.goto(`/events/${slug}`)
      await waitForPageLoad(page)

      // Check RSVP form elements
      await expect(page.getByRole('heading', { name: /RSVP/i })).toBeVisible()
      await expect(page.getByText(/Let the host know if you can make it/i)).toBeVisible()
    }
  })

  test('should show guest wall on public event page', async ({ page, loginAsUser }) => {
    // Create an event and get its slug
    await loginAsUser()
    await page.goto('/dashboard/events/new')
    await waitForPageLoad(page)

    const uniqueTitle = `Guest Wall Test Event ${Date.now()}`
    await page.getByLabel(/Event Title/i).fill(uniqueTitle)

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const dateStr = futureDate.toISOString().split('T')[0]

    await page.locator('input[name="date"]').fill(dateStr)
    await page.locator('input[name="time"]').fill('14:00')

    await page.getByRole('button', { name: /Create Event/i }).click()
    await expect(page).toHaveURL(/\/dashboard\/events\/[a-zA-Z0-9-]+/)

    const publicLinkElement = await page.locator('code').textContent()
    const slugMatch = publicLinkElement?.match(/\/events\/([a-zA-Z0-9-]+)/)

    if (slugMatch) {
      const slug = slugMatch[1]

      await page.goto(`/events/${slug}`)
      await waitForPageLoad(page)

      // Check for guest wall section
      await expect(page.getByRole('heading', { name: /Guest Wall/i })).toBeVisible()
      await expect(page.getByText(/Leave a message/i)).toBeVisible()
    }
  })
})

test.describe('Event Settings', () => {
  test.beforeEach(async ({ page, loginAsUser }) => {
    await loginAsUser()
  })

  test('should set max guests per invitee on create', async ({ page }) => {
    await page.goto('/dashboard/events/new')
    await waitForPageLoad(page)

    const uniqueTitle = `Max Guests Event ${Date.now()}`
    await page.getByLabel(/Event Title/i).fill(uniqueTitle)

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const dateStr = futureDate.toISOString().split('T')[0]

    await page.locator('input[name="date"]').fill(dateStr)
    await page.locator('input[name="time"]').fill('14:00')

    // Uncheck unlimited guests
    await page.getByLabel(/Unlimited guests allowed/i).uncheck()

    // Set max guests
    await page.locator('input#maxGuestsPerInvitee').fill('3')

    await page.getByRole('button', { name: /Create Event/i }).click()

    await expect(page).toHaveURL(/\/dashboard\/events\/[a-zA-Z0-9-]+/)
  })

  test('should toggle unlimited guests checkbox', async ({ page }) => {
    await page.goto('/dashboard/events/new')
    await waitForPageLoad(page)

    // Initially checked
    const checkbox = page.getByLabel(/Unlimited guests allowed/i)
    await expect(checkbox).toBeChecked()

    // Uncheck it
    await checkbox.uncheck()
    await expect(checkbox).not.toBeChecked()

    // Max guests input should appear
    await expect(page.locator('input#maxGuestsPerInvitee')).toBeVisible()

    // Check it again
    await checkbox.check()
    await expect(checkbox).toBeChecked()

    // Max guests input should disappear
    await expect(page.locator('input#maxGuestsPerInvitee')).not.toBeVisible()
  })

  test('should set RSVP deadline', async ({ page }) => {
    await page.goto('/dashboard/events/new')
    await waitForPageLoad(page)

    const uniqueTitle = `RSVP Deadline Event ${Date.now()}`
    await page.getByLabel(/Event Title/i).fill(uniqueTitle)

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const dateStr = futureDate.toISOString().split('T')[0]

    await page.locator('input[name="date"]').fill(dateStr)
    await page.locator('input[name="time"]').fill('14:00')

    // Set RSVP deadline to 7 days before event
    const deadlineDate = new Date()
    deadlineDate.setDate(deadlineDate.getDate() + 23)
    const deadlineDateStr = deadlineDate.toISOString().split('T')[0]

    await page.locator('input[name="rsvpDeadlineDate"]').fill(deadlineDateStr)
    await page.locator('input[name="rsvpDeadlineTime"]').fill('23:59')

    await page.getByRole('button', { name: /Create Event/i }).click()

    await expect(page).toHaveURL(/\/dashboard\/events\/[a-zA-Z0-9-]+/)

    // Check that RSVP deadline is shown
    await expect(page.getByText(/RSVP deadline/i)).toBeVisible()
  })

  test('should show reminder manager on create form', async ({ page }) => {
    await page.goto('/dashboard/events/new')
    await waitForPageLoad(page)

    // Check for reminder section
    await expect(page.getByText(/Reminder|Automatic Reminders/i)).toBeVisible()
  })

  test('should edit max guests setting on existing event', async ({ page, createTestEvent }) => {
    const eventId = await createTestEvent()

    await page.goto(`/dashboard/events/${eventId}/edit`)
    await waitForPageLoad(page)

    // Uncheck unlimited guests
    const checkbox = page.getByLabel(/Unlimited guests allowed/i)
    if (await checkbox.isChecked()) {
      await checkbox.uncheck()
    }

    // Set max guests
    await page.locator('input#maxGuestsPerInvitee').fill('5')

    await page.getByRole('button', { name: /Save Changes/i }).click()

    await expect(page).toHaveURL(`/dashboard/events/${eventId}`)
  })

  test('should edit RSVP deadline on existing event', async ({ page, createTestEvent }) => {
    const eventId = await createTestEvent()

    await page.goto(`/dashboard/events/${eventId}/edit`)
    await waitForPageLoad(page)

    // Set RSVP deadline
    const deadlineDate = new Date()
    deadlineDate.setDate(deadlineDate.getDate() + 20)
    const deadlineDateStr = deadlineDate.toISOString().split('T')[0]

    await page.locator('input[name="rsvpDeadlineDate"]').fill(deadlineDateStr)
    await page.locator('input[name="rsvpDeadlineTime"]').fill('18:00')

    await page.getByRole('button', { name: /Save Changes/i }).click()

    await expect(page).toHaveURL(`/dashboard/events/${eventId}`)
  })
})

test.describe('Admin Event Management', () => {
  test.beforeEach(async ({ page, loginAsAdmin }) => {
    await loginAsAdmin()
  })

  test('should show all events for admin', async ({ page }) => {
    await page.goto('/dashboard')
    await waitForPageLoad(page)

    // Admin should see "All Events" heading
    await expect(page.getByRole('heading', { name: /All Events/i })).toBeVisible()
    await expect(page.getByText(/Manage all events across the system/i)).toBeVisible()
  })

  test('should allow admin to create events', async ({ page }) => {
    await page.goto('/dashboard/events/new')
    await waitForPageLoad(page)

    const uniqueTitle = `Admin Created Event ${Date.now()}`
    await page.getByLabel(/Event Title/i).fill(uniqueTitle)

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const dateStr = futureDate.toISOString().split('T')[0]

    await page.locator('input[name="date"]').fill(dateStr)
    await page.locator('input[name="time"]').fill('14:00')

    await page.getByRole('button', { name: /Create Event/i }).click()

    await expect(page).toHaveURL(/\/dashboard\/events\/[a-zA-Z0-9-]+/)
    await expect(page.getByText(uniqueTitle)).toBeVisible()
  })
})
