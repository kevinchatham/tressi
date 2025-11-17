import { beforeEach, describe, expect, it } from 'vitest';

import type { TressiRequestConfig } from '../../src/types';
import { WorkerRateLimiter } from '../../src/workers/worker-rate-limiter';

interface WorkerRateLimiterWithInternals {
  getEndpointIndex: (request: TressiRequestConfig) => number;
  requestCounts: number[];
  reset: () => void;
}

describe('WorkerRateLimiter', () => {
  let rateLimiter: WorkerRateLimiter;
  let mockEndpoints: TressiRequestConfig[];

  beforeEach(() => {
    mockEndpoints = [
      { url: 'http://localhost:3000/test1', method: 'GET', rps: 2 },
      { url: 'http://localhost:3000/test2', method: 'POST', rps: 1 },
    ];
    rateLimiter = new WorkerRateLimiter(mockEndpoints);
  });

  it('should initialize with endpoints', () => {
    expect(rateLimiter).toBeDefined();
  });

  it('should return correct endpoint index', () => {
    const endpoint = mockEndpoints[0];
    const index = (
      rateLimiter as unknown as WorkerRateLimiterWithInternals
    ).getEndpointIndex(endpoint);
    expect(index).toBe(0);
  });

  it('should reset counters', () => {
    (
      rateLimiter as unknown as WorkerRateLimiterWithInternals
    ).requestCounts[0] = 5;
    (rateLimiter as unknown as WorkerRateLimiterWithInternals).reset();
    expect(
      (rateLimiter as unknown as WorkerRateLimiterWithInternals)
        .requestCounts[0],
    ).toBe(0);
  });
});
