import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runLoadTest } from '../../src/index';
import type { TressiConfig } from '../../src/types';
import { ServerManager } from '../utils/server-manager';

describe('Memory Profile E2E Tests', () => {
  let serverManager: ServerManager;
  let baseUrl: string;

  beforeAll(async () => {
    serverManager = new ServerManager();
    baseUrl = await serverManager.start();
  });

  afterAll(async () => {
    await serverManager.stop();
  });

  describe('Memory usage analysis', () => {
    it(
      'should maintain stable memory usage with high endpoint count',
      { timeout: 60000 },
      async () => {
        const initialMemory = process.memoryUsage();

        const config: TressiConfig = {
          $schema:
            'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
          requests: Array.from({ length: 50 }, () => ({
            url: `${baseUrl}/success`,
            method: 'GET',
          })),
          options: {
            durationSec: 10,
            rampUpTimeSec: 0,
            useUI: false,
            silent: true,
            earlyExitOnError: false,
          },
        };

        const results = await runLoadTest(config);

        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

        // Memory increase should be reasonable for 50 endpoints
        expect(memoryIncreaseMB).toBeLessThan(75);
        expect(results.global.actualRps).toBeGreaterThanOrEqual(8);
        expect(results.global.actualRps).toBeLessThanOrEqual(15);
      },
    );

    it(
      'should handle high RPS without memory leaks',
      { timeout: 45000 },
      async () => {
        const initialMemory = process.memoryUsage();

        const config: TressiConfig = {
          $schema:
            'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
          requests: [],
          options: {
            durationSec: 10,
            rampUpTimeSec: 0,
            useUI: false,
            silent: true,
            earlyExitOnError: false,
          },
        };

        const results = await runLoadTest(config);

        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

        // Memory increase should be reasonable for moderate RPS
        expect(memoryIncreaseMB).toBeLessThan(50);
        expect(results.global.actualRps).toBeGreaterThanOrEqual(30);
        expect(results.global.actualRps).toBeLessThanOrEqual(45);
      },
    );

    it(
      'should maintain memory efficiency over extended periods',
      { timeout: 60000 },
      async () => {
        const initialMemory = process.memoryUsage();

        const config: TressiConfig = {
          $schema:
            'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
          requests: [],
          options: {
            durationSec: 20,
            rampUpTimeSec: 0,
            useUI: false,
            silent: true,
            earlyExitOnError: false,
          },
        };

        const results = await runLoadTest(config);

        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

        // Memory increase should be minimal over 20 seconds
        expect(memoryIncreaseMB).toBeLessThan(40);
        expect(results.global.actualRps).toBeGreaterThanOrEqual(20);
        expect(results.global.actualRps).toBeLessThanOrEqual(30);
        expect(results.global.totalRequests).toBeGreaterThan(400);
      },
    );
  });

  describe('Garbage collection efficiency', () => {
    it(
      'should not accumulate excessive garbage',
      { timeout: 45000 },
      async () => {
        const initialMemory = process.memoryUsage();

        // Run multiple short tests to check for accumulation
        for (let i = 0; i < 3; i++) {
          const config: TressiConfig = {
            $schema:
              'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
            requests: [],
            options: {
              durationSec: 3,
              rampUpTimeSec: 0,
              useUI: false,
              silent: true,
              earlyExitOnError: false,
            },
          };

          await runLoadTest(config);

          // Allow time for garbage collection between runs
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }

        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

        // Memory should not accumulate significantly across runs
        expect(memoryIncreaseMB).toBeLessThan(35);
      },
    );
  });
});
