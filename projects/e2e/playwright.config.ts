import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Run tests in files in parallel */
  fullyParallel: false,

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'setup',
      testDir: './',
      testMatch: /global-setup\.ts/,
    },
    {
      dependencies: ['setup'],
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { open: 'never', outputFolder: 'test-results' }],
    ['json', { outputFile: 'test-results/test-results.json' }],
    ['line'],
  ],
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  testDir: './tests',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /* Opt out of parallel tests on CI. */
  workers: 1,
});
