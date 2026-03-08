import { TressiConfig } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkerPoolManager } from '../workers/worker-pool-manager';
import { Runner } from './runner';

vi.mock('../workers/worker-pool-manager');

describe('Runner', () => {
  let runner: Runner;
  let mockConfig: TressiConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = {
      options: {
        duration: 10,
        rampUp: 0,
        workerCount: 1,
      },
      requests: [],
    } as unknown as TressiConfig;
    runner = new Runner(mockConfig);
  });

  it('should initialize with a worker pool', () => {
    expect(WorkerPoolManager).toHaveBeenCalledWith(mockConfig);
  });

  it('should get aggregated metrics', () => {
    const mockMetrics = {
      totalRequests: 100,
    } as unknown as import('@tressi/shared/common').AggregatedMetrics;
    const workerPoolMock = vi.mocked(WorkerPoolManager.prototype);
    workerPoolMock.getAggregatedResults.mockReturnValue(mockMetrics);

    const metrics = runner.getAggregatedMetrics();
    expect(metrics).toEqual(mockMetrics);
    expect(workerPoolMock.getAggregatedResults).toHaveBeenCalled();
  });

  it('should run the test', async () => {
    const workerPoolMock = vi.mocked(WorkerPoolManager.prototype);
    workerPoolMock.start.mockResolvedValue(undefined);
    workerPoolMock.waitForWorkersComplete.mockResolvedValue(undefined);

    const emitSpy = vi.spyOn(runner, 'emit');

    await runner.run();

    expect(workerPoolMock.setStartTime).toHaveBeenCalled();
    expect(workerPoolMock.start).toHaveBeenCalled();
    expect(workerPoolMock.waitForWorkersComplete).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledWith('start', expect.any(Object));
    expect(emitSpy).toHaveBeenCalledWith('complete', expect.any(Object));
  });

  it('should handle run errors', async () => {
    const workerPoolMock = vi.mocked(WorkerPoolManager.prototype);
    const error = new Error('Worker failed');
    workerPoolMock.start.mockRejectedValue(error);

    const emitSpy = vi.spyOn(runner, 'emit');

    await expect(runner.run()).rejects.toThrow('Worker failed');
    expect(emitSpy).toHaveBeenCalledWith('error', error);
  });

  it('should stop the test', async () => {
    const workerPoolMock = vi.mocked(WorkerPoolManager.prototype);
    await runner.stop();
    expect(workerPoolMock.stop).toHaveBeenCalled();
  });

  it('should cancel the test', async () => {
    const workerPoolMock = vi.mocked(WorkerPoolManager.prototype);
    await runner.cancel();
    expect(runner.isCanceled()).toBe(true);
    expect(workerPoolMock.stop).toHaveBeenCalled();
  });

  it('should get start time', () => {
    const startTime = runner.getStartTime();
    expect(typeof startTime).toBe('number');
  });

  it('should set start time', () => {
    const startTime = 12345;
    const workerPoolMock = vi.mocked(WorkerPoolManager.prototype);
    runner.setStartTime(startTime);
    expect(workerPoolMock.setStartTime).toHaveBeenCalledWith(startTime);
  });

  it('should get config', () => {
    expect(runner.getConfig()).toEqual(mockConfig);
  });

  it('should get test summary', () => {
    const mockSummary = {
      id: 'test',
    } as unknown as import('@tressi/shared/common').TestSummary;
    const workerPoolMock = vi.mocked(WorkerPoolManager.prototype);
    workerPoolMock.getTestSummary.mockReturnValue(mockSummary);
    expect(runner.getTestSummary()).toEqual(mockSummary);
  });

  it('should get response samples', () => {
    const mockSamples = {
      url: [],
    } as unknown as import('@tressi/shared/common').ResponseSamples;
    const workerPoolMock = vi.mocked(WorkerPoolManager.prototype);
    workerPoolMock.getResponseSamples.mockReturnValue(mockSamples);
    expect(runner.getResponseSamples()).toEqual(mockSamples);
  });

  it('should cleanup response samples', () => {
    const workerPoolMock = vi.mocked(WorkerPoolManager.prototype);
    runner.cleanupResponseSamples();
    expect(workerPoolMock.cleanupResponseSamples).toHaveBeenCalled();
  });

  it('should set test id', () => {
    const testId = 'test-123';
    const workerPoolMock = vi.mocked(WorkerPoolManager.prototype);
    runner.setTestId(testId);
    expect(workerPoolMock.setTestId).toHaveBeenCalledWith(testId);
  });
});
