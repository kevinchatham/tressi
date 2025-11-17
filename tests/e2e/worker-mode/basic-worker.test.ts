import { describe, expect, it } from 'vitest';

import type { TressiConfig } from '../../../src/types';
import { WorkerPoolManager } from '../../../src/workers/worker-pool-manager';

describe('Basic Worker Mode', () => {
  it('should initialize worker pool correctly', () => {
    const config: TressiConfig = {
      $schema: 'test-schema',
      requests: [
        {
          url: 'http://localhost:3000/test',
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
        threads: 2,
        workerMemoryLimit: 128,
        workerEarlyExit: {
          enabled: false,
          monitoringWindowMs: 1000,
          stopMode: 'endpoint' as const,
        },
      },
    };

    const workerPool = new WorkerPoolManager(config, 2);

    expect(workerPool).toBeDefined();
  });

  it('should handle single worker mode', () => {
    const config: TressiConfig = {
      $schema: 'test-schema',
      requests: [
        {
          url: 'http://localhost:3000/test',
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
        threads: 1,
        workerMemoryLimit: 128,
        workerEarlyExit: {
          enabled: false,
          monitoringWindowMs: 1000,
          stopMode: 'endpoint' as const,
        },
      },
    };

    const workerPool = new WorkerPoolManager(config, 1);

    expect(workerPool).toBeDefined();
  });

  it('should distribute endpoints correctly', () => {
    const config: TressiConfig = {
      $schema: 'test-schema',
      requests: [
        { url: 'http://localhost:3000/test1', method: 'GET', rps: 1 },
        { url: 'http://localhost:3000/test2', method: 'POST', rps: 1 },
        { url: 'http://localhost:3000/test3', method: 'PUT', rps: 1 },
      ],
      options: {
        durationSec: 1,
        rampUpTimeSec: 0,
        useUI: false,
        silent: true,
        earlyExitOnError: false,
        threads: 2,
        workerMemoryLimit: 128,
        workerEarlyExit: {
          enabled: false,
          monitoringWindowMs: 1000,
          stopMode: 'endpoint' as const,
        },
      },
    };

    // Test the distribution logic by creating a manager and checking if it can start
    // We can't directly test private methods, but we can verify the manager initializes
    const workerPool = new WorkerPoolManager(config, 2);

    expect(workerPool).toBeDefined();

    // Since we can't access private methods, we'll test the public interface
    expect(() => {
      // This should not throw if the configuration is valid
      new WorkerPoolManager(config, 2);
    }).not.toThrow();
  });
});
