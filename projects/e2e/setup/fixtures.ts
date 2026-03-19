/** biome-ignore-all lint/correctness/noEmptyPattern: {}: object */
import {
  test as base,
  type Page,
  type PlaywrightTestArgs,
  type PlaywrightTestOptions,
  type PlaywrightWorkerArgs,
  type PlaywrightWorkerOptions,
  type TestType,
} from '@playwright/test';

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

export const test: TestType<
  PlaywrightTestArgs & PlaywrightTestOptions & PageFixtures,
  PlaywrightWorkerArgs & PlaywrightWorkerOptions & WorkerFixtures
> = base.extend<PageFixtures, WorkerFixtures>({
  baseURL: async (
    { cliServer }: { cliServer: string },
    use: (r: string | undefined) => Promise<void>,
  ) => {
    await use(cliServer);
  },

  cliServer: [
    async ({}: object, use: (r: string) => Promise<void>): Promise<void> => {
      const manager = new CliServerManager();
      const baseURL = await manager.start();
      await use(baseURL);
      await manager.stop();
    },
    { scope: 'worker' },
  ],

  configsPage: async ({ page }: { page: Page }, use: (r: ConfigsPage) => Promise<void>) => {
    page.on('console', (msg) => {
      // biome-ignore lint/suspicious/noConsole: default
      console.log(`BROWSER CONSOLE [${msg.type()}]: ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      // biome-ignore lint/suspicious/noConsole: default
      console.log(`BROWSER PAGE ERROR: ${err.message}`);
    });
    await use(new ConfigsPage(page));
  },

  dashboardPage: async ({ page }: { page: Page }, use: (r: DashboardPage) => Promise<void>) => {
    page.on('console', (msg) => {
      // biome-ignore lint/suspicious/noConsole: default
      console.log(`BROWSER CONSOLE [${msg.type()}]: ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      // biome-ignore lint/suspicious/noConsole: default
      console.log(`BROWSER PAGE ERROR: ${err.message}`);
    });
    await use(new DashboardPage(page));
  },

  testDetailPage: async ({ page }: { page: Page }, use: (r: TestDetailPage) => Promise<void>) => {
    page.on('console', (msg) => {
      // biome-ignore lint/suspicious/noConsole: default
      console.log(`BROWSER CONSOLE [${msg.type()}]: ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      // biome-ignore lint/suspicious/noConsole: default
      console.log(`BROWSER PAGE ERROR: ${err.message}`);
    });
    await use(new TestDetailPage(page));
  },

  testServer: [
    async ({}: object, use: (r: string) => Promise<void>): Promise<void> => {
      const manager = new TestServerManager();
      const baseURL = await manager.start();
      await use(baseURL);
      await manager.stop();
    },
    { scope: 'worker' },
  ],
});

export { expect } from '@playwright/test';
