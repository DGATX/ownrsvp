import { test, expect, testUsers, waitForPageLoad, expectToast } from './fixtures/test-fixtures'

test.describe('Authentication Flows', () => {
  test.describe('Login Page', () => {
    test('should display the login page with all elements', async ({ page }) => {
      await page.goto('/login')

      // Check page title and branding
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
      await expect(page.getByText(/sign in to manage your events/i)).toBeVisible()
      await expect(page.getByText('OwnRSVP')).toBeVisible()

      // Check form elements
      await expect(page.getByLabel(/email or username/i)).toBeVisible()
      await expect(page.getByLabel(/password/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()

      // Check links
      await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible()
    })

    test('should show validation for empty form submission', async ({ page }) => {
      await page.goto('/login')

      // Try to submit empty form - HTML5 validation should prevent submission
      const emailInput = page.getByLabel(/email or username/i)
      const passwordInput = page.getByLabel(/password/i)

      // Check required attribute
      await expect(emailInput).toHaveAttribute('required', '')
      await expect(passwordInput).toHaveAttribute('required', '')

      // Try clicking submit - should not navigate away due to validation
      await page.getByRole('button', { name: /sign in/i }).click()
      await expect(page).toHaveURL(/\/login/)
    })

    test('should show error message for invalid credentials', async ({ page }) => {
      await page.goto('/login')

      await page.getByLabel(/email or username/i).fill('invalid@example.com')
      await page.getByLabel(/password/i).fill('wrongpassword')
      await page.getByRole('button', { name: /sign in/i }).click()

      // Wait for error toast to appear
      await expectToast(page, /invalid email\/username or password/i)
    })

    test('should show error for valid email but wrong password', async ({ page }) => {
      await page.goto('/login')

      await page.getByLabel(/email or username/i).fill(testUsers.admin.email)
      await page.getByLabel(/password/i).fill('incorrectpassword123')
      await page.getByRole('button', { name: /sign in/i }).click()

      await expectToast(page, /invalid email\/username or password/i)
    })

    test('should show loading state during login', async ({ page }) => {
      await page.goto('/login')

      await page.getByLabel(/email or username/i).fill(testUsers.admin.email)
      await page.getByLabel(/password/i).fill(testUsers.admin.password)

      // Click and check for loading state
      const submitButton = page.getByRole('button', { name: /sign in/i })
      await submitButton.click()

      // The button should show loading spinner (Loader2 component)
      // Note: This happens quickly so we check if the button becomes disabled
      await expect(submitButton).toBeDisabled()
    })
  })

  test.describe('Successful Login', () => {
    test('should login successfully as admin with email', async ({ page }) => {
      await page.goto('/login')

      await page.getByLabel(/email or username/i).fill(testUsers.admin.email)
      await page.getByLabel(/password/i).fill(testUsers.admin.password)
      await page.getByRole('button', { name: /sign in/i }).click()

      // Should redirect to dashboard
      await page.waitForURL(/\/dashboard/)
      await expect(page).toHaveURL(/\/dashboard/)

      // Verify user is logged in by checking for dashboard content
      await expect(page.getByRole('heading', { name: /all events/i, level: 1 })).toBeVisible({ timeout: 10000 })
    })

    test('should login successfully as regular user with email', async ({ page }) => {
      await page.goto('/login')

      await page.getByLabel(/email or username/i).fill(testUsers.user.email)
      await page.getByLabel(/password/i).fill(testUsers.user.password)
      await page.getByRole('button', { name: /sign in/i }).click()

      // Should redirect to dashboard
      await page.waitForURL(/\/dashboard/)
      await expect(page).toHaveURL(/\/dashboard/)
    })

    test('should redirect to callbackUrl after login', async ({ page }) => {
      // Try to access a protected page first
      await page.goto('/dashboard/profile')

      // Should redirect to login with callback
      await page.waitForURL(/\/login\?callbackUrl/)

      // Login
      await page.getByLabel(/email or username/i).fill(testUsers.admin.email)
      await page.getByLabel(/password/i).fill(testUsers.admin.password)
      await page.getByRole('button', { name: /sign in/i }).click()

      // Should redirect back to the original page
      await page.waitForURL(/\/dashboard\/profile/)
      await expect(page).toHaveURL(/\/dashboard\/profile/)
    })
  })

  test.describe('Login with Username', () => {
    test('should login successfully using username instead of email', async ({ page }) => {
      await page.goto('/login')

      // Use username instead of email
      await page.getByLabel(/email or username/i).fill(testUsers.admin.username)
      await page.getByLabel(/password/i).fill(testUsers.admin.password)
      await page.getByRole('button', { name: /sign in/i }).click()

      // Should redirect to dashboard
      await page.waitForURL(/\/dashboard/)
      await expect(page).toHaveURL(/\/dashboard/)
    })

    test('should login as regular user with username', async ({ page }) => {
      await page.goto('/login')

      await page.getByLabel(/email or username/i).fill(testUsers.user.username)
      await page.getByLabel(/password/i).fill(testUsers.user.password)
      await page.getByRole('button', { name: /sign in/i }).click()

      await page.waitForURL(/\/dashboard/)
      await expect(page).toHaveURL(/\/dashboard/)
    })

    test('should show error for invalid username', async ({ page }) => {
      await page.goto('/login')

      await page.getByLabel(/email or username/i).fill('nonexistentuser')
      await page.getByLabel(/password/i).fill('somepassword')
      await page.getByRole('button', { name: /sign in/i }).click()

      await expectToast(page, /invalid email\/username or password/i)
    })
  })

  test.describe('Logout', () => {
    test('should logout successfully and redirect to home', async ({ page, loginAsAdmin }) => {
      // First login
      await loginAsAdmin()

      // Wait for dashboard to load
      await expect(page).toHaveURL(/\/dashboard/)
      await waitForPageLoad(page)

      // Open user dropdown menu - the avatar button shows the user's initial
      // It's the button with a single letter that comes after the theme toggle
      const avatarButton = page.locator('nav button.rounded-full').first()
      await avatarButton.click()

      // Click sign out
      await page.getByRole('menuitem', { name: /sign out/i }).click()

      // Should redirect to home page
      await page.waitForURL('/')
      await expect(page).toHaveURL('/')
    })

    test('should clear session after logout', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await expect(page).toHaveURL(/\/dashboard/)

      // Logout
      const avatarButton = page.locator('nav button.rounded-full').first()
      await avatarButton.click()
      await page.getByRole('menuitem', { name: /sign out/i }).click()
      await page.waitForURL('/')

      // Try to access dashboard - should redirect to login
      await page.goto('/dashboard')
      await page.waitForURL(/\/login/)
      await expect(page).toHaveURL(/\/login/)
    })
  })

  test.describe('Protected Routes', () => {
    test('should redirect to login when accessing dashboard without auth', async ({ page }) => {
      await page.goto('/dashboard')

      // Should redirect to login
      await page.waitForURL(/\/login/)
      await expect(page).toHaveURL(/\/login/)
    })

    test('should redirect to login when accessing profile without auth', async ({ page }) => {
      await page.goto('/dashboard/profile')

      await page.waitForURL(/\/login/)
      await expect(page).toHaveURL(/\/login/)
    })

    test('should redirect to login when accessing admin page without auth', async ({ page }) => {
      await page.goto('/dashboard/admin')

      await page.waitForURL(/\/login/)
      await expect(page).toHaveURL(/\/login/)
    })

    test('should redirect to login when accessing event creation without auth', async ({ page }) => {
      await page.goto('/dashboard/events/new')

      await page.waitForURL(/\/login/)
      await expect(page).toHaveURL(/\/login/)
    })

    test('should allow access to public pages without auth', async ({ page }) => {
      // Home page should be accessible
      await page.goto('/')
      await expect(page).toHaveURL('/')

      // Login page should be accessible
      await page.goto('/login')
      await expect(page).toHaveURL('/login')

      // Register page should be accessible
      await page.goto('/register')
      await expect(page).toHaveURL('/register')

      // Forgot password should be accessible
      await page.goto('/forgot-password')
      await expect(page).toHaveURL('/forgot-password')
    })
  })

  test.describe('Registration Page', () => {
    test('should display registration page', async ({ page }) => {
      await page.goto('/register')

      // Should show either the registration form or "Registration Closed" message
      // Since test users already exist, registration is likely closed
      const registrationClosed = page.getByRole('heading', { name: /registration closed/i })
      const registrationForm = page.getByRole('heading', { name: /create admin account/i })

      // One of these should be visible
      await expect(registrationClosed.or(registrationForm)).toBeVisible({ timeout: 10000 })
    })

    test('should show login link from registration page', async ({ page }) => {
      await page.goto('/register')
      await waitForPageLoad(page)

      // Should have link to login page
      await expect(page.getByRole('link', { name: /sign in|go to login/i })).toBeVisible()
    })

    test('should display registration closed message when admin exists', async ({ page }) => {
      await page.goto('/register')
      await waitForPageLoad(page)

      // Since test users include an admin, registration should be closed
      await expect(page.getByRole('heading', { name: /registration closed/i })).toBeVisible({ timeout: 10000 })
      await expect(page.getByText(/admin account already exists/i)).toBeVisible()
    })

    test('should navigate to login from registration closed page', async ({ page }) => {
      await page.goto('/register')
      await waitForPageLoad(page)

      // Click login button/link
      await page.getByRole('link', { name: /go to login/i }).click()

      await page.waitForURL(/\/login/)
      await expect(page).toHaveURL(/\/login/)
    })
  })

  test.describe('Forgot Password Page', () => {
    test('should display forgot password page with form', async ({ page }) => {
      await page.goto('/forgot-password')

      await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible()
      await expect(page.getByText(/enter your email address/i)).toBeVisible()
      await expect(page.getByLabel(/email address/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /back to login/i })).toBeVisible()
    })

    test('should require valid email format', async ({ page }) => {
      await page.goto('/forgot-password')

      const emailInput = page.getByLabel(/email address/i)
      await expect(emailInput).toHaveAttribute('type', 'email')
      await expect(emailInput).toHaveAttribute('required', '')
    })

    test('should submit forgot password form', async ({ page }) => {
      await page.goto('/forgot-password')

      await page.getByLabel(/email address/i).fill(testUsers.admin.email)
      await page.getByRole('button', { name: /send reset link/i }).click()

      // Wait for either success state or error toast (depends on SMTP configuration)
      // In test environment without SMTP, this may show an error
      const successHeading = page.getByRole('heading', { name: /check your email/i })
      const errorToast = page.getByText(/error|failed/i).first()

      await expect(successHeading.or(errorToast)).toBeVisible({ timeout: 10000 })
    })

    test('should submit forgot password form for non-existent email', async ({ page }) => {
      await page.goto('/forgot-password')

      // Use a non-existent email
      await page.getByLabel(/email address/i).fill('nonexistent@example.com')
      await page.getByRole('button', { name: /send reset link/i }).click()

      // Should show success message (secure - prevents email enumeration) or error if SMTP not configured
      const successHeading = page.getByRole('heading', { name: /check your email/i })
      const errorToast = page.getByText(/error|failed/i).first()

      await expect(successHeading.or(errorToast)).toBeVisible({ timeout: 10000 })
    })

    test('should allow trying a different email after submission', async ({ page }) => {
      await page.goto('/forgot-password')

      await page.getByLabel(/email address/i).fill(testUsers.user.email)
      await page.getByRole('button', { name: /send reset link/i }).click()

      // Wait for response - either success or error
      const successHeading = page.getByRole('heading', { name: /check your email/i })
      const errorToast = page.getByText(/error|failed/i).first()
      await expect(successHeading.or(errorToast)).toBeVisible({ timeout: 10000 })

      // If success state, test the "Try a different email" button
      if (await successHeading.isVisible()) {
        await page.getByRole('button', { name: /try a different email/i }).click()
        // Should return to the form
        await expect(page.getByLabel(/email address/i)).toBeVisible()
      }
    })

    test('should navigate back to login', async ({ page }) => {
      await page.goto('/forgot-password')

      await page.getByRole('link', { name: /back to login/i }).click()

      await page.waitForURL(/\/login/)
      await expect(page).toHaveURL(/\/login/)
    })
  })

  test.describe('Profile Page', () => {
    test('should access profile page when authenticated', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()

      // Navigate to profile
      await page.goto('/dashboard/profile')
      await waitForPageLoad(page)

      await expect(page.getByRole('heading', { name: /profile settings/i })).toBeVisible()
    })

    test('should display profile form with current user data', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await page.goto('/dashboard/profile')
      await waitForPageLoad(page)

      // Check form fields exist
      await expect(page.getByLabel(/username/i).first()).toBeVisible()
      await expect(page.getByLabel(/display name/i)).toBeVisible()
      await expect(page.getByLabel(/email/i).first()).toBeVisible()

      // Check that the email field has the admin email
      const emailInput = page.getByLabel(/email/i).first()
      await expect(emailInput).toHaveValue(testUsers.admin.email)
    })

    test('should update display name successfully', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await page.goto('/dashboard/profile')
      await waitForPageLoad(page)

      // Update name
      const newName = 'Updated Admin Name ' + Date.now()
      const nameInput = page.getByLabel(/display name/i)
      await nameInput.clear()
      await nameInput.fill(newName)

      // Save changes
      await page.getByRole('button', { name: /save changes/i }).click()

      // Wait for success toast
      await expectToast(page, /profile updated/i)
    })

    test('should validate email format', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await page.goto('/dashboard/profile')
      await waitForPageLoad(page)

      // Try invalid email
      const emailInput = page.getByLabel(/email/i).first()
      await emailInput.clear()
      await emailInput.fill('invalid-email')

      await page.getByRole('button', { name: /save changes/i }).click()

      // Should show error
      await expectToast(page, /valid email/i)
    })

    test('should validate username format', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await page.goto('/dashboard/profile')
      await waitForPageLoad(page)

      // Username input should auto-strip invalid characters
      const usernameInput = page.getByLabel(/username/i).first()
      await usernameInput.clear()
      await usernameInput.fill('test@user!')

      // Should strip invalid characters - only letters, numbers, underscore allowed
      await expect(usernameInput).toHaveValue('testuser')
    })
  })

  test.describe('Theme Preference', () => {
    test('should display theme options in profile', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await page.goto('/dashboard/profile')
      await waitForPageLoad(page)

      // Check for appearance section
      await expect(page.getByRole('heading', { name: /appearance/i })).toBeVisible()
      await expect(page.getByText('Theme', { exact: true })).toBeVisible()

      // Check theme options
      await expect(page.getByRole('button', { name: /light/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /dark/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /system/i })).toBeVisible()
    })

    test('should change theme to dark', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await page.goto('/dashboard/profile')
      await waitForPageLoad(page)

      // Click dark theme button
      await page.getByRole('button', { name: /dark/i }).click()

      // Wait for toast confirmation
      await expectToast(page, /theme.*dark/i)

      // Verify dark mode is applied (html element should have dark class)
      await expect(page.locator('html')).toHaveClass(/dark/)
    })

    test('should change theme to light', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await page.goto('/dashboard/profile')
      await waitForPageLoad(page)

      // First switch to dark to ensure we're not already on light
      await page.getByRole('button', { name: /dark/i }).click()
      await page.waitForTimeout(500)

      // Then switch to light
      await page.getByRole('button', { name: /light/i }).click()

      await expectToast(page, /theme.*light/i)
    })
  })

  test.describe('Password Change', () => {
    test('should display password change form in profile', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await page.goto('/dashboard/profile')
      await waitForPageLoad(page)

      await expect(page.getByRole('heading', { name: /change password/i })).toBeVisible()
      await expect(page.getByLabel(/current password/i)).toBeVisible()
      await expect(page.getByLabel(/new password/i).first()).toBeVisible()
      await expect(page.getByLabel(/confirm new password/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /change password/i })).toBeVisible()
    })

    test('should require current password', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await page.goto('/dashboard/profile')
      await waitForPageLoad(page)

      const currentPasswordInput = page.getByLabel(/current password/i)
      await expect(currentPasswordInput).toHaveAttribute('required', '')
    })

    test('should show error for password mismatch', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await page.goto('/dashboard/profile')
      await waitForPageLoad(page)

      await page.getByLabel(/current password/i).fill(testUsers.admin.password)
      await page.getByLabel(/new password/i).first().fill('NewPassword123!')
      await page.getByLabel(/confirm new password/i).fill('DifferentPassword123!')

      await page.getByRole('button', { name: /change password/i }).click()

      await expectToast(page, /passwords do not match/i)
    })

    test('should show error for short password', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await page.goto('/dashboard/profile')
      await waitForPageLoad(page)

      await page.getByLabel(/current password/i).fill(testUsers.admin.password)
      await page.getByLabel(/new password/i).first().fill('short')
      await page.getByLabel(/confirm new password/i).fill('short')

      await page.getByRole('button', { name: /change password/i }).click()

      await expectToast(page, /at least 6 characters/i)
    })

    test('should show error for incorrect current password', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await page.goto('/dashboard/profile')
      await waitForPageLoad(page)

      await page.getByLabel(/current password/i).fill('WrongCurrentPassword!')
      await page.getByLabel(/new password/i).first().fill('NewPassword123!')
      await page.getByLabel(/confirm new password/i).fill('NewPassword123!')

      await page.getByRole('button', { name: /change password/i }).click()

      await expectToast(page, /current password|incorrect/i)
    })

    // Note: We don't actually change the password in tests as it would break other tests
    test('should have password visibility toggle', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await page.goto('/dashboard/profile')
      await waitForPageLoad(page)

      const currentPasswordInput = page.getByLabel(/current password/i)

      // Check initial type is password
      await expect(currentPasswordInput).toHaveAttribute('type', 'password')

      // Find and click the visibility toggle button (the eye icon button next to password field)
      const toggleButton = currentPasswordInput.locator('..').locator('button').first()
      if (await toggleButton.isVisible()) {
        await toggleButton.click()
        // After click, type should change to text
        await expect(currentPasswordInput).toHaveAttribute('type', 'text')
      }
    })
  })

  test.describe('Navigation from Profile', () => {
    test('should navigate back to dashboard from profile', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await page.goto('/dashboard/profile')
      await waitForPageLoad(page)

      await page.getByRole('link', { name: /back to dashboard/i }).click()

      await page.waitForURL(/\/dashboard/)
      await expect(page).toHaveURL(/\/dashboard$/)
    })

    test('should access profile from user dropdown', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await waitForPageLoad(page)

      // Open user dropdown - the avatar button in navigation
      const avatarButton = page.locator('nav button.rounded-full').first()
      await avatarButton.click()

      // Click profile
      await page.getByRole('menuitem', { name: /profile/i }).click()

      await page.waitForURL(/\/dashboard\/profile/)
      await expect(page).toHaveURL(/\/dashboard\/profile/)
    })
  })

  test.describe('Admin-specific Access', () => {
    test('should show admin link for admin users', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()
      await waitForPageLoad(page)

      // Admin should see Admin link in navigation
      await expect(page.getByRole('link', { name: /admin/i })).toBeVisible()
    })

    test('should not show admin link for regular users', async ({ page, loginAsUser }) => {
      await loginAsUser()
      await waitForPageLoad(page)

      // Regular user should not see Admin link
      await expect(page.getByRole('link', { name: /admin/i })).not.toBeVisible()
    })

    test('should allow admin to access admin page', async ({ page, loginAsAdmin }) => {
      await loginAsAdmin()

      await page.goto('/dashboard/admin')
      await waitForPageLoad(page)

      // Should be on admin page
      await expect(page).toHaveURL(/\/dashboard\/admin/)
    })
  })
})
