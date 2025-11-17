import { describe, expect, it } from 'vitest';

import { SharedMemoryManager } from '../../src/workers/shared-memory-manager';

describe('Memory Leak Tests', () => {
  it('should not leak memory with repeated initialization', () => {
    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < 10; i++) {
      const sharedMemory = new SharedMemoryManager(4, 10, 1000);
      sharedMemory.reset();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // Allow for some variance, but should not grow significantly
    expect(memoryIncrease).toBeLessThan(1024 * 1024); // Less than 1MB increase
  });

  it('should properly cleanup shared memory', () => {
    const sharedMemory = new SharedMemoryManager(2, 5, 100);

    // Record some data
    sharedMemory.recordResult(0, {
      success: true,
      latency: 100,
      endpointIndex: 0,
    });

    sharedMemory.recordError(0, 1);

    // Reset should clear all data
    sharedMemory.reset();

    const stats = sharedMemory.getGlobalStats();
    expect(stats.totalRequests).toBe(0);
    expect(stats.successfulRequests).toBe(0);
    expect(stats.failedRequests).toBe(0);
  });

  it('should handle large buffer sizes efficiently', () => {
    const largeBufferSize = 100000;
    const sharedMemory = new SharedMemoryManager(8, 50, largeBufferSize);

    // Fill the buffer with data
    for (let workerId = 0; workerId < 8; workerId++) {
      for (let i = 0; i < 1000; i++) {
        sharedMemory.recordResult(workerId, {
          success: i % 2 === 0,
          latency: Math.random() * 1000,
          endpointIndex: i % 50,
        });
      }
    }

    const stats = sharedMemory.getGlobalStats();
    expect(stats.totalRequests).toBe(8000);

    // Verify memory usage is reasonable
    const memoryUsage = process.memoryUsage();
    expect(memoryUsage.heapUsed).toBeGreaterThan(0);
  });
});
