import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a locally served production-like build of the app.
 * See https://playwright.dev/docs/test-configuration.
 */
const PORT = 4200;
const baseURL = `http://localhost:${PORT}`;

/**
 * Viewport sizes exercised by the suite. Each is paired with both Chromium and
 * Firefox so layout regressions are caught across rendering engines as well as
 * form factors. Plain viewport sizes (rather than `devices['Pixel 5']` etc.) are
 * used so the same dimensions apply to Firefox, which doesn't support Chromium's
 * mobile-emulation (`isMobile`/`hasTouch`) flags.
 */
export const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
} as const;

export type ViewportName = keyof typeof VIEWPORTS;

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
    screenshot: 'only-on-failure',
    // Pin the timezone so date renders (e.g. the "Next apoapsis" tooltip, which uses
    // Angular's `date` pipe in local time) are deterministic across machines.
    timezoneId: 'UTC',
  },

  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: VIEWPORTS.desktop },
    },
    {
      name: 'tablet-chromium',
      use: { ...devices['Desktop Chrome'], viewport: VIEWPORTS.tablet },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Desktop Chrome'], viewport: VIEWPORTS.mobile },
    },
    {
      name: 'desktop-firefox',
      use: { ...devices['Desktop Firefox'], viewport: VIEWPORTS.desktop },
    },
    {
      name: 'tablet-firefox',
      use: { ...devices['Desktop Firefox'], viewport: VIEWPORTS.tablet },
    },
    {
      name: 'mobile-firefox',
      use: { ...devices['Desktop Firefox'], viewport: VIEWPORTS.mobile },
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
