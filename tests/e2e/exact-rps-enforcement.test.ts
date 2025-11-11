import { beforeEach, describe, expect, it } from 'vitest';

import { CoreRunner } from '../../src/core/core-runner';
import type { RequestResult, TressiConfig } from '../../src/types';

describe('Exact RPS Enforcement', () => {
  let config: TressiConfig;

  beforeEach(() => {
    config = {
      $schema: 'https://example.com/schema.json',
      options: {
        durationSec: 5,
        useUI: false,
        silent: true,
        adaptiveConcurrency: {
          maxConcurrency: 10,
          targetLatency: 100,
          memoryThreshold: 0.8,
          enabled: true,
          minConcurrency: 1,
        },
      },
      requests: [],
    };
  });

  describe('single endpoint', () => {
    it('should enforce exact RPS for single endpoint', async () => {
      const singleEndpointConfig: TressiConfig = {
        ...config,
        requests: [],
        options: { ...config.options, durationSec: 3 },
      };

      const runner = new CoreRunner(singleEndpointConfig);
      const results: RequestResult[] = [];

      runner.on('result', (result: RequestResult) => {
        results.push(result);
      });

      await runner.run();

      // Should be exactly 6 requests (2 RPS * 3 seconds)
      expect(results).toHaveLength(6);
    });
  });

  describe('multiple endpoints', () => {
    it('should enforce exact RPS for multiple endpoints', async () => {
      const multiEndpointConfig: TressiConfig = {
        ...config,
        requests: [],
        options: { ...config.options, durationSec: 2 },
      };

      const runner = new CoreRunner(multiEndpointConfig);
      const results: RequestResult[] = [];

      runner.on('result', (result: RequestResult) => {
        results.push(result);
      });

      await runner.run();

      // Should be exactly 6 requests (1+2 RPS * 2 seconds)
      expect(results).toHaveLength(6);
    });
  });

  describe('edge cases', () => {
    it('should handle very low RPS', async () => {
      const lowRpsConfig: TressiConfig = {
        ...config,
        requests: [],
        options: { ...config.options, durationSec: 4 },
      };

      const runner = new CoreRunner(lowRpsConfig);
      const results: RequestResult[] = [];

      runner.on('result', (result: RequestResult) => {
        results.push(result);
      });

      await runner.run();

      // Should be exactly 2 requests (0.5 RPS * 4 seconds)
      expect(results).toHaveLength(2);
    });

    it('should handle high RPS', async () => {
      const highRpsConfig: TressiConfig = {
        ...config,
        requests: [],
        options: { ...config.options, durationSec: 1 },
      };

      const runner = new CoreRunner(highRpsConfig);
      const results: RequestResult[] = [];

      runner.on('result', (result: RequestResult) => {
        results.push(result);
      });

      await runner.run();

      // Should be exactly 20 requests (20 RPS * 1 second)
      expect(results).toHaveLength(20);
    });
  });

  describe('adaptive concurrency', () => {
    it('should adapt concurrency based on system load', async () => {
      const adaptiveConfig: TressiConfig = {
        ...config,
        requests: [],
        options: {
          ...config.options,
          durationSec: 2,
          adaptiveConcurrency: {
            maxConcurrency: 5,
            targetLatency: 50,
            memoryThreshold: 0.9,
            enabled: true,
            minConcurrency: 1,
          },
        },
      };

      const runner = new CoreRunner(adaptiveConfig);
      const results: RequestResult[] = [];

      runner.on('result', (result: RequestResult) => {
        results.push(result);
      });

      await runner.run();

      // Should complete successfully with adaptive concurrency
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(40); // 20 RPS * 2 seconds max
    });
  });
});
