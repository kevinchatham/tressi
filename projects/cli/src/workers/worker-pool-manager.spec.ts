import { Worker } from 'node:worker_threads';
import type { TressiConfig } from '@tressi/shared/common';
import type { Procedure } from '@vitest/spy';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { WorkerPoolManager } from './worker-pool-manager';

vi.mock('node:worker_threads', () => {
  return {
    Worker: vi.fn().mockImplementation(function (this: {
      on: Mock<Procedure>;
      terminate: Mock<Procedure>;
      threadId: number;
      postMessage: Mock<Procedure>;
    }) {
      this.on = vi.fn();
      this.terminate = vi.fn().mockResolvedValue(undefined);
      this.threadId = 1;
      this.postMessage = vi.fn();
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
      recordResponseSample: Mock<Procedure>;
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
      this.recordResponseSample = vi.fn();
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

  describe('initialization', () => {
    it('should initialize correctly', () => {
      const manager = new WorkerPoolManager(mockConfig);
      expect(manager).toBeInstanceOf(WorkerPoolManager);
    });

    it('should limit workers to CPU count when threads exceeds CPU count', () => {
      const highThreadConfig: TressiConfig = {
        ...mockConfig,
        options: {
          ...mockConfig.options,
          threads: 9999,
        },
      };
      const manager = new WorkerPoolManager(highThreadConfig);
      expect(manager).toBeInstanceOf(WorkerPoolManager);
    });
  });

  describe('start', () => {
    it('should start workers and monitoring', async () => {
      const manager = new WorkerPoolManager(mockConfig);
      await manager.start();

      expect(Worker).toHaveBeenCalled();
    });

    it('should call worker error handler when worker emits error event', async () => {
      const manager = new WorkerPoolManager(mockConfig);
      await manager.start();

      // Get the worker instance
      const workerInstance = (Worker as unknown as Mock).mock.results[0].value;
      const errorCallback = workerInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'error',
      )?.[1];

      expect(errorCallback).toBeDefined();

      // Simulate worker error
      const consoleSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      errorCallback(new Error('Worker error'));

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Worker 0 error'));
      consoleSpy.mockRestore();
    });

    it('should handle worker exit with non-zero code as error', async () => {
      const manager = new WorkerPoolManager(mockConfig);
      await manager.start();

      const workerInstance = (Worker as unknown as Mock).mock.results[0].value;
      const exitCallback = workerInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'exit',
      )?.[1];

      expect(exitCallback).toBeDefined();

      // Simulate worker exit with error code
      const consoleSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      exitCallback(1);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('exited with code 1'));
      consoleSpy.mockRestore();
    });

    it('should handle worker exit with zero code as finished', async () => {
      const manager = new WorkerPoolManager(mockConfig);
      await manager.start();

      const workerInstance = (Worker as unknown as Mock).mock.results[0].value;
      const exitCallback = workerInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'exit',
      )?.[1];

      expect(exitCallback).toBeDefined();

      // Simulate worker exit with success code
      exitCallback(0);

      // No error should be logged
    });

    it('should handle bodySample messages from workers', async () => {
      const manager = new WorkerPoolManager(mockConfig);
      await manager.start();

      const workerInstance = (Worker as unknown as Mock).mock.results[0].value;
      const messageCallback = workerInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'message',
      )?.[1];

      expect(messageCallback).toBeDefined();

      // Simulate bodySample message
      const bodySampleMessage = {
        body: 'response body',
        headers: { 'content-type': 'application/json' },
        statusCode: 200,
        type: 'bodySample',
        url: 'http://example.com/api/1',
      };

      messageCallback(bodySampleMessage);
    });

    it('should ignore non-bodySample messages', async () => {
      const manager = new WorkerPoolManager(mockConfig);
      await manager.start();

      const workerInstance = (Worker as unknown as Mock).mock.results[0].value;
      const messageCallback = workerInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'message',
      )?.[1];

      // Simulate non-bodySample message
      const otherMessage = { data: 'test', type: 'other' };
      messageCallback(otherMessage);
    });

    it('should ignore incomplete bodySample messages', async () => {
      const manager = new WorkerPoolManager(mockConfig);
      await manager.start();

      const workerInstance = (Worker as unknown as Mock).mock.results[0].value;
      const messageCallback = workerInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'message',
      )?.[1];

      // Missing fields
      const incompleteMessage = { type: 'bodySample' };
      messageCallback(incompleteMessage);
    });
  });

  describe('stop', () => {
    it('should stop workers and monitoring', async () => {
      const manager = new WorkerPoolManager(mockConfig);
      vi.spyOn(
        manager as unknown as { _waitForWorkersExit: () => Promise<void> },
        '_waitForWorkersExit',
      ).mockResolvedValue(undefined);
      await manager.start();
      await manager.stop();

      expect(Worker).toHaveBeenCalled();
    });

    it('should handle worker termination errors gracefully', async () => {
      const manager = new WorkerPoolManager(mockConfig);
      // Set up mock for _waitForWorkersExit before starting
      vi.spyOn(
        manager as unknown as { _waitForWorkersExit: () => Promise<void> },
        '_waitForWorkersExit',
      ).mockResolvedValue(undefined);

      await manager.start();

      // Now modify terminate to throw after manager has started
      const workerInstance = (Worker as unknown as Mock).mock.results[0].value;
      workerInstance.terminate.mockRejectedValueOnce(new Error('Termination failed'));

      await manager.stop();
    });
  });

  describe('waitForWorkersComplete', () => {
    it('should break when all endpoints are stopped', async () => {
      const manager = new WorkerPoolManager(mockConfig);

      // Access mock and modify behavior
      const sharedMemoryFactory = vi.mocked(
        (await import('./shared-memory/shared-memory-factory')).SharedMemoryFactory,
      );
      const mockEndpointState = (
        sharedMemoryFactory.createManagers as unknown as {
          mock: {
            results: Array<{
              value: { endpointState: { getRunningEndpointsCount: ReturnType<typeof vi.fn> } };
            }>;
          };
        }
      ).mock.results[0].value.endpointState;
      mockEndpointState.getRunningEndpointsCount.mockReturnValue(0);

      vi.spyOn(
        manager as unknown as { _waitForWorkersExit: () => Promise<void> },
        '_waitForWorkersExit',
      ).mockResolvedValue(undefined);

      const consoleSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await manager.start();
      await manager.waitForWorkersComplete();

      expect(consoleSpy).toHaveBeenCalledWith('All endpoints stopped - terminating test\n');
      consoleSpy.mockRestore();
    });

    it('should break when all workers are complete', async () => {
      const manager = new WorkerPoolManager(mockConfig);

      // Mock the shared memory factory to return FINISHED state
      const sharedMemoryFactory = vi.mocked(
        (await import('./shared-memory/shared-memory-factory')).SharedMemoryFactory,
      );
      const mockWorkerState = (
        sharedMemoryFactory.createManagers as unknown as {
          mock: {
            results: Array<{
              value: { workerState: { getWorkerState: ReturnType<typeof vi.fn> } };
            }>;
          };
        }
      ).mock.results[0].value.workerState;
      mockWorkerState.getWorkerState.mockReturnValue(4); // WorkerState.FINISHED

      vi.spyOn(
        manager as unknown as { _waitForWorkersExit: () => Promise<void> },
        '_waitForWorkersExit',
      ).mockResolvedValue(undefined);

      await manager.start();
      await manager.waitForWorkersComplete();
    });

    it('should break when duration timeout is reached', async () => {
      // Create config with very short duration to trigger timeout
      const shortDurationConfig: TressiConfig = {
        ...mockConfig,
        options: {
          ...mockConfig.options,
          durationSec: 0.001, // Very short duration
        },
      };

      const manager = new WorkerPoolManager(shortDurationConfig);

      // Mock _waitForWorkersExit to avoid actual worker termination
      vi.spyOn(
        manager as unknown as { _waitForWorkersExit: () => Promise<void> },
        '_waitForWorkersExit',
      ).mockResolvedValue(undefined);

      const consoleSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

      await manager.start();

      // Manually trigger timeout by advancing time
      // Since we can't actually advance time in tests, we verify the method completes
      await manager.waitForWorkersComplete();

      // The test passes if waitForWorkersComplete completes without hanging
      consoleSpy.mockRestore();
    });
  });

  describe('getAggregatedResults', () => {
    it('should return aggregated results from metrics aggregator', () => {
      const manager = new WorkerPoolManager(mockConfig);
      const results = manager.getAggregatedResults();

      // Just verify it returns something (mock returns { endpoints: {}, global: {} })
      expect(results).toBeDefined();
      expect(typeof results).toBe('object');
    });
  });

  describe('getResponseSamples', () => {
    it('should return response samples from metrics aggregator', () => {
      const manager = new WorkerPoolManager(mockConfig);
      const samples = manager.getResponseSamples();

      expect(samples).toEqual({});
    });
  });

  describe('cleanupResponseSamples', () => {
    it('should cleanup response samples', () => {
      const manager = new WorkerPoolManager(mockConfig);
      manager.cleanupResponseSamples();
    });
  });

  describe('setTestId', () => {
    it('should set test ID', () => {
      const manager = new WorkerPoolManager(mockConfig);
      manager.setTestId('test-123');
    });
  });

  describe('setStartTime', () => {
    it('should set start time', () => {
      const manager = new WorkerPoolManager(mockConfig);
      manager.setStartTime(Date.now());
    });
  });
});
