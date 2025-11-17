import { describe, expect, it } from 'vitest';

import { CoreRunner } from '../../../src/core';
import { ServerManager } from '../../utils/server-manager';
import { createTestConfig } from '../../utils/test-config';

interface TestResults {
  totalRequests: number;
  successfulRequests: number;
}

describe('Multi-worker coordination', () => {
  it('should coordinate multiple workers effectively', async () => {
    const server = new ServerManager();
    const serverUrl = await server.start();
    const config = createTestConfig({
      requests: [
        { url: `${serverUrl}/api/test1`, method: 'GET', rps: 10 },
        { url: `${serverUrl}/api/test2`, method: 'GET', rps: 5 },
      ],
      options: {
        durationSec: 2,
        rampUpTimeSec: 0,
        threads: 2,
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
    const results = await new Promise<TestResults>((resolve) => {
      runner.on('complete', resolve);
      runner.run();
    });

    expect(results.totalRequests).toBeGreaterThan(0);
    expect(results.successfulRequests).toBeGreaterThan(0);
    await server.stop();
  });

  it('should handle worker memory limits', async () => {
    const server = new ServerManager();
    const serverUrl = await server.start();
    const config = createTestConfig({
      requests: [{ url: `${serverUrl}/api/test`, method: 'GET', rps: 50 }],
      options: {
        durationSec: 1,
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

    const runner = new CoreRunner(config);
    const results = await new Promise<TestResults>((resolve) => {
      runner.on('complete', resolve);
      runner.run();
    });

    expect(results.totalRequests).toBeGreaterThan(0);
    await server.stop();
  });
});
