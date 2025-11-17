import { describe, expect, it } from 'vitest';

import { CoreRunner } from '../../../src/core';
import { createTestConfig } from '../../utils/test-config';

interface TestResults {
  totalRequests: number;
  successfulRequests: number;
}

describe('Worker performance benchmarks', () => {
  it('should achieve accurate RPS with worker threads', async () => {
    const config = createTestConfig({
      requests: [
        {
          url: 'https://jsonplaceholder.typicode.com/posts/1',
          method: 'GET',
          rps: 10,
        },
        {
          url: 'https://jsonplaceholder.typicode.com/posts/2',
          method: 'GET',
          rps: 15,
        },
      ],
      options: {
        durationSec: 5,
        rampUpTimeSec: 0,
        threads: 4,
        useUI: false,
        silent: true,
        earlyExitOnError: false,
        workerMemoryLimit: 128,
        workerEarlyExit: {
          enabled: false,
          monitoringWindowMs: 1000,
          stopMode: 'endpoint' as const,
        },
      },
    });

    const runner = new CoreRunner(config);
    const startTime = Date.now();
    const results = await new Promise<TestResults>((resolve) => {
      runner.on('complete', resolve);
      runner.run();
    });
    const endTime = Date.now();

    const expectedTotalRps = 25; // 10 + 15
    const actualDuration = (endTime - startTime) / 1000;
    const actualRps = results.totalRequests / actualDuration;

    // Should be within 5% of expected RPS
    const variance = Math.abs(actualRps - expectedTotalRps) / expectedTotalRps;
    expect(variance).toBeLessThan(0.05);
  });

  it('should scale linearly with worker count', async () => {
    const singleWorkerConfig = createTestConfig({
      requests: [
        {
          url: 'https://jsonplaceholder.typicode.com/posts/1',
          method: 'GET',
          rps: 50,
        },
      ],
      options: {
        durationSec: 3,
        rampUpTimeSec: 0,
        threads: 1,
        useUI: false,
        silent: true,
        earlyExitOnError: false,
        workerMemoryLimit: 128,
        workerEarlyExit: {
          enabled: false,
          monitoringWindowMs: 1000,
          stopMode: 'endpoint' as const,
        },
      },
    });

    const multiWorkerConfig = createTestConfig({
      requests: [
        {
          url: 'https://jsonplaceholder.typicode.com/posts/1',
          method: 'GET',
          rps: 50,
        },
      ],
      options: {
        durationSec: 3,
        rampUpTimeSec: 0,
        threads: 4,
        useUI: false,
        silent: true,
        earlyExitOnError: false,
        workerMemoryLimit: 128,
        workerEarlyExit: {
          enabled: false,
          monitoringWindowMs: 1000,
          stopMode: 'endpoint' as const,
        },
      },
    });

    const singleWorkerRunner = new CoreRunner(singleWorkerConfig);
    const singleResults = await new Promise<TestResults>((resolve) => {
      singleWorkerRunner.on('complete', resolve);
      singleWorkerRunner.run();
    });

    const multiWorkerRunner = new CoreRunner(multiWorkerConfig);
    const multiResults = await new Promise<TestResults>((resolve) => {
      multiWorkerRunner.on('complete', resolve);
      multiWorkerRunner.run();
    });

    // Multi-worker should handle more requests in same time
    expect(multiResults.totalRequests).toBeGreaterThan(
      singleResults.totalRequests,
    );
  });
});
