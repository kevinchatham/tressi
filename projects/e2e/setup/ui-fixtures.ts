import { test as base } from '@playwright/test';

import { CliServerManager } from './cli-server-manager';

type WorkerFixtures = {
  cliServer: string;
};

export const test = base.extend<object, WorkerFixtures>({
  cliServer: [
    async ({}, use): Promise<void> => {
      const manager = new CliServerManager();
      const baseURL = await manager.start();
      await use(baseURL);
      await manager.stop();
    },
    { scope: 'worker' },
  ],
});

export { expect } from '@playwright/test';
