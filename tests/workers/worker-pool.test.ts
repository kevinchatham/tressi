import { afterEach, describe, expect, it } from 'vitest';

import type { TressiRequestConfig } from '../../src/types';
import { WorkerPoolManager } from '../../src/workers/worker-pool-manager';
import { createTestConfig } from '../utils/test-config';

describe('WorkerPoolManager', () => {
  let workerPool: WorkerPoolManager;
  const mockConfig = createTestConfig({
    requests: [
      { url: 'http://localhost:3000/test1', method: 'GET', rps: 1 },
      { url: 'http://localhost:3000/test2', method: 'POST', rps: 1 },
    ],
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
  });

  afterEach(async () => {
    if (workerPool) {
      await workerPool.stop();
    }
  });

  it('should create worker pool with correct number of workers', () => {
    workerPool = new WorkerPoolManager(mockConfig, 2);
    expect(workerPool).toBeDefined();
  });

  it('should distribute endpoints evenly among workers', () => {
    workerPool = new WorkerPoolManager(mockConfig, 2);
    const distribution = (
      workerPool as unknown as {
        distributeEndpoints: () => TressiRequestConfig[][];
      }
    ).distributeEndpoints();

    expect(distribution).toHaveLength(2);
    expect(distribution[0]).toHaveLength(1);
    expect(distribution[1]).toHaveLength(1);
  });

  it('should handle single worker configuration', () => {
    workerPool = new WorkerPoolManager(mockConfig, 1);
    const distribution = (
      workerPool as unknown as {
        distributeEndpoints: () => TressiRequestConfig[][];
      }
    ).distributeEndpoints();

    expect(distribution).toHaveLength(1);
    expect(distribution[0]).toHaveLength(2);
  });
});
