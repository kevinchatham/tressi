import { describe, expect, it } from 'vitest';

import { HdrHistogramManager } from './hdr-histogram-manager';

describe('HdrHistogramManager', () => {
  describe('constructor', () => {
    it('should initialize with default parameters', () => {
      const manager = new HdrHistogramManager(5);

      expect(manager.getSharedBuffer()).toBeInstanceOf(SharedArrayBuffer);
    });

    it('should initialize with custom parameters', () => {
      const manager = new HdrHistogramManager(3, 2, 10, 1_000_000);

      // Verify it works by recording and retrieving data
      manager.recordLatency(0, 100);
      const histogram = manager.getLatencyHistogram(0);
      expect(histogram.totalCount).toBe(1);
    });

    it('should use external buffer when provided', () => {
      const endpointsCount = 2;
      const manager = new HdrHistogramManager(endpointsCount);

      const sabSize = manager.getSharedBuffer().byteLength;
      const externalBuffer = new SharedArrayBuffer(sabSize);

      const manager2 = new HdrHistogramManager(
        endpointsCount,
        3,
        1,
        120_000_000,
        externalBuffer,
      );

      expect(manager2.getSharedBuffer()).toBe(externalBuffer);
    });

    it('should throw error when external buffer is too small', () => {
      const smallBuffer = new SharedArrayBuffer(100);

      expect(
        () => new HdrHistogramManager(5, 3, 1, 120_000_000, smallBuffer),
      ).toThrow('Buffer too small');
    });

    it('should not initialize histogram when using external buffer', () => {
      const endpointsCount = 2;
      const manager = new HdrHistogramManager(endpointsCount);

      const sabSize = manager.getSharedBuffer().byteLength;
      const externalBuffer = new SharedArrayBuffer(sabSize);

      // Pre-populate with non-zero values
      const view = new Int32Array(externalBuffer);
      view.fill(42);

      const manager2 = new HdrHistogramManager(
        endpointsCount,
        3,
        1,
        120_000_000,
        externalBuffer,
      );

      const histogram = manager2.getLatencyHistogram(0);
      expect(histogram.totalCount).toBeGreaterThan(0);
    });
  });

  describe('recordLatency', () => {
    it('should record latency values correctly', () => {
      const manager = new HdrHistogramManager(2);

      manager.recordLatency(0, 100.5); // 100.5ms
      manager.recordLatency(0, 200.25); // 200.25ms
      manager.recordLatency(1, 50.75); // 50.75ms

      const histogram0 = manager.getLatencyHistogram(0);
      const histogram1 = manager.getLatencyHistogram(1);

      expect(histogram0.totalCount).toBe(2);
      expect(histogram1.totalCount).toBe(1);
    });

    it('should handle zero latency', () => {
      const manager = new HdrHistogramManager(1);

      manager.recordLatency(0, 0);

      const histogram = manager.getLatencyHistogram(0);
      expect(histogram.totalCount).toBe(1);
      expect(histogram.min).toBe(0);
    });

    it('should ignore negative latency values', () => {
      const manager = new HdrHistogramManager(1);

      manager.recordLatency(0, -100);

      const histogram = manager.getLatencyHistogram(0);
      expect(histogram.totalCount).toBe(0);
    });

    it('should ignore non-finite latency values', () => {
      const manager = new HdrHistogramManager(1);

      manager.recordLatency(0, Infinity);
      manager.recordLatency(0, -Infinity);
      manager.recordLatency(0, NaN);

      const histogram = manager.getLatencyHistogram(0);
      expect(histogram.totalCount).toBe(0);
    });

    it('should handle very large latency values', () => {
      const manager = new HdrHistogramManager(1, 3, 1, 120_000_000);

      manager.recordLatency(0, 60_000); // 60 seconds

      const histogram = manager.getLatencyHistogram(0);
      expect(histogram.totalCount).toBe(1);
      // HDR histogram uses quantized values, so we check it's in the right ballpark
      expect(histogram.max).toBeGreaterThan(50_000);
      expect(histogram.max).toBeLessThanOrEqual(120_000_000);
    });

    it('should throw error for invalid endpoint index', () => {
      const manager = new HdrHistogramManager(3);

      expect(() => manager.recordLatency(-1, 100)).toThrow(
        'Invalid endpoint index: -1',
      );
      expect(() => manager.recordLatency(3, 100)).toThrow(
        'Invalid endpoint index: 3',
      );
    });
  });

  describe('getLatencyHistogram', () => {
    it('should return empty histogram for no data', () => {
      const manager = new HdrHistogramManager(2);

      const histogram = manager.getLatencyHistogram(0);

      expect(histogram.totalCount).toBe(0);
      expect(histogram.min).toBe(0);
      expect(histogram.max).toBe(0);
      expect(histogram.mean).toBe(0);
      expect(histogram.stdDev).toBe(0);
      expect(histogram.percentiles).toEqual({});
    });

    it('should calculate correct histogram statistics', () => {
      const manager = new HdrHistogramManager(1);

      // Record some test latencies
      const latencies = [50, 75, 100, 125, 150, 175, 200, 225, 250, 275];
      latencies.forEach((latency) => manager.recordLatency(0, latency));

      const histogram = manager.getLatencyHistogram(0);

      expect(histogram.totalCount).toBe(10);
      expect(histogram.min).toBeGreaterThan(0);
      expect(histogram.max).toBeGreaterThan(0);
      expect(histogram.mean).toBeGreaterThan(0);
      expect(histogram.stdDev).toBeGreaterThanOrEqual(0);
    });

    it('should calculate percentiles correctly', () => {
      const manager = new HdrHistogramManager(1);

      // Record 100 latencies from 1ms to 100ms
      for (let i = 1; i <= 100; i++) {
        manager.recordLatency(0, i);
      }

      const histogram = manager.getLatencyHistogram(0);

      expect(histogram.percentiles[50]).toBeGreaterThan(0);
      expect(histogram.percentiles[75]).toBeGreaterThan(0);
      expect(histogram.percentiles[90]).toBeGreaterThan(0);
      expect(histogram.percentiles[95]).toBeGreaterThan(0);
      expect(histogram.percentiles[99]).toBeGreaterThan(0);
      expect(histogram.percentiles[99.9]).toBeGreaterThan(0);
    });

    it('should handle single value correctly', () => {
      const manager = new HdrHistogramManager(1);

      manager.recordLatency(0, 100);

      const histogram = manager.getLatencyHistogram(0);

      expect(histogram.totalCount).toBe(1);
      expect(histogram.min).toBeGreaterThan(0);
      expect(histogram.max).toBeGreaterThan(0);
      expect(histogram.mean).toBeGreaterThan(0);
      expect(histogram.stdDev).toBeGreaterThanOrEqual(0);
    });

    it('should throw error for invalid endpoint index', () => {
      const manager = new HdrHistogramManager(3);

      expect(() => manager.getLatencyHistogram(-1)).toThrow(
        'Invalid endpoint index: -1',
      );
      expect(() => manager.getLatencyHistogram(3)).toThrow(
        'Invalid endpoint index: 3',
      );
    });
  });

  describe('percentile calculation', () => {
    it('should calculate percentiles correctly from histogram', () => {
      const manager = new HdrHistogramManager(1);

      // Record known distribution
      for (let i = 1; i <= 100; i++) {
        manager.recordLatency(0, i);
      }

      const histogram = manager.getLatencyHistogram(0);

      expect(histogram.percentiles[50]).toBeGreaterThan(0);
      expect(histogram.percentiles[90]).toBeGreaterThan(0);
      expect(histogram.percentiles[95]).toBeGreaterThan(0);
    });

    it('should return 0 percentiles for no data', () => {
      const manager = new HdrHistogramManager(1);

      const histogram = manager.getLatencyHistogram(0);

      expect(histogram.percentiles[50]).toBeUndefined();
      expect(histogram.percentiles[95]).toBeUndefined();
    });

    it('should handle fractional percentiles in histogram', () => {
      const manager = new HdrHistogramManager(1);

      manager.recordLatency(0, 100);

      const histogram = manager.getLatencyHistogram(0);
      expect(histogram.percentiles[50]).toBeGreaterThan(0);
    });
  });

  describe('configuration validation', () => {
    it('should handle custom significant figures', () => {
      const manager = new HdrHistogramManager(1, 5);

      // Verify it works by recording and retrieving data
      manager.recordLatency(0, 100);
      const histogram = manager.getLatencyHistogram(0);
      expect(histogram.totalCount).toBe(1);
    });

    it('should handle custom value ranges', () => {
      const manager = new HdrHistogramManager(1, 3, 100, 10_000);

      // Verify it works by recording and retrieving data
      manager.recordLatency(0, 500);
      const histogram = manager.getLatencyHistogram(0);
      expect(histogram.totalCount).toBe(1);
    });

    it('should handle edge case value ranges', () => {
      const manager = new HdrHistogramManager(1, 2, 1, 1);

      // Verify it works by recording and retrieving data
      manager.recordLatency(0, 1);
      const histogram = manager.getLatencyHistogram(0);
      expect(histogram.totalCount).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle very small latencies', () => {
      const manager = new HdrHistogramManager(1, 3, 1, 1000);

      manager.recordLatency(0, 0.001); // 0.001ms
      manager.recordLatency(0, 0.01); // 0.01ms

      const histogram = manager.getLatencyHistogram(0);
      expect(histogram.totalCount).toBe(2);
      expect(histogram.min).toBeGreaterThanOrEqual(0);
    });

    it('should handle latencies at boundaries', () => {
      const manager = new HdrHistogramManager(1, 3, 1, 1000);

      manager.recordLatency(0, 1); // At lowest trackable
      manager.recordLatency(0, 1000); // At highest trackable

      const histogram = manager.getLatencyHistogram(0);
      expect(histogram.totalCount).toBe(2);
      expect(histogram.min).toBeGreaterThan(0);
      expect(histogram.max).toBeGreaterThan(0);
    });

    it('should handle overflow values', () => {
      const manager = new HdrHistogramManager(1, 3, 1, 1000);

      manager.recordLatency(0, 2000); // Above highest trackable

      const histogram = manager.getLatencyHistogram(0);
      expect(histogram.totalCount).toBe(1);
      expect(histogram.max).toBeGreaterThan(0);
    });
  });

  describe('monotonicity and bucket integrity', () => {
    it('should have monotonic getValueFromIndex around the subBucketHalfCount boundary', () => {
      const manager = new HdrHistogramManager(1, 3, 1, 120_000_000);

      // Access private method for testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getValueFromIndex = (manager as any)._getValueFromIndex.bind(
        manager,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subBucketHalfCount = (manager as any)._subBucketHalfCount;

      const valAtBoundaryMinus1 = getValueFromIndex(subBucketHalfCount - 1);
      const valAtBoundary = getValueFromIndex(subBucketHalfCount);
      const valAtBoundaryPlus1 = getValueFromIndex(subBucketHalfCount + 1);

      expect(valAtBoundary).toBeGreaterThanOrEqual(valAtBoundaryMinus1);
      expect(valAtBoundaryPlus1).toBeGreaterThanOrEqual(valAtBoundary);
    });

    it('should calculate percentiles in increasing order', () => {
      const manager = new HdrHistogramManager(1, 3, 1, 120_000_000);

      // Record a distribution that spans the boundary
      for (let i = 1; i <= 2000; i++) {
        manager.recordLatency(0, i / 1000); // 0.001ms to 2ms
      }

      const histogram = manager.getLatencyHistogram(0);
      const p = histogram.percentiles;
      const sortedKeys = Object.keys(p)
        .map(Number)
        .sort((a, b) => a - b);

      for (let i = 1; i < sortedKeys.length; i++) {
        const prevKey = sortedKeys[i - 1];
        const currKey = sortedKeys[i];
        expect(
          p[currKey],
          `p${currKey} (${p[currKey]}) should be >= p${prevKey} (${p[prevKey]})`,
        ).toBeGreaterThanOrEqual(p[prevKey]!);
      }
    });

    it('should produce non-overlapping buckets', () => {
      const manager = new HdrHistogramManager(1, 3, 1, 120_000_000);

      for (let i = 1; i <= 2000; i++) {
        manager.recordLatency(0, i / 1000);
      }

      const histogram = manager.getLatencyHistogram(0);
      const buckets = histogram.buckets;

      for (let i = 1; i < buckets.length; i++) {
        const prev = buckets[i - 1];
        const curr = buckets[i];
        expect(
          curr.lowerBound,
          `Bucket ${i} lowerBound (${curr.lowerBound}) should be >= prev upperBound (${prev.upperBound})`,
        ).toBeGreaterThanOrEqual(prev.upperBound);
      }
    });
  });
});
