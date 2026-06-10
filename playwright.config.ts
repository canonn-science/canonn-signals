import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a locally served production-like build of the app.
 * See https://playwright.dev/docs/test-configuration.
 */
const PORT = 4200;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // Run tests in files in parallel.
  fullyParallel: true,
  // Fail the build on CI if test.only was left in the source.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Opt out of parallel workers on CI for stability.
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  // Start the Angular dev server before running the tests.
  webServer: {
    command: 'pnpm start --port ' + PORT,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    // The Angular build can take a while to come up on a cold start.
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
