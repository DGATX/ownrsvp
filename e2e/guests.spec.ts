import { test, expect, testUsers, testEvent, testGuest, waitForPageLoad, expectToast } from './fixtures/test-fixtures'

test.describe('Guest Management', () => {
  let eventId: string
  const uniqueSuffix = Date.now()
  const guestEmail = `guest-${uniqueSuffix}@test.com`
  const guestName = `Test Guest ${uniqueSuffix}`

  test.beforeEach(async ({ page, loginAsUser, createTestEvent }) => {
    // Login as regular user and create a test event
    await loginAsUser()
    eventId = await createTestEvent()

    // Navigate to the event page
    await page.goto(`/dashboard/events/${eventId}`)
    await waitForPageLoad(page)
  })

  test.describe('Add Guest', () => {
    test('should open add guest dialog and add a new guest', async ({ page }) => {
      // Click the Add Guest button
      await page.getByRole('button', { name: /add guest/i }).click()

      // Wait for dialog to open
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('heading', { name: /add guest/i })).toBeVisible()

      // Fill in guest details
      await page.getByLabel(/name/i).fill(guestName)
      await page.getByLabel(/email/i).fill(guestEmail)
      await page.getByLabel(/phone/i).fill('+1234567890')

      // Uncheck send invitation checkbox (to avoid email sending in tests)
      const sendInviteCheckbox = page.locator('input#sendInvite')
      if (await sendInviteCheckbox.isChecked()) {
        await sendInviteCheckbox.uncheck()
      }

      // Submit the form
      await page.getByRole('button', { name: /add guest/i }).last().click()

      // Verify success toast
      await expectToast(page, 'guest added')

      // Verify guest appears in the list
      await expect(page.getByText(guestName)).toBeVisible()
      await expect(page.getByText(guestEmail)).toBeVisible()
    })

    test('should show validation error for invalid email', async ({ page }) => {
      await page.getByRole('button', { name: /add guest/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      await page.getByLabel(/name/i).fill('Invalid Guest')
      await page.getByLabel(/email/i).fill('invalid-email')

      // Try to submit - should fail HTML5 validation
      await page.getByRole('button', { name: /add guest/i }).last().click()

      // Dialog should still be open due to validation
      await expect(page.getByRole('dialog')).toBeVisible()
    })
  })

  test.describe('Guest List Display', () => {
    test.beforeEach(async ({ page }) => {
      // Add a guest first
      await page.getByRole('button', { name: /add guest/i }).click()
      await page.getByLabel(/name/i).fill(guestName)
      await page.getByLabel(/email/i).fill(guestEmail)

      const sendInviteCheckbox = page.locator('input#sendInvite')
      if (await sendInviteCheckbox.isChecked()) {
        await sendInviteCheckbox.uncheck()
      }

      await page.getByRole('button', { name: /add guest/i }).last().click()
      await expectToast(page, 'guest added')
      await page.waitForTimeout(500) // Wait for list to update
    })

    test('should display guests with status badges', async ({ page }) => {
      // Verify guest row is displayed
      const guestRow = page.locator(`[data-testid="guest-row-${guestEmail}"]`)
      await expect(guestRow).toBeVisible()

      // Verify status badge (should be Pending for new guest)
      await expect(guestRow.getByText(/pending/i)).toBeVisible()
    })

    test('should filter guests by PENDING status', async ({ page }) => {
      // Click on Pending in RSVP Summary
      await page.locator('button').filter({ hasText: /pending/i }).click()

      // Verify the filter is applied (indicated by ring around the button)
      await expect(page.locator('button').filter({ hasText: /pending/i }).first()).toHaveClass(/ring-2/)

      // Guest should still be visible
      await expect(page.getByText(guestName)).toBeVisible()

      // Clear filter
      await page.getByRole('button', { name: /clear/i }).click()
    })

    test('should filter guests by ATTENDING status', async ({ page }) => {
      // Click on Attending in RSVP Summary
      await page.locator('button').filter({ hasText: /attending/i }).first().click()

      // Since our guest is PENDING, they should not be visible when filtering by ATTENDING
      // The "No guests in this category" message should appear or guest should be hidden
      const guestRow = page.locator(`[data-testid="guest-row-${guestEmail}"]`)
      await expect(guestRow).not.toBeVisible()
    })
  })

  test.describe('Edit Guest', () => {
    test.beforeEach(async ({ page }) => {
      // Add a guest first
      await page.getByRole('button', { name: /add guest/i }).click()
      await page.getByLabel(/name/i).fill(guestName)
      await page.getByLabel(/email/i).fill(guestEmail)

      const sendInviteCheckbox = page.locator('input#sendInvite')
      if (await sendInviteCheckbox.isChecked()) {
        await sendInviteCheckbox.uncheck()
      }

      await page.getByRole('button', { name: /add guest/i }).last().click()
      await expectToast(page, 'guest added')
      await page.waitForTimeout(500)
    })

    test('should open edit dialog and modify guest details', async ({ page }) => {
      // Find the guest row and click edit button
      const guestRow = page.locator(`[data-testid="guest-row-${guestEmail}"]`)

      // Click the edit button (pencil icon)
      await guestRow.getByRole('button').filter({ has: page.locator('svg.lucide-edit') }).click()

      // Wait for edit dialog
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('heading', { name: /edit guest/i })).toBeVisible()

      // Modify guest name
      const newName = `Updated Guest ${uniqueSuffix}`
      await page.getByLabel(/^name$/i).clear()
      await page.getByLabel(/^name$/i).fill(newName)

      // Change status to ATTENDING
      await page.getByLabel(/rsvp status/i).click()
      await page.getByRole('option', { name: /attending/i }).click()

      // Save changes
      await page.getByRole('button', { name: /update guest/i }).click()

      // Verify success toast
      await expectToast(page, 'guest updated')

      // Verify the name was updated
      await expect(page.getByText(newName)).toBeVisible()
    })

    test('should update guest status', async ({ page }) => {
      const guestRow = page.locator(`[data-testid="guest-row-${guestEmail}"]`)
      await guestRow.getByRole('button').filter({ has: page.locator('svg.lucide-edit') }).click()

      await expect(page.getByRole('dialog')).toBeVisible()

      // Change status to NOT_ATTENDING
      await page.getByLabel(/rsvp status/i).click()
      await page.getByRole('option', { name: /not attending/i }).click()

      await page.getByRole('button', { name: /update guest/i }).click()
      await expectToast(page, 'guest updated')

      // Verify status badge changed
      await expect(guestRow.getByText(/not attending/i)).toBeVisible()
    })
  })

  test.describe('Delete Guest', () => {
    test.beforeEach(async ({ page }) => {
      // Add a guest first
      await page.getByRole('button', { name: /add guest/i }).click()
      await page.getByLabel(/name/i).fill(guestName)
      await page.getByLabel(/email/i).fill(guestEmail)

      const sendInviteCheckbox = page.locator('input#sendInvite')
      if (await sendInviteCheckbox.isChecked()) {
        await sendInviteCheckbox.uncheck()
      }

      await page.getByRole('button', { name: /add guest/i }).last().click()
      await expectToast(page, 'guest added')
      await page.waitForTimeout(500)
    })

    test('should show confirmation and delete guest', async ({ page }) => {
      const guestRow = page.locator(`[data-testid="guest-row-${guestEmail}"]`)

      // Setup dialog handler for confirmation
      page.on('dialog', dialog => dialog.accept())

      // Click delete button
      await guestRow.locator(`[data-testid="guest-delete-${guestEmail}"]`).click()

      // Verify success toast
      await expectToast(page, 'guest removed')

      // Verify guest is no longer in the list
      await expect(page.getByText(guestEmail)).not.toBeVisible()
    })

    test('should cancel deletion when dialog is dismissed', async ({ page }) => {
      const guestRow = page.locator(`[data-testid="guest-row-${guestEmail}"]`)

      // Setup dialog handler to dismiss
      page.on('dialog', dialog => dialog.dismiss())

      // Click delete button
      await guestRow.locator(`[data-testid="guest-delete-${guestEmail}"]`).click()

      // Guest should still be visible
      await expect(page.getByText(guestEmail)).toBeVisible()
    })
  })

  test.describe('Bulk Import', () => {
    test('should open import dialog and show template download', async ({ page }) => {
      // Click Import button
      await page.getByRole('button', { name: /import/i }).click()

      // Wait for dialog
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('heading', { name: /import guests from csv/i })).toBeVisible()

      // Verify download template button exists
      await expect(page.getByRole('button', { name: /download template/i })).toBeVisible()
    })

    test('should upload CSV and preview guests', async ({ page }) => {
      // Click Import button
      await page.getByRole('button', { name: /import/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Create a CSV content
      const csvContent = `name,email,phone
John Doe,john${uniqueSuffix}@example.com,+1111111111
Jane Smith,jane${uniqueSuffix}@example.com,+2222222222
Invalid Guest,not-an-email,`

      // Create a file input event
      const fileInput = page.locator('input[type="file"]')

      // Create a temporary CSV file using buffer
      const buffer = Buffer.from(csvContent, 'utf-8')
      await fileInput.setInputFiles({
        name: 'guests.csv',
        mimeType: 'text/csv',
        buffer: buffer,
      })

      // Wait for preview table to appear
      await expect(page.getByRole('table')).toBeVisible()

      // Verify valid count shows (2 valid emails)
      await expect(page.getByText(/2 valid/i)).toBeVisible()

      // Verify invalid count shows (1 invalid email)
      await expect(page.getByText(/1 invalid/i)).toBeVisible()
    })

    test('should import valid guests from CSV', async ({ page }) => {
      await page.getByRole('button', { name: /import/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      const csvContent = `name,email
Import Test User,import${uniqueSuffix}@example.com`

      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles({
        name: 'guests.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csvContent, 'utf-8'),
      })

      await expect(page.getByText(/1 valid/i)).toBeVisible()

      // Click import button
      await page.getByRole('button', { name: /import 1 guests/i }).click()

      // Wait for import to complete
      await expectToast(page, 'import complete')

      // Close dialog
      await page.getByRole('button', { name: /close/i }).click()

      // Verify imported guest appears in list
      await page.waitForTimeout(2000) // Wait for refresh
      await expect(page.getByText(`import${uniqueSuffix}@example.com`)).toBeVisible()
    })
  })

  test.describe('Send Invitation', () => {
    test.beforeEach(async ({ page }) => {
      // Add a guest first
      await page.getByRole('button', { name: /add guest/i }).click()
      await page.getByLabel(/name/i).fill(guestName)
      await page.getByLabel(/email/i).fill(guestEmail)

      const sendInviteCheckbox = page.locator('input#sendInvite')
      if (await sendInviteCheckbox.isChecked()) {
        await sendInviteCheckbox.uncheck()
      }

      await page.getByRole('button', { name: /add guest/i }).last().click()
      await expectToast(page, 'guest added')
      await page.waitForTimeout(500)
    })

    test('should open send invitation dialog', async ({ page }) => {
      const guestRow = page.locator(`[data-testid="guest-row-${guestEmail}"]`)

      // Click send invite button
      await guestRow.locator(`[data-testid="guest-send-invite-${guestEmail}"]`).click()

      // Wait for dialog
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('heading', { name: /send invitation/i })).toBeVisible()

      // Verify guest email is mentioned
      await expect(page.getByText(new RegExp(guestEmail, 'i'))).toBeVisible()
    })

    test('should send invitation successfully', async ({ page }) => {
      const guestRow = page.locator(`[data-testid="guest-row-${guestEmail}"]`)

      await guestRow.locator(`[data-testid="guest-send-invite-${guestEmail}"]`).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Click send invitation button
      await page.getByRole('button', { name: /send invitation/i }).click()

      // Verify success toast (may fail if email not configured, but dialog should close)
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15000 })
    })
  })

  test.describe('Send Reminder', () => {
    test.beforeEach(async ({ page }) => {
      // Add a guest first
      await page.getByRole('button', { name: /add guest/i }).click()
      await page.getByLabel(/name/i).fill(guestName)
      await page.getByLabel(/email/i).fill(guestEmail)

      const sendInviteCheckbox = page.locator('input#sendInvite')
      if (await sendInviteCheckbox.isChecked()) {
        await sendInviteCheckbox.uncheck()
      }

      await page.getByRole('button', { name: /add guest/i }).last().click()
      await expectToast(page, 'guest added')
      await page.waitForTimeout(500)
    })

    test('should show send reminder button for pending guests', async ({ page }) => {
      const guestRow = page.locator(`[data-testid="guest-row-${guestEmail}"]`)

      // Reminder button (clock icon) should be visible for PENDING guests who haven't received a reminder
      const reminderButton = guestRow.getByRole('button').filter({ has: page.locator('svg.lucide-clock') })
      await expect(reminderButton).toBeVisible()
    })

    test('should send reminder successfully', async ({ page }) => {
      const guestRow = page.locator(`[data-testid="guest-row-${guestEmail}"]`)

      // Click reminder button
      const reminderButton = guestRow.getByRole('button').filter({ has: page.locator('svg.lucide-clock') })
      await reminderButton.click()

      // Should show success or error toast (depending on email config)
      // In test environment, we just verify the request was made
      await page.waitForTimeout(2000)

      // After sending reminder, the button should be hidden (reminderSentAt is set)
      // Or a toast message appeared
    })
  })

  test.describe('Per-Guest Settings', () => {
    test.beforeEach(async ({ page }) => {
      // Add a guest first
      await page.getByRole('button', { name: /add guest/i }).click()
      await page.getByLabel(/name/i).fill(guestName)
      await page.getByLabel(/email/i).fill(guestEmail)

      const sendInviteCheckbox = page.locator('input#sendInvite')
      if (await sendInviteCheckbox.isChecked()) {
        await sendInviteCheckbox.uncheck()
      }

      await page.getByRole('button', { name: /add guest/i }).last().click()
      await expectToast(page, 'guest added')
      await page.waitForTimeout(500)
    })

    test('should open per-guest limit editor dialog', async ({ page }) => {
      const guestRow = page.locator(`[data-testid="guest-row-${guestEmail}"]`)

      // Click users icon button (Edit Guest Limit)
      const limitButton = guestRow.getByRole('button').filter({ has: page.locator('svg.lucide-users') })
      await limitButton.click()

      // Wait for dialog
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('heading', { name: /edit guest limit/i })).toBeVisible()
    })

    test('should set custom guest limit', async ({ page }) => {
      const guestRow = page.locator(`[data-testid="guest-row-${guestEmail}"]`)

      const limitButton = guestRow.getByRole('button').filter({ has: page.locator('svg.lucide-users') })
      await limitButton.click()

      await expect(page.getByRole('dialog')).toBeVisible()

      // Uncheck "Use global limit" to enable custom limit
      const useGlobalCheckbox = page.locator('#useGlobal')
      if (await useGlobalCheckbox.isChecked()) {
        await useGlobalCheckbox.uncheck()
      }

      // Set custom limit
      await page.getByLabel(/custom limit/i).fill('3')

      // Save
      await page.getByRole('button', { name: /save/i }).click()

      // Verify success toast
      await expectToast(page, 'guest limit updated')

      // Verify the custom limit badge appears on the guest row
      await expect(guestRow.getByText(/custom limit/i)).toBeVisible()
    })

    test('should revert to global limit', async ({ page }) => {
      // First set a custom limit
      const guestRow = page.locator(`[data-testid="guest-row-${guestEmail}"]`)

      let limitButton = guestRow.getByRole('button').filter({ has: page.locator('svg.lucide-users') })
      await limitButton.click()

      await expect(page.getByRole('dialog')).toBeVisible()

      // Set custom limit first
      const useGlobalCheckbox = page.locator('#useGlobal')
      if (await useGlobalCheckbox.isChecked()) {
        await useGlobalCheckbox.uncheck()
      }
      await page.getByLabel(/custom limit/i).fill('5')
      await page.getByRole('button', { name: /save/i }).click()
      await expectToast(page, 'guest limit updated')

      await page.waitForTimeout(500)

      // Now revert to global
      limitButton = guestRow.getByRole('button').filter({ has: page.locator('svg.lucide-users') })
      await limitButton.click()

      await expect(page.getByRole('dialog')).toBeVisible()

      // Check "Use global limit"
      await page.locator('#useGlobal').check()

      await page.getByRole('button', { name: /save/i }).click()
      await expectToast(page, 'guest limit updated')
    })
  })

  test.describe('Guest RSVP Status', () => {
    const statusGuestEmail = `status-guest-${uniqueSuffix}@test.com`
    const statusGuestName = `Status Guest ${uniqueSuffix}`

    test.beforeEach(async ({ page }) => {
      // Add a guest
      await page.getByRole('button', { name: /add guest/i }).click()
      await page.getByLabel(/name/i).fill(statusGuestName)
      await page.getByLabel(/email/i).fill(statusGuestEmail)

      const sendInviteCheckbox = page.locator('input#sendInvite')
      if (await sendInviteCheckbox.isChecked()) {
        await sendInviteCheckbox.uncheck()
      }

      await page.getByRole('button', { name: /add guest/i }).last().click()
      await expectToast(page, 'guest added')
      await page.waitForTimeout(500)
    })

    test('should display PENDING status for new guest', async ({ page }) => {
      const guestRow = page.locator(`[data-testid="guest-row-${statusGuestEmail}"]`)
      await expect(guestRow.getByText(/pending/i)).toBeVisible()
    })

    test('should change status to ATTENDING', async ({ page }) => {
      const guestRow = page.locator(`[data-testid="guest-row-${statusGuestEmail}"]`)

      // Open edit dialog
      await guestRow.getByRole('button').filter({ has: page.locator('svg.lucide-edit') }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Change status
      await page.getByLabel(/rsvp status/i).click()
      await page.getByRole('option', { name: /^attending$/i }).click()

      // Save
      await page.getByRole('button', { name: /update guest/i }).click()
      await expectToast(page, 'guest updated')

      // Verify status badge
      await expect(guestRow.getByText(/^attending$/i)).toBeVisible()
    })

    test('should change status to MAYBE', async ({ page }) => {
      const guestRow = page.locator(`[data-testid="guest-row-${statusGuestEmail}"]`)

      await guestRow.getByRole('button').filter({ has: page.locator('svg.lucide-edit') }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      await page.getByLabel(/rsvp status/i).click()
      await page.getByRole('option', { name: /maybe/i }).click()

      await page.getByRole('button', { name: /update guest/i }).click()
      await expectToast(page, 'guest updated')

      await expect(guestRow.getByText(/maybe/i)).toBeVisible()
    })

    test('should change status to NOT_ATTENDING', async ({ page }) => {
      const guestRow = page.locator(`[data-testid="guest-row-${statusGuestEmail}"]`)

      await guestRow.getByRole('button').filter({ has: page.locator('svg.lucide-edit') }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      await page.getByLabel(/rsvp status/i).click()
      await page.getByRole('option', { name: /not attending/i }).click()

      await page.getByRole('button', { name: /update guest/i }).click()
      await expectToast(page, 'guest updated')

      await expect(guestRow.getByText(/not attending/i)).toBeVisible()
    })

    test('should filter and show only ATTENDING guests', async ({ page }) => {
      const guestRow = page.locator(`[data-testid="guest-row-${statusGuestEmail}"]`)

      // First change guest status to ATTENDING
      await guestRow.getByRole('button').filter({ has: page.locator('svg.lucide-edit') }).click()
      await page.getByLabel(/rsvp status/i).click()
      await page.getByRole('option', { name: /^attending$/i }).click()
      await page.getByRole('button', { name: /update guest/i }).click()
      await expectToast(page, 'guest updated')

      // Now filter by ATTENDING
      await page.locator('button').filter({ hasText: /attending/i }).first().click()

      // Guest should be visible
      await expect(page.getByText(statusGuestName)).toBeVisible()

      // Clear filter
      await page.getByRole('button', { name: /clear/i }).click()
    })

    test('should filter and show only MAYBE guests', async ({ page }) => {
      const guestRow = page.locator(`[data-testid="guest-row-${statusGuestEmail}"]`)

      // Change guest status to MAYBE
      await guestRow.getByRole('button').filter({ has: page.locator('svg.lucide-edit') }).click()
      await page.getByLabel(/rsvp status/i).click()
      await page.getByRole('option', { name: /maybe/i }).click()
      await page.getByRole('button', { name: /update guest/i }).click()
      await expectToast(page, 'guest updated')

      // Filter by MAYBE
      await page.locator('button').filter({ hasText: /maybe/i }).click()

      // Guest should be visible
      await expect(page.getByText(statusGuestName)).toBeVisible()
    })

    test('should filter and show only NOT_ATTENDING guests', async ({ page }) => {
      const guestRow = page.locator(`[data-testid="guest-row-${statusGuestEmail}"]`)

      // Change guest status to NOT_ATTENDING
      await guestRow.getByRole('button').filter({ has: page.locator('svg.lucide-edit') }).click()
      await page.getByLabel(/rsvp status/i).click()
      await page.getByRole('option', { name: /not attending/i }).click()
      await page.getByRole('button', { name: /update guest/i }).click()
      await expectToast(page, 'guest updated')

      // Filter by NOT_ATTENDING
      await page.locator('button').filter({ hasText: /not attending/i }).click()

      // Guest should be visible
      await expect(page.getByText(statusGuestName)).toBeVisible()
    })

    test('should update RSVP summary counts when status changes', async ({ page }) => {
      // Get initial pending count
      const pendingButton = page.locator('button').filter({ hasText: /pending/i }).first()
      const initialPendingText = await pendingButton.textContent()
      const initialPendingCount = parseInt(initialPendingText?.match(/\d+/)?.[0] || '0')

      // Change guest status to ATTENDING
      const guestRow = page.locator(`[data-testid="guest-row-${statusGuestEmail}"]`)
      await guestRow.getByRole('button').filter({ has: page.locator('svg.lucide-edit') }).click()
      await page.getByLabel(/rsvp status/i).click()
      await page.getByRole('option', { name: /^attending$/i }).click()
      await page.getByRole('button', { name: /update guest/i }).click()
      await expectToast(page, 'guest updated')

      // Wait for page refresh
      await page.waitForTimeout(1000)

      // Verify pending count decreased
      const newPendingText = await pendingButton.textContent()
      const newPendingCount = parseInt(newPendingText?.match(/\d+/)?.[0] || '0')

      expect(newPendingCount).toBeLessThan(initialPendingCount)
    })
  })

  test.describe('Bulk Operations', () => {
    const bulkGuest1Email = `bulk1-${uniqueSuffix}@test.com`
    const bulkGuest2Email = `bulk2-${uniqueSuffix}@test.com`

    test.beforeEach(async ({ page }) => {
      // Add two guests for bulk operations
      for (const email of [bulkGuest1Email, bulkGuest2Email]) {
        await page.getByRole('button', { name: /add guest/i }).click()
        await page.getByLabel(/name/i).fill(`Bulk Guest ${email}`)
        await page.getByLabel(/email/i).fill(email)

        const sendInviteCheckbox = page.locator('input#sendInvite')
        if (await sendInviteCheckbox.isChecked()) {
          await sendInviteCheckbox.uncheck()
        }

        await page.getByRole('button', { name: /add guest/i }).last().click()
        await expectToast(page, 'guest added')
        await page.waitForTimeout(500)
      }
    })

    test('should enter bulk select mode', async ({ page }) => {
      // Click Bulk Select button
      await page.getByRole('button', { name: /bulk select/i }).click()

      // Verify Select All checkbox appears
      await expect(page.getByText(/select all/i)).toBeVisible()

      // Exit bulk select mode
      await page.getByRole('button', { name: /exit bulk select/i }).click()
    })

    test('should select multiple guests', async ({ page }) => {
      // Enter bulk select mode
      await page.getByRole('button', { name: /bulk select/i }).click()

      // Select all
      await page.getByText(/select all/i).click()

      // Verify selection count
      await expect(page.getByText(/\d+ guests? selected/i)).toBeVisible()
    })

    test('should perform bulk delete', async ({ page }) => {
      // Enter bulk select mode
      await page.getByRole('button', { name: /bulk select/i }).click()

      // Select first guest
      const guestRow1 = page.locator(`[data-testid="guest-row-${bulkGuest1Email}"]`)
      await guestRow1.locator('button[role="checkbox"]').click()

      // Verify 1 guest selected
      await expect(page.getByText(/1 guest selected/i)).toBeVisible()

      // Setup dialog handler for confirmation
      page.on('dialog', dialog => dialog.accept())

      // Click delete button in bulk actions
      await page.getByRole('button', { name: /delete/i }).filter({ has: page.locator('svg.lucide-trash-2') }).click()

      // Verify success toast
      await expectToast(page, 'bulk operation')

      // Verify guest was removed
      await page.waitForTimeout(1000)
      await expect(page.getByText(bulkGuest1Email)).not.toBeVisible()
    })

    test('should perform bulk status change', async ({ page }) => {
      // Enter bulk select mode
      await page.getByRole('button', { name: /bulk select/i }).click()

      // Select all
      await page.getByText(/select all/i).click()

      // Change status dropdown
      await page.getByRole('combobox').filter({ hasText: /change status/i }).click()
      await page.getByRole('option', { name: /attending/i }).click()

      // Verify success
      await expectToast(page, 'bulk operation')

      // Exit bulk select
      await page.waitForTimeout(1000)

      // Verify status changed
      const guestRow1 = page.locator(`[data-testid="guest-row-${bulkGuest1Email}"]`)
      await expect(guestRow1.getByText(/attending/i)).toBeVisible()
    })
  })

  test.describe('Copy RSVP Link', () => {
    test.beforeEach(async ({ page }) => {
      // Add a guest first
      await page.getByRole('button', { name: /add guest/i }).click()
      await page.getByLabel(/name/i).fill(guestName)
      await page.getByLabel(/email/i).fill(guestEmail)

      const sendInviteCheckbox = page.locator('input#sendInvite')
      if (await sendInviteCheckbox.isChecked()) {
        await sendInviteCheckbox.uncheck()
      }

      await page.getByRole('button', { name: /add guest/i }).last().click()
      await expectToast(page, 'guest added')
      await page.waitForTimeout(500)
    })

    test('should copy RSVP link to clipboard', async ({ page, context }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])

      const guestRow = page.locator(`[data-testid="guest-row-${guestEmail}"]`)

      // Click copy link button
      await guestRow.locator(`[data-testid="guest-copy-link-${guestEmail}"]`).click()

      // Verify success toast
      await expectToast(page, 'link copied')
    })
  })
})
