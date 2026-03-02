import { expect, test } from '@playwright/test';

test.describe('Full-Stack Journey', () => {
  test('should create a config, start a test, and see real-time updates', async ({
    page,
  }) => {
    // 1. Open Dashboard (which redirects to configs if none exist, or we can go to /configs)
    await page.goto('/configs');

    // 2. Create a new configuration
    await page.getByRole('button', { name: 'Create' }).first().click();

    await page.getByLabel('Name').fill('E2E UI Test Config');
    await page.getByLabel('Duration (seconds)').fill('5');

    // Add an endpoint
    await page.getByRole('button', { name: 'Add Endpoint' }).click();
    await page
      .locator('input[placeholder="https://api.example.com/data"]')
      .fill('http://localhost:3108/api/health');

    await page.getByRole('button', { name: 'Save' }).click();

    // 3. Verify config card exists and click "Use"
    const configCard = page.locator('app-configuration-card', {
      hasText: 'E2E UI Test Config',
    });
    await expect(configCard).toBeVisible();
    await configCard.getByRole('button', { name: 'Use' }).click();

    // 4. Trigger test run
    await expect(page).toHaveURL(/\/dashboard\/.+/);
    await page.getByRole('button', { name: 'Start' }).click();

    // 5. Verify UI updates (should navigate to test detail)
    await expect(page).toHaveURL(/\/test\/.+/);

    // Check for status badge showing "running" or "completed"
    await expect(page.locator('app-status-badge')).toBeVisible();

    // Check for charts
    await expect(page.locator('app-performance-over-time')).toBeVisible();

    // Wait for test to complete (duration was 5s)
    await expect(page.locator('app-status-badge')).toContainText('completed', {
      timeout: 15000,
    });
  });
});
