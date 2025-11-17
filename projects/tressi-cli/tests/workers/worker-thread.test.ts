import { beforeEach, describe, expect, it } from 'vitest';

import type { TressiRequestConfig } from '../../src/types';
import { SharedMemoryManager } from '../../src/workers/shared-memory-manager';
import { WorkerRateLimiter } from '../../src/workers/worker-rate-limiter';

describe('WorkerThread', () => {
  let sharedMemory: SharedMemoryManager;
  let rateLimiter: WorkerRateLimiter;
  let endpoints: TressiRequestConfig[];

  beforeEach(() => {
    sharedMemory = new SharedMemoryManager(1, 1);
    endpoints = [{ url: 'http://localhost:3000/test', method: 'GET', rps: 1 }];
    rateLimiter = new WorkerRateLimiter(endpoints);
  });

  it('should initialize with correct worker data', () => {
    expect(sharedMemory).toBeDefined();
    expect(rateLimiter).toBeDefined();
    expect(endpoints).toHaveLength(1);
  });

  it('should get endpoint index correctly', () => {
    const endpoint = endpoints[0];
    const index = endpoints.findIndex((e) => e.url === endpoint.url);
    expect(index).toBe(0);
  });

  it('should handle rate limiting', async () => {
    const nextRequest = rateLimiter.getNextRequest();
    expect(nextRequest).toBeDefined();
  });

  it('should record results in shared memory', () => {
    sharedMemory.recordResult(0, {
      success: true,
      latency: 100,
      endpointIndex: 0,
    });

    const stats = sharedMemory.getGlobalStats();
    expect(stats.totalRequests).toBe(1);
    expect(stats.successfulRequests).toBe(1);
  });

  it('should handle errors gracefully', () => {
    sharedMemory.recordError(0, 0);

    const stats = sharedMemory.getGlobalStats();
    expect(stats.totalRequests).toBe(1);
    expect(stats.failedRequests).toBe(1);
  });
});
