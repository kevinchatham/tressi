import { describe, expect, it } from 'vitest';

import { BodySampleManager } from '../../../../src/workers/shared-memory/body-sample-manager';

describe('BodySampleManager', () => {
  describe('constructor', () => {
    it('should initialize with default buffer size', () => {
      const manager = new BodySampleManager(3);

      expect(manager.getEndpointsCount()).toBe(3);
      expect(manager.getSharedBuffer()).toBeInstanceOf(SharedArrayBuffer);
    });

    it('should initialize with custom buffer size', () => {
      const manager = new BodySampleManager(2, 50);

      expect(manager.getEndpointsCount()).toBe(2);
    });

    it('should use external buffer when provided', () => {
      const endpointsCount = 2;
      const bufferSize = 10;
      const manager = new BodySampleManager(endpointsCount, bufferSize);

      const sabSize = manager.getSharedBuffer().byteLength;
      const externalBuffer = new SharedArrayBuffer(sabSize);

      const manager2 = new BodySampleManager(
        endpointsCount,
        bufferSize,
        externalBuffer,
      );

      expect(manager2.getSharedBuffer()).toBe(externalBuffer);
    });

    it('should throw error when external buffer is too small', () => {
      const smallBuffer = new SharedArrayBuffer(100);

      expect(() => new BodySampleManager(5, 1000, smallBuffer)).toThrow(
        'Buffer too small',
      );
    });

    it('should initialize buffer with empty values', () => {
      const manager = new BodySampleManager(1, 5);

      const samples = manager.getBodySampleIndices(0);
      expect(samples).toEqual([]);
    });
  });

  describe('recordBodySample', () => {
    it('should record body samples successfully', () => {
      const manager = new BodySampleManager(1, 5);

      const result1 = manager.recordBodySample(0, 1, 200);
      const result2 = manager.recordBodySample(0, 2, 404);

      expect(result1).toBe(true);
      expect(result2).toBe(true);

      const samples = manager.getBodySampleIndices(0);
      expect(samples).toHaveLength(2);
      expect(samples[0]).toEqual({ sampleIndex: 1, statusCode: 200 });
      expect(samples[1]).toEqual({ sampleIndex: 2, statusCode: 404 });
    });

    it('should return false when buffer is full', () => {
      const manager = new BodySampleManager(1, 3);

      // Fill the buffer - can hold 2 items (bufferSize - 1)
      expect(manager.recordBodySample(0, 1, 200)).toBe(true);
      expect(manager.recordBodySample(0, 2, 404)).toBe(true);

      // Verify buffer has 2 items
      const samples = manager.getBodySampleIndices(0);
      expect(samples).toHaveLength(2);

      // Next record should fail
      expect(manager.recordBodySample(0, 3, 500)).toBe(false);
    });

    it('should throw error for invalid endpoint index', () => {
      const manager = new BodySampleManager(3);

      expect(() => manager.recordBodySample(-1, 1, 200)).toThrow(
        'Invalid endpoint index: -1',
      );
      expect(() => manager.recordBodySample(3, 1, 200)).toThrow(
        'Invalid endpoint index: 3',
      );
    });

    it('should handle ring buffer wraparound correctly', () => {
      const manager = new BodySampleManager(1, 3);

      // Fill buffer to capacity (2 items)
      manager.recordBodySample(0, 1, 200);
      manager.recordBodySample(0, 2, 404);

      // Read all samples
      const samples1 = manager.getBodySampleIndices(0);
      expect(samples1).toHaveLength(2);

      // Clear the buffer
      manager.clearBodySamples(0);

      // Add new samples after clear
      manager.recordBodySample(0, 4, 503);
      manager.recordBodySample(0, 5, 404);

      const samples2 = manager.getBodySampleIndices(0);
      expect(samples2).toHaveLength(2);
      expect(samples2[0]).toEqual({ sampleIndex: 4, statusCode: 503 });
      expect(samples2[1]).toEqual({ sampleIndex: 5, statusCode: 404 });
    });
  });

  describe('getBodySampleIndices', () => {
    it('should return samples in correct order', () => {
      const manager = new BodySampleManager(1, 5);

      manager.recordBodySample(0, 1, 200);
      manager.recordBodySample(0, 2, 404);
      manager.recordBodySample(0, 3, 500);

      const samples = manager.getBodySampleIndices(0);

      expect(samples).toHaveLength(3);
      expect(samples[0]).toEqual({ sampleIndex: 1, statusCode: 200 });
      expect(samples[1]).toEqual({ sampleIndex: 2, statusCode: 404 });
      expect(samples[2]).toEqual({ sampleIndex: 3, statusCode: 500 });
    });

    it('should handle empty buffer', () => {
      const manager = new BodySampleManager(1, 5);

      const samples = manager.getBodySampleIndices(0);

      expect(samples).toEqual([]);
    });

    it('should throw error for invalid endpoint index', () => {
      const manager = new BodySampleManager(3);

      expect(() => manager.getBodySampleIndices(-1)).toThrow(
        'Invalid endpoint index: -1',
      );
      expect(() => manager.getBodySampleIndices(3)).toThrow(
        'Invalid endpoint index: 3',
      );
    });

    it('should handle buffer wraparound correctly', () => {
      const manager = new BodySampleManager(1, 3);

      // Fill buffer completely (2 items)
      manager.recordBodySample(0, 1, 200);
      manager.recordBodySample(0, 2, 404);

      // Read samples
      const samples1 = manager.getBodySampleIndices(0);
      expect(samples1).toHaveLength(2);

      // Clear and add new samples
      manager.clearBodySamples(0);
      manager.recordBodySample(0, 4, 503);
      manager.recordBodySample(0, 5, 404);

      const samples2 = manager.getBodySampleIndices(0);
      expect(samples2).toHaveLength(2);
    });
  });

  describe('clearBodySamples', () => {
    it('should clear all samples for an endpoint', () => {
      const manager = new BodySampleManager(1, 5);

      // Add some samples
      manager.recordBodySample(0, 1, 200);
      manager.recordBodySample(0, 2, 404);

      expect(manager.getBodySampleIndices(0)).toHaveLength(2);

      // Clear samples
      manager.clearBodySamples(0);

      expect(manager.getBodySampleIndices(0)).toEqual([]);
    });

    it('should throw error for invalid endpoint index', () => {
      const manager = new BodySampleManager(3);

      expect(() => manager.clearBodySamples(-1)).toThrow(
        'Invalid endpoint index: -1',
      );
      expect(() => manager.clearBodySamples(3)).toThrow(
        'Invalid endpoint index: 3',
      );
    });
  });

  describe('buffer capacity testing', () => {
    it('should handle buffer capacity correctly', () => {
      const manager = new BodySampleManager(1, 3);

      // Fill buffer to capacity (2 items)
      expect(manager.recordBodySample(0, 1, 200)).toBe(true);
      expect(manager.recordBodySample(0, 2, 404)).toBe(true);

      // Verify we have 2 items
      const samples = manager.getBodySampleIndices(0);
      expect(samples).toHaveLength(2);

      // Next record should fail
      expect(manager.recordBodySample(0, 3, 500)).toBe(false);
    });
  });

  describe('concurrent access simulation', () => {
    it('should handle multiple endpoints independently', () => {
      const manager = new BodySampleManager(3, 5);

      // Add samples to different endpoints
      manager.recordBodySample(0, 1, 200);
      manager.recordBodySample(1, 2, 404);
      manager.recordBodySample(2, 3, 500);

      const samples0 = manager.getBodySampleIndices(0);
      const samples1 = manager.getBodySampleIndices(1);
      const samples2 = manager.getBodySampleIndices(2);

      expect(samples0).toEqual([{ sampleIndex: 1, statusCode: 200 }]);
      expect(samples1).toEqual([{ sampleIndex: 2, statusCode: 404 }]);
      expect(samples2).toEqual([{ sampleIndex: 3, statusCode: 500 }]);
    });

    it('should maintain isolation between endpoints', () => {
      const manager = new BodySampleManager(2, 3);

      // Fill endpoint 0
      manager.recordBodySample(0, 1, 200);
      manager.recordBodySample(0, 2, 404);

      // Endpoint 1 should still be empty
      expect(manager.getBodySampleIndices(1)).toEqual([]);

      // Add to endpoint 1
      manager.recordBodySample(1, 3, 500);

      // Endpoint 0 should be unchanged
      expect(manager.getBodySampleIndices(0)).toHaveLength(2);
      expect(manager.getBodySampleIndices(1)).toHaveLength(1);
    });
  });
});
