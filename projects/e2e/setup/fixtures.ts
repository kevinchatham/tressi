import { test as base } from '@playwright/test';

import { ConfigsPage } from '../pages/configs.page';
import { DashboardPage } from '../pages/dashboard.page';
import { TestDetailPage } from '../pages/test-details.page';
import { CliServerManager } from './cli-server-manager';
import { TestServerManager } from './test-server-manager';

type WorkerFixtures = {
  cliServer: string;
  testServer: string;
};

type PageFixtures = {
  configsPage: ConfigsPage;
  dashboardPage: DashboardPage;
  testDetailPage: TestDetailPage;
};

export const test = base.extend<PageFixtures, WorkerFixtures>({
  baseURL: async ({ cliServer }, use) => {
    await use(cliServer);
  },

  cliServer: [
    async ({}, use): Promise<void> => {
      const manager = new CliServerManager();
      const baseURL = await manager.start();
      await use(baseURL);
      await manager.stop();
    },
    { scope: 'worker' },
  ],

  testServer: [
    async ({}, use): Promise<void> => {
      const manager = new TestServerManager();
      const baseURL = await manager.start();
      await use(baseURL);
      await manager.stop();
    },
    { scope: 'worker' },
  ],

  configsPage: async ({ page }, use) => {
    page.on('console', (msg) => {
      // eslint-disable-next-line no-console
      console.log(`BROWSER CONSOLE [${msg.type()}]: ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      // eslint-disable-next-line no-console
      console.log(`BROWSER PAGE ERROR: ${err.message}`);
    });
    await use(new ConfigsPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    page.on('console', (msg) => {
      // eslint-disable-next-line no-console
      console.log(`BROWSER CONSOLE [${msg.type()}]: ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      // eslint-disable-next-line no-console
      console.log(`BROWSER PAGE ERROR: ${err.message}`);
    });
    await use(new DashboardPage(page));
  },

  testDetailPage: async ({ page }, use) => {
    page.on('console', (msg) => {
      // eslint-disable-next-line no-console
      console.log(`BROWSER CONSOLE [${msg.type()}]: ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      // eslint-disable-next-line no-console
      console.log(`BROWSER PAGE ERROR: ${err.message}`);
    });
    await use(new TestDetailPage(page));
  },
});

export { expect } from '@playwright/test';
