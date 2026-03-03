import { expect, test } from '@playwright/test';
import { runLoadTest } from '@tressi/cli';
import {
  defaultTressiConfig,
  defaultTressiRequestConfig,
} from '@tressi/shared/common';

import { TestServerManager } from '../setup/test-server-manager';

test.describe('Per-endpoint RPS Configuration Tests', () => {
  let serverManager: TestServerManager;
  let baseUrl: string;

  test.beforeAll(async () => {
    serverManager = new TestServerManager();
    baseUrl = await serverManager.start();
  });

  test.afterAll(async () => {
    await serverManager.stop();
  });

  test.describe('Accuracy validation', () => {
    test('should maintain reasonable accuracy for single endpoint', async () => {
      const config = defaultTressiConfig;

      config.requests = [
        {
          ...defaultTressiRequestConfig,
          url: `${baseUrl}/success`,
          rps: 75,
        },
      ];

      const expectedTotal = config.requests.reduce(
        (sum, request) => sum + request.rps,
        0,
      );

      const results = await runLoadTest(config);

      const peakRps = results.summary.global.peakRequestsPerSecond;
      const tolerance = expectedTotal * 0.1;
      expect(peakRps).toBeGreaterThanOrEqual(expectedTotal - tolerance);
      expect(peakRps).toBeLessThanOrEqual(expectedTotal + tolerance);
    });

    test('should maintain reasonable accuracy for multiple endpoints', async () => {
      const config = defaultTressiConfig;

      config.requests = [
        { ...defaultTressiRequestConfig, url: `${baseUrl}/success`, rps: 30 },
        { ...defaultTressiRequestConfig, url: `${baseUrl}/delay/100`, rps: 20 },
        {
          ...defaultTressiRequestConfig,
          url: `${baseUrl}/payload/10`,
          rps: 10,
        },
      ];

      const expectedTotal = config.requests.reduce(
        (sum, request) => sum + request.rps,
        0,
      );

      const results = await runLoadTest(config);

      const peakRps = results.summary.global.peakRequestsPerSecond;
      const tolerance = expectedTotal * 0.1;
      expect(peakRps).toBeGreaterThanOrEqual(expectedTotal - tolerance);
      expect(peakRps).toBeLessThanOrEqual(expectedTotal + tolerance);
    });
  });
});
