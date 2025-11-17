import { describe, expect, it } from 'vitest';

import type { TressiConfig } from '../../../src/types';
import { EarlyExitCoordinator } from '../../../src/workers/early-exit-coordinator';
import { SharedMemoryManager } from '../../../src/workers/shared-memory-manager';

describe('Early Exit Coordination', () => {
  it('should configure early exit thresholds', () => {
    const sharedMemory = new SharedMemoryManager(2, 2);
    const config: TressiConfig = {
      $schema: 'test-schema',
      requests: [
        { url: 'http://localhost:3000/test1', method: 'GET', rps: 1 },
        { url: 'http://localhost:3000/test2', method: 'POST', rps: 1 },
      ],
      options: {
        durationSec: 10,
        rampUpTimeSec: 0,
        useUI: false,
        silent: true,
        earlyExitOnError: false,
        workerMemoryLimit: 128,
        workerEarlyExit: {
          enabled: true,
          globalErrorRateThreshold: 0.5,
          globalErrorCountThreshold: 100,
          monitoringWindowMs: 100,
          stopMode: 'global' as const,
        },
      },
    };

    const coordinator = new EarlyExitCoordinator(config, sharedMemory);
    expect(coordinator).toBeDefined();
  });

  it('should handle per-endpoint thresholds', () => {
    const sharedMemory = new SharedMemoryManager(2, 2);
    const config: TressiConfig = {
      $schema: 'test-schema',
      requests: [
        { url: 'http://localhost:3000/test1', method: 'GET', rps: 1 },
        { url: 'http://localhost:3000/test2', method: 'POST', rps: 1 },
      ],
      options: {
        durationSec: 10,
        rampUpTimeSec: 0,
        useUI: false,
        silent: true,
        earlyExitOnError: false,
        workerMemoryLimit: 128,
        workerEarlyExit: {
          enabled: true,
          perEndpointThresholds: [
            {
              url: 'http://localhost:3000/test1',
              errorRateThreshold: 0.3,
              errorCountThreshold: 50,
            },
          ],
          monitoringWindowMs: 100,
          stopMode: 'endpoint' as const,
        },
      },
    };

    const coordinator = new EarlyExitCoordinator(config, sharedMemory);
    expect(coordinator).toBeDefined();
  });

  it('should validate configuration requirements', () => {
    const sharedMemory = new SharedMemoryManager(2, 2);

    // Should throw if no thresholds provided
    expect(() => {
      const config: TressiConfig = {
        $schema: 'test-schema',
        requests: [
          { url: 'http://localhost:3000/test', method: 'GET', rps: 1 },
        ],
        options: {
          durationSec: 10,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: true,
            monitoringWindowMs: 100,
            stopMode: 'endpoint' as const,
          },
        },
      };
      new EarlyExitCoordinator(config, sharedMemory);
    }).toThrow();
  });
});
