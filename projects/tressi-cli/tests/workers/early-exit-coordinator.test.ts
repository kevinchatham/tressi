import { beforeEach, describe, expect, it } from 'vitest';

import type { TressiConfig } from '../../src/types';
import { EarlyExitCoordinator } from '../../src/workers/early-exit-coordinator';
import { SharedMemoryManager } from '../../src/workers/shared-memory-manager';

interface EarlyExitThresholds {
  globalErrorRate?: number;
  monitoringWindowMs: number;
}

describe('EarlyExitCoordinator', () => {
  let coordinator: EarlyExitCoordinator;
  let sharedMemory: SharedMemoryManager;
  let mockConfig: TressiConfig;

  beforeEach(() => {
    sharedMemory = new SharedMemoryManager(2, 2);
    mockConfig = {
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
          monitoringWindowMs: 100,
          stopMode: 'endpoint',
        },
      },
    };
    coordinator = new EarlyExitCoordinator(mockConfig, sharedMemory);
  });

  it('should parse thresholds correctly', () => {
    const thresholds = (
      coordinator as unknown as { thresholds: EarlyExitThresholds }
    ).thresholds;
    expect(thresholds.globalErrorRate).toBe(0.5);
    expect(thresholds.monitoringWindowMs).toBe(100);
  });

  it('should handle disabled early exit', () => {
    const disabledConfig: TressiConfig = {
      $schema: 'test-schema',
      requests: [{ url: 'http://localhost:3000/test1', method: 'GET', rps: 1 }],
      options: {
        durationSec: 10,
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
      },
    };
    const disabledCoordinator = new EarlyExitCoordinator(
      disabledConfig,
      sharedMemory,
    );
    const thresholds = (
      disabledCoordinator as unknown as { thresholds: EarlyExitThresholds }
    ).thresholds;
    expect(thresholds.globalErrorRate).toBeUndefined();
  });

  it('should check global exit conditions', () => {
    sharedMemory.reset();
    sharedMemory.recordError(0, 0);
    sharedMemory.recordResult(0, {
      success: false,
      latency: 100,
      endpointIndex: 0,
    });

    const shouldExit = (
      coordinator as unknown as {
        shouldTriggerGlobalExit: (stats: {
          totalRequests: number;
          totalErrors: number;
          errorRate: number;
        }) => boolean;
      }
    ).shouldTriggerGlobalExit({
      totalRequests: 2,
      totalErrors: 2,
      errorRate: 1,
    });
    expect(shouldExit).toBe(true);
  });
});
