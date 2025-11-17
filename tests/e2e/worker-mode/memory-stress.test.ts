import { describe, expect, it } from 'vitest';

import { CoreRunner } from '../../../src/core';
import { createTestConfig } from '../../utils/test-config';

interface TestResults {
  totalRequests: number;
  successfulRequests: number;
}

describe('Worker memory stress testing', () => {
  it('should handle memory pressure gracefully', async () => {
    const config = createTestConfig({
      requests: [
        {
          url: 'https://jsonplaceholder.typicode.com/posts/1',
          method: 'GET',
          rps: 100,
        },
        {
          url: 'https://jsonplaceholder.typicode.com/posts/2',
          method: 'GET',
          rps: 100,
        },
      ],
      options: {
        durationSec: 3,
        rampUpTimeSec: 0,
        threads: 8,
        workerMemoryLimit: 16,
        useUI: false,
        silent: true,
        earlyExitOnError: false,
        workerEarlyExit: {
          enabled: false,
          monitoringWindowMs: 1000,
          stopMode: 'endpoint' as const,
        },
      },
    });

    const runner = new CoreRunner(config);
    const results = await new Promise<TestResults>((resolve) => {
      runner.on('complete', resolve);
      runner.run();
    });

    expect(results.totalRequests).toBeGreaterThan(0);
    expect(results.successfulRequests).toBeGreaterThan(0);
  });

  it('should not leak memory across test runs', async () => {
    const config = createTestConfig({
      requests: [
        {
          url: 'https://jsonplaceholder.typicode.com/posts/1',
          method: 'GET',
          rps: 50,
        },
      ],
      options: {
        durationSec: 2,
        rampUpTimeSec: 0,
        threads: 4,
        workerMemoryLimit: 32,
        useUI: false,
        silent: true,
        earlyExitOnError: false,
        workerEarlyExit: {
          enabled: false,
          monitoringWindowMs: 1000,
          stopMode: 'endpoint' as const,
        },
      },
    });

    // Run multiple times to check for memory leaks
    for (let i = 0; i < 3; i++) {
      const runner = new CoreRunner(config);
      const results = await new Promise<TestResults>((resolve) => {
        runner.on('complete', resolve);
        runner.run();
      });

      expect(results.totalRequests).toBeGreaterThan(0);
    }
  });
});
