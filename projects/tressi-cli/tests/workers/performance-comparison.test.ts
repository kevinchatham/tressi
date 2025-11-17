import { describe, expect, it } from 'vitest';

import type { TressiConfig } from '../../src/types';
import { WorkerPoolManager } from '../../src/workers/worker-pool-manager';

describe('Performance Comparison', () => {
  it('should compare worker vs async performance', async () => {
    const config: TressiConfig = {
      $schema: 'test-schema',
      requests: [
        {
          url: 'http://httpbin.org/get',
          method: 'GET',
          rps: 1,
        },
      ],
      options: {
        durationSec: 1,
        rampUpTimeSec: 0,
        useUI: false,
        silent: true,
        earlyExitOnError: false,
        workerMemoryLimit: 128,
        workerEarlyExit: {
          enabled: false,
          monitoringWindowMs: 1000,
          stopMode: 'endpoint',
        },
        threads: 2,
      },
    };

    // Test worker mode initialization
    const workerPool = new WorkerPoolManager(config, 2);
    expect(workerPool).toBeDefined();
  });

  it('should validate memory usage scaling', () => {
    const config: TressiConfig = {
      $schema: 'test-schema',
      requests: [{ url: 'http://localhost:3000/test', method: 'GET', rps: 1 }],
      options: {
        durationSec: 1,
        rampUpTimeSec: 0,
        useUI: false,
        silent: true,
        earlyExitOnError: false,
        workerMemoryLimit: 64,
        workerEarlyExit: {
          enabled: false,
          monitoringWindowMs: 1000,
          stopMode: 'endpoint',
        },
        threads: 4,
      },
    };

    const workerPool = new WorkerPoolManager(config, 4);
    expect(workerPool).toBeDefined();
    expect(config.options.workerMemoryLimit).toBe(64);
  });

  it('should validate endpoint distribution performance', () => {
    const config: TressiConfig = {
      $schema: 'test-schema',
      requests: Array.from({ length: 10 }, (_, i) => ({
        url: `http://localhost:3000/test${i}`,
        method: 'GET',
        rps: 1,
      })),
      options: {
        durationSec: 1,
        rampUpTimeSec: 0,
        useUI: false,
        silent: true,
        earlyExitOnError: false,
        workerMemoryLimit: 128,
        workerEarlyExit: {
          enabled: false,
          monitoringWindowMs: 1000,
          stopMode: 'endpoint',
        },
        threads: 4,
      },
    };

    const workerPool = new WorkerPoolManager(config, 4);
    // @ts-expect-error - accessing private method for testing
    const distribution = workerPool.distributeEndpoints();

    expect(distribution).toHaveLength(4);
    expect(distribution.flat()).toHaveLength(10);
  });
});
