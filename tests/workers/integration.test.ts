import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { TressiConfig } from '../../src/types';
import { WorkerPoolManager } from '../../src/workers/worker-pool-manager';

describe('Worker Integration Tests', () => {
  let workerPool: WorkerPoolManager;
  let mockConfig: TressiConfig;

  beforeEach(() => {
    mockConfig = {
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
      },
    };
  });

  afterEach(async () => {
    if (workerPool) {
      await workerPool.stop();
    }
  });

  it('should initialize worker pool without errors', () => {
    workerPool = new WorkerPoolManager(mockConfig, 1);
    expect(workerPool).toBeDefined();
  });

  it('should provide aggregated results structure', async () => {
    workerPool = new WorkerPoolManager(mockConfig, 1);
    const results = workerPool.getAggregatedResults();

    expect(results).toHaveProperty('totalRequests');
    expect(results).toHaveProperty('successfulRequests');
    expect(results).toHaveProperty('failedRequests');
    expect(results).toHaveProperty('errorRate');
    expect(results).toHaveProperty('averageLatency');
  });
});
