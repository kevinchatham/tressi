import { beforeEach, describe, expect, it } from 'vitest';

import { SharedMemoryManager } from '../../src/workers/shared-memory-manager';

describe('SharedMemoryManager', () => {
  let sharedMemory: SharedMemoryManager;

  beforeEach(() => {
    sharedMemory = new SharedMemoryManager(2, 3, 100);
  });

  it('should initialize with correct buffer size', () => {
    const buffer = sharedMemory.getBuffer();
    expect(buffer).toBeInstanceOf(SharedArrayBuffer);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it('should record and retrieve results', () => {
    sharedMemory.reset();

    sharedMemory.recordResult(0, {
      success: true,
      latency: 100,
      endpointIndex: 0,
    });

    const stats = sharedMemory.getGlobalStats();
    expect(stats.totalRequests).toBe(1);
    expect(stats.totalErrors).toBe(0);
    expect(stats.errorRate).toBe(0);
  });

  it('should record errors correctly', () => {
    sharedMemory.reset();

    sharedMemory.recordError(0, 1);

    const stats = sharedMemory.getGlobalStats();
    expect(stats.totalRequests).toBe(1);
    expect(stats.totalErrors).toBe(1);
    expect(stats.errorRate).toBe(1);
  });

  it('should handle worker status updates', () => {
    sharedMemory.setWorkerStatus(0, 1);
    expect(sharedMemory.getWorkerStatus(0)).toBe(1);
  });

  it('should handle shutdown signals', () => {
    expect(sharedMemory.shouldShutdown()).toBe(false);
    sharedMemory.signalShutdown();
    expect(sharedMemory.shouldShutdown()).toBe(true);
  });
});
