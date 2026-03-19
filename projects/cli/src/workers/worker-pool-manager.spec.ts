import { Worker } from 'node:worker_threads';
import type { TressiConfig } from '@tressi/shared/common';
import type { Procedure } from '@vitest/spy';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { WorkerPoolManager } from './worker-pool-manager';

vi.mock('worker_threads', () => {
  return {
    Worker: vi.fn().mockImplementation(function (this: {
      on: Mock<Procedure>;
      terminate: Mock<Procedure>;
      threadId: number;
    }) {
      this.on = vi.fn();
      this.terminate = vi.fn().mockResolvedValue(undefined);
      this.threadId = 1;
    }),
  };
});

vi.mock('./shared-memory/shared-memory-factory', () => ({
  SharedMemoryFactory: {
    createManagers: vi.fn().mockReturnValue({
      endpointState: {
        getRunningEndpointsCount: vi.fn().mockReturnValue(1),
        getSharedBuffer: vi.fn().mockReturnValue(new SharedArrayBuffer(1024)),
        isEndpointRunning: vi.fn().mockReturnValue(true),
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
      workerState: {
        getSharedBuffer: vi.fn().mockReturnValue(new SharedArrayBuffer(1024)),
        getWorkerState: vi.fn(),
        setWorkerState: vi.fn(),
        waitForState: vi.fn().mockResolvedValue(true),
      },
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
    EarlyExitCoordinator: vi.fn().mockImplementation(function (this: {
      startMonitoring: Mock<Procedure>;
      stopMonitoring: Mock<Procedure>;
    }) {
      this.startMonitoring = vi.fn();
      this.stopMonitoring = vi.fn();
    }),
  };
});

vi.mock('./metrics-aggregator', () => {
  return {
    MetricsAggregator: vi.fn().mockImplementation(function (this: {
      setConfig: Mock<Procedure>;
      setEndpoints: Mock<Procedure>;
      startPolling: Mock<Procedure>;
      stopPolling: Mock<Procedure>;
      getResults: Mock<Procedure>;
      getCollectedResponseSamples: Mock<Procedure>;
      cleanupResponseSamples: Mock<Procedure>;
      setTestId: Mock<Procedure>;
      setStartTime: Mock<Procedure>;
      getTestSummary: Mock<Procedure>;
    }) {
      this.setConfig = vi.fn();
      this.setEndpoints = vi.fn();
      this.startPolling = vi.fn();
      this.stopPolling = vi.fn();
      this.getResults = vi.fn().mockReturnValue({ endpoints: {}, global: {} });
      this.getCollectedResponseSamples = vi.fn().mockReturnValue(new Map());
      this.cleanupResponseSamples = vi.fn();
      this.setTestId = vi.fn();
      this.setStartTime = vi.fn();
      this.getTestSummary = vi.fn().mockReturnValue({ endpoints: {}, global: {} });
    }),
  };
});

describe('WorkerPoolManager', () => {
  let mockConfig: TressiConfig;

  beforeEach(() => {
    mockConfig = {
      $schema: 'http://example.com/schema.json',
      options: {
        durationSec: 60,
        headers: {},
        rampUpDurationSec: 0,
        threads: 1,
        workerMemoryLimit: 512,
      },
      requests: [
        {
          headers: {},
          method: 'GET',
          payload: {},
          rampUpDurationSec: 0,
          rps: 10,
          url: 'http://example.com/api/1',
        },
      ],
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
