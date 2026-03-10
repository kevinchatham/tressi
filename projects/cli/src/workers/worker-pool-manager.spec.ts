import { TressiConfig } from '@tressi/shared/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Worker } from 'worker_threads';

import { WorkerPoolManager } from './worker-pool-manager';

vi.mock('worker_threads', () => {
  return {
    Worker: vi.fn().mockImplementation(function () {
      return {
        on: vi.fn(),
        terminate: vi.fn().mockResolvedValue(undefined),
        threadId: 1,
      };
    }),
  };
});

vi.mock('./shared-memory/shared-memory-factory', () => ({
  SharedMemoryFactory: {
    createManagers: vi.fn().mockReturnValue({
      workerState: {
        setWorkerState: vi.fn(),
        getWorkerState: vi.fn(),
        waitForState: vi.fn().mockResolvedValue(true),
        getSharedBuffer: vi.fn().mockReturnValue(new SharedArrayBuffer(1024)),
      },
      endpointState: {
        isEndpointRunning: vi.fn().mockReturnValue(true),
        getRunningEndpointsCount: vi.fn().mockReturnValue(1),
        getSharedBuffer: vi.fn().mockReturnValue(new SharedArrayBuffer(1024)),
      },
      hdrHistogram: [
        {
          getSharedBuffer: vi.fn().mockReturnValue(new SharedArrayBuffer(1024)),
        },
      ],
      statsCounter: [
        {
          getSharedBuffer: vi.fn().mockReturnValue(new SharedArrayBuffer(1024)),
        },
      ],
    }),
  },
}));

vi.mock('../utils/file-utils', () => ({
  FileUtils: {
    getWorkerThreadPath: vi.fn().mockReturnValue('./worker-thread.js'),
  },
}));

vi.mock('./early-exit-coordinator', () => {
  return {
    EarlyExitCoordinator: vi.fn().mockImplementation(function () {
      return {
        startMonitoring: vi.fn(),
        stopMonitoring: vi.fn(),
      };
    }),
  };
});

vi.mock('./metrics-aggregator', () => {
  return {
    MetricsAggregator: vi.fn().mockImplementation(function () {
      return {
        setConfig: vi.fn(),
        setEndpoints: vi.fn(),
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        getResults: vi.fn().mockReturnValue({ global: {}, endpoints: {} }),
        getCollectedResponseSamples: vi.fn().mockReturnValue(new Map()),
        cleanupResponseSamples: vi.fn(),
        setTestId: vi.fn(),
        setStartTime: vi.fn(),
        getTestSummary: vi.fn().mockReturnValue({ global: {}, endpoints: {} }),
      };
    }),
  };
});

describe('WorkerPoolManager', () => {
  let mockConfig: TressiConfig;

  beforeEach(() => {
    mockConfig = {
      $schema: 'http://example.com/schema.json',
      requests: [
        {
          url: 'http://example.com/api/1',
          method: 'GET',
          payload: {},
          headers: {},
          rps: 10,
          rampUpDurationSec: 0,
        },
      ],
      options: {
        durationSec: 60,
        rampUpDurationSec: 0,
        headers: {},
        threads: 1,
        workerMemoryLimit: 512,
      },
    } as TressiConfig;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize correctly', () => {
    const manager = new WorkerPoolManager(mockConfig);
    expect(manager).toBeInstanceOf(WorkerPoolManager);
  });

  it('should start workers and monitoring', async () => {
    const manager = new WorkerPoolManager(mockConfig);
    await manager.start();

    expect(Worker).toHaveBeenCalled();
  });

  it('should stop workers and monitoring', async () => {
    const manager = new WorkerPoolManager(mockConfig);
    // Mock _waitForWorkersExit to avoid infinite loop
    vi.spyOn(
      manager as unknown as { _waitForWorkersExit: () => Promise<void> },
      '_waitForWorkersExit',
    ).mockResolvedValue(undefined);
    await manager.start();
    await manager.stop();

    expect(Worker).toHaveBeenCalled();
  });
});
