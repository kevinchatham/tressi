import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runLoadTest } from '../../src/index';
import type { TressiConfig } from '../../src/types';
import { ServerManager } from '../utils/server-manager';

describe('Rate Limiting Performance Benchmarks E2E Tests', () => {
  let serverManager: ServerManager;
  let baseUrl: string;

  beforeAll(async () => {
    serverManager = new ServerManager();
    baseUrl = await serverManager.start();
  });

  afterAll(async () => {
    await serverManager.stop();
  });

  describe('High-concurrency scenarios', () => {
    it('should handle 10 endpoints @ 100 RPS each', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: Array.from({ length: 10 }, () => ({
          url: `${baseUrl}/success`,
          method: 'GET',
        })),
        options: {
          durationSec: 30,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
        },
      };

      const results = await runLoadTest(config);

      // Expected: 10 * 100 = 1000 RPS
      expect(results.global.actualRps).toBeGreaterThanOrEqual(950);
      expect(results.global.actualRps).toBeLessThanOrEqual(1050);
      expect(results.global.totalRequests).toBeGreaterThan(29000);
    });

    it('should handle 100 endpoints @ 10 RPS each', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: Array.from({ length: 100 }, () => ({
          url: `${baseUrl}/success`,
          method: 'GET',
        })),
        options: {
          durationSec: 20,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
        },
      };

      const results = await runLoadTest(config);

      // Expected: 100 * 10 = 1000 RPS
      expect(results.global.actualRps).toBeGreaterThanOrEqual(950);
      expect(results.global.actualRps).toBeLessThanOrEqual(1050);
      expect(results.global.totalRequests).toBeGreaterThan(19000);
    });

    it('should handle mixed endpoint configurations', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [],
        options: {
          durationSec: 15,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
        },
      };

      const results = await runLoadTest(config);

      // Expected: 50+30+20+40+25 = 165 RPS
      expect(results.global.actualRps).toBeGreaterThanOrEqual(160);
      expect(results.global.actualRps).toBeLessThanOrEqual(170);
    });
  });

  describe('Long-running stability', () => {
    it('should maintain performance over 1M+ requests', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [],
        options: {
          durationSec: 60,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
        },
      };

      const results = await runLoadTest(config);

      // Expected: 200+150+100 = 450 RPS
      expect(results.global.actualRps).toBeGreaterThanOrEqual(440);
      expect(results.global.actualRps).toBeLessThanOrEqual(460);
      expect(results.global.totalRequests).toBeGreaterThan(26000);
    });
  });

  describe('Memory efficiency', () => {
    it('should maintain low memory overhead', async () => {
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

      const startMemory = process.memoryUsage();
      const results = await runLoadTest(config);
      const endMemory = process.memoryUsage();

      const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      // Memory increase should be minimal (< 50MB for this test)
      expect(memoryIncreaseMB).toBeLessThan(50);
      expect(results.global.actualRps).toBeGreaterThanOrEqual(245);
      expect(results.global.actualRps).toBeLessThanOrEqual(255);
    });
  });
});
