import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for testing against running Docker instance
 * Does NOT start a dev server or seed data - uses existing Docker instance
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'docker-instance.spec.ts',
  fullyParallel: false, // Run tests sequentially to avoid conflicts
  retries: 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60000,
  expect: {
    timeout: 15000,
  },
  use: {
    baseURL: 'http://localhost:7787',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No webServer - we're testing against existing Docker instance
})
