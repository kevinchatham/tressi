import { test } from '../setup/fixtures';

test.describe('Full-Stack Journey', () => {
  test('should create a config, start a test, and see real-time updates', async ({
    cliServer,
    configsPage,
    dashboardPage,
    testDetailPage,
  }) => {
    // eslint-disable-next-line no-console
    console.log(`Using CLI server at ${cliServer}`);

    // 1. Open Configs Page (goto handles synchronization)
    await configsPage.goto();

    await configsPage.waitForLoaded();

    // 2. Create a new configuration
    await configsPage.createConfig(
      'E2E UI Test Config',
      '10',
      `${cliServer}/api/health`,
    );

    // 3. Verify config card exists and click "Use"
    await configsPage.useConfig('E2E UI Test Config');

    // 4. Trigger test run from Dashboard
    await dashboardPage.waitForLoaded();
    await dashboardPage.startTest();

    // 4.5 Navigate to the test details (the app doesn't auto-navigate)
    await dashboardPage.viewLatestTest();

    // 5. Verify UI updates on Test Detail page
    await testDetailPage.waitForLoaded();
    await testDetailPage.verifyTestIsRunning();

    // 6. Wait for test to complete
    await testDetailPage.waitForCompletion({ timeout: 30000 });
  });
});
