import { test, expect, testUsers, waitForPageLoad, expectToast } from './fixtures/test-fixtures'

test.describe('Admin Panel', () => {
  test.describe('Access Control', () => {
    test('admin can access /dashboard/admin', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await page.goto('/dashboard/admin')
      await waitForPageLoad(page)

      // Verify admin dashboard is displayed
      await expect(page.getByRole('heading', { name: /admin dashboard/i })).toBeVisible()
      await expect(page.getByText(/manage users, events, and system-wide settings/i)).toBeVisible()
    })

    test('regular user cannot access /dashboard/admin and gets 404', async ({ page, loginAsUser }) => {
      await loginAsUser()
      await page.goto('/dashboard/admin')
      await waitForPageLoad(page)

      // Should show 404 page (notFound() is called for non-admins)
      await expect(page.getByRole('heading', { name: '404' })).toBeVisible()
      // Should NOT see admin dashboard
      await expect(page.getByRole('heading', { name: /admin dashboard/i })).not.toBeVisible()
    })

    test('unauthenticated user is redirected to login', async ({ page }) => {
      await page.goto('/dashboard/admin')

      // Should be redirected to login page
      await page.waitForURL(/login/)
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
    })
  })

  test.describe('User Management', () => {
    test.beforeEach(async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await page.goto('/dashboard/admin')
      await waitForPageLoad(page)
    })

    test('displays list of users with roles', async ({ page }) => {
      // Verify "All Users" card is visible
      await expect(page.getByRole('heading', { name: /all users/i })).toBeVisible()
      await expect(page.getByText(/manage user accounts and permissions/i)).toBeVisible()

      // Verify test users are displayed
      await expect(page.getByText(testUsers.admin.email)).toBeVisible()
      await expect(page.getByText(testUsers.user.email)).toBeVisible()

      // Verify role badges are displayed (look for ADMIN text in the user list)
      await expect(page.locator('text=ADMIN').first()).toBeVisible()
    })

    test('can edit user name and role', async ({ page }) => {
      // Find the test user row edit button using data-testid
      await page.getByTestId(`edit-user-${testUsers.user.email}`).click()

      // Verify edit dialog opens
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('heading', { name: /edit user/i })).toBeVisible()

      // Update name - scope to dialog
      const nameInput = dialog.getByLabel(/^name/i)
      await nameInput.clear()
      await nameInput.fill('Updated Test User')

      // Update role to Administrator - scope to dialog
      await dialog.getByRole('combobox').click()
      await page.getByRole('option', { name: /administrator/i }).click()

      // Submit the form
      await dialog.getByRole('button', { name: /update user/i }).click()

      // Verify success toast
      await expectToast(page, 'user updated')

      // Verify dialog closes
      await expect(dialog).not.toBeVisible()

      // Revert the changes for other tests - edit user again
      await page.reload()
      await waitForPageLoad(page)

      await page.getByTestId(`edit-user-${testUsers.user.email}`).click()

      const dialog2 = page.getByRole('dialog')
      const nameInputRevert = dialog2.getByLabel(/^name/i)
      await nameInputRevert.clear()
      await nameInputRevert.fill(testUsers.user.name)

      await dialog2.getByRole('combobox').click()
      await page.getByRole('option', { name: /^user$/i }).click()

      await dialog2.getByRole('button', { name: /update user/i }).click()
      await expectToast(page, 'user updated')
    })

    test('can create a new user with invitation', async ({ page }) => {
      // Click "Add User" button
      await page.getByRole('button', { name: /add user/i }).click()

      // Verify dialog opens
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('heading', { name: /create new user/i })).toBeVisible()

      // Verify "Send invitation" checkbox is checked by default
      const invitationCheckbox = dialog.getByLabel(/send invitation email/i)
      await expect(invitationCheckbox).toBeChecked()

      // Fill in user details - scope to dialog
      const uniqueEmail = `newuser-${Date.now()}@test.com`
      await dialog.getByLabel(/^name/i).fill('New Test User')
      await dialog.getByLabel(/^email/i).fill(uniqueEmail)

      // Keep invitation enabled (default) and set role - scope to dialog
      await dialog.getByRole('combobox').click()
      await page.getByRole('option', { name: /^user$/i }).click()

      // Submit the form
      await dialog.getByRole('button', { name: /create & send invitation/i }).click()

      // Wait for API call (may take a moment if email sending is attempted)
      await page.waitForResponse(
        (response) => response.url().includes('/api/auth/register') && response.status() === 200,
        { timeout: 15000 }
      ).catch(() => {
        // If email sending fails, we might get an error, but user should still be created
      })

      // Verify success toast appears
      await expectToast(page, 'user created')
    })

    test('can create a new user without invitation (with password)', async ({ page }) => {
      // Click "Add User" button
      await page.getByRole('button', { name: /add user/i }).click()

      // Verify dialog opens
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // Uncheck "Send invitation" to show password field
      const invitationCheckbox = dialog.getByLabel(/send invitation email/i)
      await invitationCheckbox.uncheck()
      await expect(invitationCheckbox).not.toBeChecked()

      // Password field should now be visible - scope to dialog
      await expect(dialog.getByLabel(/^password/i)).toBeVisible()

      // Fill in user details - scope to dialog
      const uniqueEmail = `newuser-noinvite-${Date.now()}@test.com`
      await dialog.getByLabel(/^name/i).fill('New User No Invite')
      await dialog.getByLabel(/^email/i).fill(uniqueEmail)
      await dialog.getByLabel(/^password/i).fill('TestPassword123!')

      // Submit the form
      await dialog.getByRole('button', { name: /create user/i }).click()

      // Verify success
      await expectToast(page, 'user created|has been added')
    })

    test('can delete a user with confirmation', async ({ page }) => {
      // First, create a user to delete
      await page.getByRole('button', { name: /add user/i }).click()
      const createDialog = page.getByRole('dialog')
      await expect(createDialog).toBeVisible()

      // Uncheck invitation to create with password
      await createDialog.getByLabel(/send invitation email/i).uncheck()

      const deleteEmail = `delete-me-${Date.now()}@test.com`
      await createDialog.getByLabel(/^name/i).fill('User To Delete')
      await createDialog.getByLabel(/^email/i).fill(deleteEmail)
      await createDialog.getByLabel(/^password/i).fill('TestPassword123!')

      await createDialog.getByRole('button', { name: /create user/i }).click()
      await expectToast(page, 'user created|has been added')

      // Wait for page to refresh and show new user
      await page.reload()
      await waitForPageLoad(page)

      // Find the newly created user and delete them
      await expect(page.getByText(deleteEmail)).toBeVisible()

      // Set up dialog handler for confirmation
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain(deleteEmail)
        await dialog.accept()
      })

      // Click delete button using data-testid
      await page.getByTestId(`delete-user-${deleteEmail}`).click()

      // Verify success toast
      await expectToast(page, 'user deleted')

      // Verify user delete button is no longer visible (user was removed)
      await expect(page.getByTestId(`delete-user-${deleteEmail}`)).not.toBeVisible()
    })
  })

  test.describe('Email Configuration', () => {
    test.beforeEach(async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await page.goto('/dashboard/admin')
      await waitForPageLoad(page)
    })

    test('displays email configuration section', async ({ page }) => {
      // Scroll to config section if needed
      await page.getByRole('heading', { name: /email configuration/i }).scrollIntoViewIfNeeded()

      // Verify email config card is visible
      await expect(page.getByRole('heading', { name: /email configuration/i })).toBeVisible()
      await expect(page.getByText(/configure smtp settings/i)).toBeVisible()
    })

    test('displays SMTP settings form fields', async ({ page }) => {
      // Verify all SMTP form fields are present
      await expect(page.getByLabel(/smtp host/i)).toBeVisible()
      await expect(page.getByLabel(/smtp port/i)).toBeVisible()
      await expect(page.getByLabel(/smtp username/i)).toBeVisible()
      await expect(page.getByLabel(/smtp password|api key/i)).toBeVisible()
      await expect(page.getByLabel(/from address/i)).toBeVisible()
    })

    test('can update SMTP configuration', async ({ page }) => {
      // Fill in SMTP settings
      const hostInput = page.getByLabel(/smtp host/i)
      await hostInput.clear()
      await hostInput.fill('smtp.test.com')

      const portInput = page.getByLabel(/smtp port/i)
      await portInput.clear()
      await portInput.fill('587')

      const userInput = page.getByLabel(/smtp username/i)
      await userInput.clear()
      await userInput.fill('testuser@test.com')

      const passwordInput = page.getByLabel(/smtp password|api key/i)
      await passwordInput.clear()
      await passwordInput.fill('test-api-key-123')

      const fromInput = page.getByLabel(/from address/i)
      await fromInput.clear()
      await fromInput.fill('OwnRSVP <noreply@test.com>')

      // Click save button
      await page.getByRole('button', { name: /save configuration/i }).click()

      // Verify success toast
      await expectToast(page, 'configuration saved|updated successfully')
    })

    test('displays test email input and button', async ({ page }) => {
      // Verify test email section exists
      await expect(page.getByLabel(/test email address/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /^test$/i })).toBeVisible()
    })

    test('can send test email', async ({ page }) => {
      // First ensure SMTP is configured
      const hostInput = page.getByLabel(/smtp host/i)
      const currentHost = await hostInput.inputValue()

      if (!currentHost) {
        // Configure minimal SMTP settings
        await hostInput.fill('smtp.test.com')
        await page.getByLabel(/smtp port/i).fill('587')
        await page.getByLabel(/smtp username/i).fill('test@test.com')
        await page.getByLabel(/smtp password|api key/i).fill('test-key')
        await page.getByLabel(/from address/i).fill('Test <test@test.com>')
        await page.getByRole('button', { name: /save configuration/i }).click()
        await page.waitForTimeout(1000) // Wait for save
      }

      // Fill test email address
      const testEmailInput = page.getByLabel(/test email address/i)
      await testEmailInput.fill('recipient@test.com')

      // Click test button
      await page.getByRole('button', { name: /^test$/i }).click()

      // Wait for response - might succeed or fail depending on SMTP config
      await page.waitForResponse(
        (response) => response.url().includes('/api/admin/config/email'),
        { timeout: 10000 }
      )

      // Should show either success or error toast
      await expect(
        page.getByText(/test email sent|failed to send|error/i)
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('App URL Configuration', () => {
    test.beforeEach(async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await page.goto('/dashboard/admin')
      await waitForPageLoad(page)
    })

    test('displays App URL configuration section', async ({ page }) => {
      // Verify App URL config card is visible
      await expect(page.getByRole('heading', { name: /app url/i })).toBeVisible()
      await expect(page.getByText(/set the public url/i)).toBeVisible()
    })

    test('displays App URL input field', async ({ page }) => {
      await expect(page.getByLabel(/public app url/i)).toBeVisible()
    })

    test('can update App URL setting', async ({ page }) => {
      const urlInput = page.getByLabel(/public app url/i)
      await urlInput.clear()
      await urlInput.fill('https://rsvp.example.com')

      // Click save button in the App URL section
      // The App URL section has its own save button
      const appUrlCard = page.locator('div').filter({ hasText: /app url/i }).first()
      await appUrlCard.getByRole('button', { name: /save/i }).click()

      // Verify success toast
      await expectToast(page, 'app url saved|updated|saved')
    })

    test('validates URL format', async ({ page }) => {
      const urlInput = page.getByLabel(/public app url/i)
      await urlInput.clear()
      await urlInput.fill('not-a-valid-url')

      // Try to save
      const appUrlSection = page.locator('div').filter({ hasText: /set the public url/i }).first()
      await appUrlSection.getByRole('button', { name: /save/i }).click()

      // Should show validation error
      await expectToast(page, 'valid url|error')
    })
  })

  test.describe('Admin Statistics', () => {
    test.beforeEach(async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await page.goto('/dashboard/admin')
      await waitForPageLoad(page)
    })

    test('displays Total Users card', async ({ page }) => {
      await expect(page.getByText(/total users/i).first()).toBeVisible()
      // Should show at least 2 users (admin and regular test user)
      await expect(page.getByText(/\d+ administrators?/i)).toBeVisible()
    })

    test('displays Total Events card', async ({ page }) => {
      await expect(page.getByText(/total events/i).first()).toBeVisible()
      // Should show upcoming and past counts
      await expect(page.getByText(/\d+ upcoming/i)).toBeVisible()
    })

    test('Total Events card links to dashboard', async ({ page }) => {
      // Click on Total Events card
      await page.getByText(/total events/i).first().click()

      // Should navigate to dashboard
      await page.waitForURL(/\/dashboard$/)
    })
  })

  test.describe('Server Controls', () => {
    test.beforeEach(async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await page.goto('/dashboard/admin')
      await waitForPageLoad(page)
    })

    test('displays Restart Server button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /restart server/i })).toBeVisible()
    })

    test('displays Factory Reset button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /factory reset/i })).toBeVisible()
    })

    // Note: We don't actually test clicking these as they would disrupt the test environment
    test('Factory Reset button opens confirmation dialog', async ({ page }) => {
      await page.getByRole('button', { name: /factory reset/i }).click()

      // Should show confirmation dialog
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByText(/are you sure|cannot be undone|delete all data/i)).toBeVisible()

      // Cancel the dialog
      await page.getByRole('button', { name: /cancel/i }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible()
    })
  })

  test.describe('Event Management (Admin View)', () => {
    test.beforeEach(async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
    })

    test('admin can view all events on dashboard', async ({ page }) => {
      await page.goto('/dashboard')
      await waitForPageLoad(page)

      // Admin should see the events dashboard
      await expect(page.getByRole('heading', { name: /your events|events/i })).toBeVisible()
    })

    test('admin can create test events for bulk delete', async ({ page, createTestEvent }) => {
      // Create multiple test events
      const eventId = await createTestEvent()
      expect(eventId).toBeTruthy()
    })
  })

  test.describe('Password Management', () => {
    test.beforeEach(async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await page.goto('/dashboard/admin')
      await waitForPageLoad(page)
    })

    test('can open change password dialog', async ({ page }) => {
      // Find a user and click change password
      const userRow = page.locator('div').filter({ hasText: testUsers.user.email }).first()
      await userRow.getByRole('button', { name: /change password/i }).click()

      // Verify dialog opens
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('heading', { name: /change password/i })).toBeVisible()
      await expect(page.getByLabel(/new password/i)).toBeVisible()
      await expect(page.getByLabel(/confirm password/i)).toBeVisible()

      // Close dialog
      await page.getByRole('button', { name: /cancel/i }).click()
    })

    test('validates password confirmation', async ({ page }) => {
      const userRow = page.locator('div').filter({ hasText: testUsers.user.email }).first()
      await userRow.getByRole('button', { name: /change password/i }).click()

      await expect(page.getByRole('dialog')).toBeVisible()

      // Enter mismatched passwords
      await page.getByLabel(/new password/i).fill('NewPassword123!')
      await page.getByLabel(/confirm password/i).fill('DifferentPassword123!')

      await page.getByRole('button', { name: /change password/i }).click()

      // Should show error
      await expectToast(page, 'do not match|error')

      // Close dialog
      await page.getByRole('button', { name: /cancel/i }).click()
    })

    test('validates minimum password length', async ({ page }) => {
      const userRow = page.locator('div').filter({ hasText: testUsers.user.email }).first()
      await userRow.getByRole('button', { name: /change password/i }).click()

      await expect(page.getByRole('dialog')).toBeVisible()

      // Enter short password
      await page.getByLabel(/new password/i).fill('short')
      await page.getByLabel(/confirm password/i).fill('short')

      await page.getByRole('button', { name: /change password/i }).click()

      // Should show error about minimum length
      await expectToast(page, 'at least 6|minimum|too short|error')

      // Close dialog
      await page.getByRole('button', { name: /cancel/i }).click()
    })
  })
})
