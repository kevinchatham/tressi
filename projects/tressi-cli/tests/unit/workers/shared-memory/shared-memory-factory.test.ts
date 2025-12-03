import type { SafeTressiRequestConfig } from 'tressi-common/config';
import { describe, expect, it } from 'vitest';

import { SharedMemoryFactory } from '../../../../src/workers/shared-memory/shared-memory-factory';

describe('SharedMemoryFactory', () => {
  const mockEndpoints: SafeTressiRequestConfig[] = [
    {
      url: 'http://example.com/api/1',
      method: 'GET',
      payload: {},
      headers: {},
      rps: 10,
    },
    {
      url: 'http://example.com/api/2',
      method: 'POST',
      payload: {},
      headers: {},
      rps: 5,
    },
    {
      url: 'http://example.com/api/3',
      method: 'PUT',
      payload: {},
      headers: {},
      rps: 8,
    },
    {
      url: 'http://example.com/api/4',
      method: 'DELETE',
      payload: {},
      headers: {},
      rps: 12,
    },
  ];

  describe('createManagers', () => {
    it('should create all managers with default options', () => {
      const result = SharedMemoryFactory.createManagers(2, mockEndpoints);

      expect(result.hdrHistogram).toHaveLength(2);
      expect(result.workerState).toBeDefined();
      expect(result.statsCounter).toHaveLength(2);
      expect(result.bodySample).toHaveLength(4);
      expect(result.endpointState).toBeDefined();

      // Check that all managers are properly initialized
      expect(result.endpointState.getTotalEndpoints()).toBe(4);
    });

    it('should create managers with custom options', () => {
      const result = SharedMemoryFactory.createManagers(2, mockEndpoints, {
        significantFigures: 2,
        lowestTrackableValue: 10,
        highestTrackableValue: 1_000_000,
        ringBufferSize: 50,
        bodySampleBufferSize: 500,
      });

      // Verify managers are created successfully
      expect(result.hdrHistogram).toHaveLength(2);
      expect(result.statsCounter).toHaveLength(2);
    });

    it('should distribute endpoints correctly with round-robin', () => {
      // Check endpoint distribution
      const mapping = SharedMemoryFactory.getEndpointWorkerMapping(
        3,
        mockEndpoints,
      );
      expect(mapping).toEqual([0, 1, 2, 0]);
    });

    it('should handle single worker', () => {
      const result = SharedMemoryFactory.createManagers(1, mockEndpoints);

      expect(result.hdrHistogram).toHaveLength(1);
      expect(result.statsCounter).toHaveLength(1);
    });

    it('should handle more workers than endpoints', () => {
      const result = SharedMemoryFactory.createManagers(6, mockEndpoints);

      expect(result.hdrHistogram).toHaveLength(6);
      expect(result.statsCounter).toHaveLength(6);
    });

    it('should handle zero endpoints', () => {
      const result = SharedMemoryFactory.createManagers(2, []);

      expect(result.hdrHistogram).toHaveLength(2);
      expect(result.bodySample).toHaveLength(0);
      expect(result.endpointState.getTotalEndpoints()).toBe(0);
    });
  });

  describe('calculateMemoryUsage', () => {
    it('should calculate memory usage for default configuration', () => {
      const memoryUsage = SharedMemoryFactory.calculateMemoryUsage(2, 4);

      expect(memoryUsage).toBeGreaterThan(0);
      expect(typeof memoryUsage).toBe('number');
    });

    it('should calculate memory usage for custom configuration', () => {
      const memoryUsage = SharedMemoryFactory.calculateMemoryUsage(2, 4, {
        significantFigures: 2,
        lowestTrackableValue: 10,
        highestTrackableValue: 1_000_000,
        ringBufferSize: 50,
        bodySampleBufferSize: 500,
      });

      expect(memoryUsage).toBeGreaterThan(0);
    });

    it('should scale memory usage with configuration', () => {
      const smallConfig = SharedMemoryFactory.calculateMemoryUsage(1, 1, {
        ringBufferSize: 10,
        bodySampleBufferSize: 10,
      });

      const largeConfig = SharedMemoryFactory.calculateMemoryUsage(4, 100, {
        ringBufferSize: 1000,
        bodySampleBufferSize: 10000,
      });

      expect(largeConfig).toBeGreaterThan(smallConfig);
    });
  });

  describe('validateMemoryRequirements', () => {
    it('should validate memory requirements for reasonable configuration', () => {
      const validation = SharedMemoryFactory.validateMemoryRequirements(2, 4);

      expect(validation.valid).toBe(true);
      expect(validation.requiredBytes).toBeGreaterThan(0);
      expect(validation.maxBytes).toBe(2 * 1024 * 1024 * 1024); // 2GB
    });

    it('should handle memory validation appropriately', () => {
      const validation = SharedMemoryFactory.validateMemoryRequirements(
        100,
        1000,
        {
          ringBufferSize: 1000,
          bodySampleBufferSize: 5000,
        },
      );

      // Just check that validation runs without error
      expect(typeof validation.valid).toBe('boolean');
      expect(typeof validation.requiredBytes).toBe('number');
      expect(typeof validation.maxBytes).toBe('number');
    });

    it('should handle edge case configurations', () => {
      const validation = SharedMemoryFactory.validateMemoryRequirements(1, 1);

      expect(validation.valid).toBe(true);
      expect(validation.requiredBytes).toBeGreaterThan(0);
    });
  });

  describe('createManagersSafe', () => {
    it('should create managers safely for valid configuration', () => {
      const result = SharedMemoryFactory.createManagersSafe(2, mockEndpoints);

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.hdrHistogram).toHaveLength(2);
        expect(result.workerState).toBeDefined();
      }
    });

    it('should handle memory validation appropriately', () => {
      const result = SharedMemoryFactory.createManagersSafe(
        50,
        Array(500).fill(mockEndpoints[0]),
        {
          ringBufferSize: 1000,
          bodySampleBufferSize: 5000,
        },
      );

      // Check that the function runs without throwing
      expect(result).toBeDefined();
    });

    it('should handle empty endpoints array', () => {
      const result = SharedMemoryFactory.createManagersSafe(2, []);

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.bodySample).toHaveLength(0);
        expect(result.endpointState.getTotalEndpoints()).toBe(0);
      }
    });
  });

  describe('getEndpointWorkerMapping', () => {
    it('should return correct mapping for even distribution', () => {
      const mapping = SharedMemoryFactory.getEndpointWorkerMapping(
        3,
        mockEndpoints,
      );

      expect(mapping).toEqual([0, 1, 2, 0]);
    });

    it('should return correct mapping for single worker', () => {
      const mapping = SharedMemoryFactory.getEndpointWorkerMapping(
        1,
        mockEndpoints,
      );

      expect(mapping).toEqual([0, 0, 0, 0]);
    });

    it('should return correct mapping for more workers than endpoints', () => {
      const mapping = SharedMemoryFactory.getEndpointWorkerMapping(
        6,
        mockEndpoints,
      );

      expect(mapping).toEqual([0, 1, 2, 3]);
    });

    it('should handle empty endpoints', () => {
      const mapping = SharedMemoryFactory.getEndpointWorkerMapping(3, []);

      expect(mapping).toEqual([]);
    });
  });

  describe('getWorkerEndpointOffset', () => {
    it('should return correct offset for even distribution', () => {
      const offset0 = SharedMemoryFactory.getWorkerEndpointOffset(0, 3, 6);
      const offset1 = SharedMemoryFactory.getWorkerEndpointOffset(1, 3, 6);
      const offset2 = SharedMemoryFactory.getWorkerEndpointOffset(2, 3, 6);

      expect(offset0).toBe(0);
      expect(offset1).toBe(2);
      expect(offset2).toBe(4);
    });

    it('should handle uneven distribution', () => {
      const offset0 = SharedMemoryFactory.getWorkerEndpointOffset(0, 3, 7);
      const offset1 = SharedMemoryFactory.getWorkerEndpointOffset(1, 3, 7);
      const offset2 = SharedMemoryFactory.getWorkerEndpointOffset(2, 3, 7);

      expect(offset0).toBe(0);
      expect(offset1).toBe(3);
      expect(offset2).toBe(5);
    });

    it('should handle single worker', () => {
      const offset0 = SharedMemoryFactory.getWorkerEndpointOffset(0, 1, 5);

      expect(offset0).toBe(0);
    });

    it('should handle more workers than endpoints', () => {
      const offset0 = SharedMemoryFactory.getWorkerEndpointOffset(0, 10, 3);
      const offset1 = SharedMemoryFactory.getWorkerEndpointOffset(1, 10, 3);
      const offset2 = SharedMemoryFactory.getWorkerEndpointOffset(2, 10, 3);

      expect(offset0).toBe(0);
      expect(offset1).toBe(1);
      expect(offset2).toBe(2);
    });
  });

  describe('integration tests', () => {
    it('should create consistent configuration across all managers', () => {
      const workersCount = 3;
      const endpoints = mockEndpoints;

      const result = SharedMemoryFactory.createManagers(
        workersCount,
        endpoints,
        {
          significantFigures: 3,
          lowestTrackableValue: 1,
          highestTrackableValue: 60_000_000,
          ringBufferSize: 100,
          bodySampleBufferSize: 1000,
        },
      );

      // Verify all managers are created successfully
      expect(result.hdrHistogram).toHaveLength(workersCount);
      expect(result.statsCounter).toHaveLength(workersCount);

      // Verify endpoint counts match
      const totalEndpoints = endpoints.length;
      expect(result.endpointState.getTotalEndpoints()).toBe(totalEndpoints);
      expect(result.bodySample).toHaveLength(totalEndpoints);
    });

    it('should handle realistic load testing configuration', () => {
      // Simulate a realistic load testing scenario
      const workersCount = 8;
      const endpoints = Array(50)
        .fill(null)
        .map((_, i) => ({
          url: `http://api.example.com/endpoint/${i}`,
          method: 'GET' as const,
          payload: {},
          headers: {},
          rps: 10,
        }));

      const result = SharedMemoryFactory.createManagers(
        workersCount,
        endpoints,
        {
          significantFigures: 3,
          ringBufferSize: 200,
          bodySampleBufferSize: 2000,
        },
      );

      expect(result.hdrHistogram).toHaveLength(workersCount);
      expect(result.statsCounter).toHaveLength(workersCount);
      expect(result.bodySample).toHaveLength(endpoints.length);

      // Verify memory usage is reasonable
      const memoryUsage = SharedMemoryFactory.calculateMemoryUsage(
        workersCount,
        endpoints.length,
        {
          significantFigures: 3,
          ringBufferSize: 200,
          bodySampleBufferSize: 2000,
        },
      );

      expect(memoryUsage).toBeLessThan(2 * 1024 * 1024 * 1024); // Less than 2GB
    });
  });
});
