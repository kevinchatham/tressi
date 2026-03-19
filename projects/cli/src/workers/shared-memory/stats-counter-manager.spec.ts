import { describe, expect, it } from 'vitest';

import { StatsCounterManager } from './stats-counter-manager';

describe('StatsCounterManager', () => {
  describe('constructor', () => {
    it('should initialize with default ring buffer size', () => {
      const manager = new StatsCounterManager(5);

      expect(manager.getEndpointsCount()).toBe(5);
      expect(manager.getSharedBuffer()).toBeInstanceOf(SharedArrayBuffer);
    });

    it('should initialize with custom ring buffer size', () => {
      const manager = new StatsCounterManager(3, 50);

      expect(manager.getEndpointsCount()).toBe(3);
    });

    it('should use external buffer when provided', () => {
      const endpointsCount = 2;
      const ringBufferSize = 10;
      const manager = new StatsCounterManager(endpointsCount, ringBufferSize);

      const sabSize = manager.getSharedBuffer().byteLength;
      const externalBuffer = new SharedArrayBuffer(sabSize);

      const manager2 = new StatsCounterManager(endpointsCount, ringBufferSize, externalBuffer);

      expect(manager2.getSharedBuffer()).toBe(externalBuffer);
    });

    it('should throw error when external buffer is too small', () => {
      const smallBuffer = new SharedArrayBuffer(100);

      expect(() => new StatsCounterManager(5, 100, smallBuffer)).toThrow('Buffer too small');
    });

    it('should initialize counters to zero', () => {
      const manager = new StatsCounterManager(2);

      const counters = manager.getAllEndpointCounters();

      expect(counters).toHaveLength(2);
      counters.forEach((counter) => {
        expect(counter.successCount).toBe(0);
        expect(counter.failureCount).toBe(0);
        expect(counter.bytesSent).toBe(0);
        expect(counter.bytesReceived).toBe(0);
        expect(counter.statusCodeCounts).toEqual({});
        expect(counter.sampledStatusCodes).toEqual([]);
        expect(counter.bodySampleIndices).toEqual([]);
      });
    });

    it('should not initialize counters when using external buffer', () => {
      const endpointsCount = 1;
      const ringBufferSize = 10;
      const manager = new StatsCounterManager(endpointsCount, ringBufferSize);

      const sabSize = manager.getSharedBuffer().byteLength;
      const externalBuffer = new SharedArrayBuffer(sabSize);

      // Pre-populate with non-zero values
      const view = new Int32Array(externalBuffer);
      view.fill(42);

      const manager2 = new StatsCounterManager(endpointsCount, ringBufferSize, externalBuffer);

      const counters = manager2.getEndpointCounters(0);
      expect(counters.successCount).toBeGreaterThan(0);
    });
  });

  describe('recordRequest', () => {
    it('should record successful requests', () => {
      const manager = new StatsCounterManager(2);

      manager.recordRequest(0, true);
      manager.recordRequest(0, true);

      const counters = manager.getEndpointCounters(0);
      expect(counters.successCount).toBe(2);
      expect(counters.failureCount).toBe(0);
    });

    it('should record failed requests', () => {
      const manager = new StatsCounterManager(2);

      manager.recordRequest(0, false);
      manager.recordRequest(0, false);

      const counters = manager.getEndpointCounters(0);
      expect(counters.successCount).toBe(0);
      expect(counters.failureCount).toBe(2);
    });

    it('should handle mixed success and failure', () => {
      const manager = new StatsCounterManager(2);

      manager.recordRequest(0, true);
      manager.recordRequest(0, false);
      manager.recordRequest(0, true);

      const counters = manager.getEndpointCounters(0);
      expect(counters.successCount).toBe(2);
      expect(counters.failureCount).toBe(1);
    });

    it('should throw error for invalid endpoint index', () => {
      const manager = new StatsCounterManager(3);

      expect(() => manager.recordRequest(-1, true)).toThrow('Invalid endpoint index: -1');
      expect(() => manager.recordRequest(3, true)).toThrow('Invalid endpoint index: 3');
    });
  });

  describe('recordBytesSent', () => {
    it('should record bytes sent correctly', () => {
      const manager = new StatsCounterManager(2);

      manager.recordBytesSent(0, 1024);
      manager.recordBytesSent(0, 2048);

      const counters = manager.getEndpointCounters(0);
      expect(counters.bytesSent).toBe(3072);
    });

    it('should ignore negative byte counts', () => {
      const manager = new StatsCounterManager(2);

      manager.recordBytesSent(0, 1024);
      manager.recordBytesSent(0, -500);

      const counters = manager.getEndpointCounters(0);
      expect(counters.bytesSent).toBe(1024);
    });

    it('should handle zero bytes', () => {
      const manager = new StatsCounterManager(2);

      manager.recordBytesSent(0, 0);

      const counters = manager.getEndpointCounters(0);
      expect(counters.bytesSent).toBe(0);
    });

    it('should throw error for invalid endpoint index', () => {
      const manager = new StatsCounterManager(3);

      expect(() => manager.recordBytesSent(-1, 1024)).toThrow('Invalid endpoint index: -1');
      expect(() => manager.recordBytesSent(3, 1024)).toThrow('Invalid endpoint index: 3');
    });
  });

  describe('recordBytesReceived', () => {
    it('should record bytes received correctly', () => {
      const manager = new StatsCounterManager(2);

      manager.recordBytesReceived(0, 512);
      manager.recordBytesReceived(0, 1024);

      const counters = manager.getEndpointCounters(0);
      expect(counters.bytesReceived).toBe(1536);
    });

    it('should ignore negative byte counts', () => {
      const manager = new StatsCounterManager(2);

      manager.recordBytesReceived(0, 512);
      manager.recordBytesReceived(0, -100);

      const counters = manager.getEndpointCounters(0);
      expect(counters.bytesReceived).toBe(512);
    });

    it('should throw error for invalid endpoint index', () => {
      const manager = new StatsCounterManager(3);

      expect(() => manager.recordBytesReceived(-1, 512)).toThrow('Invalid endpoint index: -1');
      expect(() => manager.recordBytesReceived(3, 512)).toThrow('Invalid endpoint index: 3');
    });
  });

  describe('recordStatusCode', () => {
    it('should record status codes correctly', () => {
      const manager = new StatsCounterManager(2);

      manager.recordStatusCode(0, 200);
      manager.recordStatusCode(0, 404);
      manager.recordStatusCode(0, 500);

      const counters = manager.getEndpointCounters(0);
      expect(counters.statusCodeCounts[200]).toBe(1);
      expect(counters.statusCodeCounts[404]).toBe(1);
      expect(counters.statusCodeCounts[500]).toBe(1);
    });

    it('should record status codes in sampled list only once per status code', () => {
      const manager = new StatsCounterManager(2);

      manager.recordStatusCode(0, 200);
      manager.recordStatusCode(0, 200); // Duplicate
      manager.recordStatusCode(0, 404);

      const counters = manager.getEndpointCounters(0);
      expect(counters.statusCodeCounts[200]).toBe(2);
      expect(counters.sampledStatusCodes).toHaveLength(2);
      expect(counters.sampledStatusCodes).toContain(200);
      expect(counters.sampledStatusCodes).toContain(404);
    });

    it('should ignore invalid status codes', () => {
      const manager = new StatsCounterManager(2);

      manager.recordStatusCode(0, 99);
      manager.recordStatusCode(0, 700);
      manager.recordStatusCode(0, 200);

      const counters = manager.getEndpointCounters(0);
      expect(counters.statusCodeCounts[200]).toBe(1);
      expect(counters.statusCodeCounts[99]).toBeUndefined();
      expect(counters.statusCodeCounts[700]).toBeUndefined();
    });

    it('should handle ring buffer overflow', () => {
      const manager = new StatsCounterManager(1, 3);

      // Add more status codes than ring buffer size
      manager.recordStatusCode(0, 200);
      manager.recordStatusCode(0, 404);
      manager.recordStatusCode(0, 500);
      manager.recordStatusCode(0, 503);

      const counters = manager.getEndpointCounters(0);
      expect(counters.sampledStatusCodes).toHaveLength(3);
      // The exact contents depend on ring buffer behavior, just check we have 3 unique codes
      const uniqueCodes = new Set(counters.sampledStatusCodes);
      expect(uniqueCodes.size).toBe(3);
    });

    it('should throw error for invalid endpoint index', () => {
      const manager = new StatsCounterManager(3);

      expect(() => manager.recordStatusCode(-1, 200)).toThrow('Invalid endpoint index: -1');
      expect(() => manager.recordStatusCode(3, 200)).toThrow('Invalid endpoint index: 3');
    });
  });

  describe('getEndpointCounters', () => {
    it('should return complete counter information', () => {
      const manager = new StatsCounterManager(2);

      manager.recordRequest(0, true);
      manager.recordRequest(0, false);
      manager.recordBytesSent(0, 1024);
      manager.recordBytesReceived(0, 2048);
      manager.recordStatusCode(0, 200);
      manager.recordStatusCode(0, 404);

      const counters = manager.getEndpointCounters(0);

      expect(counters.successCount).toBe(1);
      expect(counters.failureCount).toBe(1);
      expect(counters.bytesSent).toBe(1024);
      expect(counters.bytesReceived).toBe(2048);
      expect(counters.statusCodeCounts[200]).toBe(1);
      expect(counters.statusCodeCounts[404]).toBe(1);
      expect(counters.sampledStatusCodes).toContain(200);
      expect(counters.sampledStatusCodes).toContain(404);
    });

    it('should return empty counters for no data', () => {
      const manager = new StatsCounterManager(2);

      const counters = manager.getEndpointCounters(0);

      expect(counters.successCount).toBe(0);
      expect(counters.failureCount).toBe(0);
      expect(counters.bytesSent).toBe(0);
      expect(counters.bytesReceived).toBe(0);
      expect(counters.statusCodeCounts).toEqual({});
      expect(counters.sampledStatusCodes).toEqual([]);
    });

    it('should throw error for invalid endpoint index', () => {
      const manager = new StatsCounterManager(3);

      expect(() => manager.getEndpointCounters(-1)).toThrow('Invalid endpoint index: -1');
      expect(() => manager.getEndpointCounters(3)).toThrow('Invalid endpoint index: 3');
    });
  });

  describe('getAllEndpointCounters', () => {
    it('should return counters for all endpoints', () => {
      const manager = new StatsCounterManager(3);

      manager.recordRequest(0, true);
      manager.recordRequest(1, false);
      manager.recordStatusCode(2, 200);

      const counters = manager.getAllEndpointCounters();

      expect(counters).toHaveLength(3);
      expect(counters[0].successCount).toBe(1);
      expect(counters[1].failureCount).toBe(1);
      expect(counters[2].statusCodeCounts[200]).toBe(1);
    });

    it('should return empty array for zero endpoints', () => {
      const manager = new StatsCounterManager(0);

      const counters = manager.getAllEndpointCounters();

      expect(counters).toEqual([]);
    });
  });

  describe('counter validation', () => {
    it('should handle large counter values without overflow', () => {
      const manager = new StatsCounterManager(2);

      // Record many requests to test counter capacity
      for (let i = 0; i < 1000; i++) {
        manager.recordRequest(0, true);
      }

      const counters = manager.getEndpointCounters(0);
      expect(counters.successCount).toBe(1000);
    });
  });

  describe('concurrent access simulation', () => {
    it('should handle concurrent counter updates', () => {
      const manager = new StatsCounterManager(2);

      // Simulate concurrent updates
      for (let i = 0; i < 100; i++) {
        manager.recordRequest(0, i % 2 === 0);
        manager.recordBytesSent(0, 100);
        manager.recordBytesReceived(0, 200);
        manager.recordStatusCode(0, 200 + (i % 5));
      }

      const counters = manager.getEndpointCounters(0);

      expect(counters.successCount + counters.failureCount).toBe(100);
      expect(counters.bytesSent).toBe(10000);
      expect(counters.bytesReceived).toBe(20000);
      expect(Object.keys(counters.statusCodeCounts)).toHaveLength(5);
    });
  });

  describe('edge cases', () => {
    it('should handle single endpoint', () => {
      const manager = new StatsCounterManager(1);

      manager.recordRequest(0, true);
      manager.recordStatusCode(0, 200);

      const counters = manager.getEndpointCounters(0);
      expect(counters.successCount).toBe(1);
      expect(counters.statusCodeCounts[200]).toBe(1);
    });

    it('should handle large number of endpoints', () => {
      const endpointsCount = 100;
      const manager = new StatsCounterManager(endpointsCount);

      // Record for first and last endpoints
      manager.recordRequest(0, true);
      manager.recordRequest(endpointsCount - 1, false);

      const counters = manager.getAllEndpointCounters();
      expect(counters).toHaveLength(endpointsCount);
      expect(counters[0].successCount).toBe(1);
      expect(counters[endpointsCount - 1].failureCount).toBe(1);
    });

    it('should handle all status codes', () => {
      const manager = new StatsCounterManager(1);

      // Test various status codes
      const statusCodes = [200, 201, 301, 302, 400, 401, 403, 404, 500, 502, 503];
      statusCodes.forEach((code) => {
        manager.recordStatusCode(0, code);
      });

      const counters = manager.getEndpointCounters(0);
      statusCodes.forEach((code) => {
        expect(counters.statusCodeCounts[code]).toBe(1);
      });
    });
  });
});
