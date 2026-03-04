import { runLoadTest } from '@tressi/cli';
import {
  defaultTressiConfig,
  defaultTressiRequestConfig,
} from '@tressi/shared/common';

import { expect, test } from '../setup/fixtures';

test.describe('Per-endpoint RPS Configuration Tests', () => {
  test.describe('Accuracy validation', () => {
    test('should maintain reasonable accuracy for single endpoint', async ({
      testServer,
    }) => {
      const config = defaultTressiConfig;

      config.requests = [
        {
          ...defaultTressiRequestConfig,
          url: `${testServer}/success`,
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

    test('should maintain reasonable accuracy for multiple endpoints', async ({
      testServer,
    }) => {
      const config = defaultTressiConfig;

      config.requests = [
        {
          ...defaultTressiRequestConfig,
          url: `${testServer}/success`,
          rps: 30,
        },
        {
          ...defaultTressiRequestConfig,
          url: `${testServer}/delay/100`,
          rps: 20,
        },
        {
          ...defaultTressiRequestConfig,
          url: `${testServer}/payload/10`,
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
