import { describe, expect, it } from 'vitest';

import {
  calculateEndpointLatencyStats,
  calculateGlobalLatencyStats,
} from './stats-calculator';

describe('StatsCalculator', () => {
  describe('calculateGlobalLatencyStats', () => {
    it('should return zero stats for empty input', () => {
      const result = calculateGlobalLatencyStats({});
      expect(result.averageLatency).toBe(0);
      expect(result.minLatency).toBe(0);
      expect(result.maxLatency).toBe(0);
    });

    it('should calculate weighted average latency', () => {
      const endpointHistograms = {
        url1: [
          {
            totalCount: 10,
            mean: 100,
            min: 50,
            max: 150,
            percentiles: { 50: 90, 95: 140, 99: 145 },
            stdDev: 10,
            buckets: [],
          },
        ],
        url2: [
          {
            totalCount: 20,
            mean: 200,
            min: 150,
            max: 250,
            percentiles: { 50: 190, 95: 240, 99: 245 },
            stdDev: 20,
            buckets: [],
          },
        ],
      };

      const result = calculateGlobalLatencyStats(endpointHistograms);
      // (10 * 100 + 20 * 200) / 30 = (1000 + 4000) / 30 = 5000 / 30 = 166.66...
      expect(result.averageLatency).toBeCloseTo(166.67, 1);
      expect(result.minLatency).toBe(50);
      expect(result.maxLatency).toBe(250);
      // Weighted percentiles: (10/30 * 90) + (20/30 * 190) = 30 + 126.66 = 156.66
      expect(result.p50Latency).toBeCloseTo(156.67, 1);
    });
  });

  describe('calculateEndpointLatencyStats', () => {
    it('should return zero stats for empty input', () => {
      const result = calculateEndpointLatencyStats([]);
      expect(result.totalCount).toBe(0);
      expect(result.averageLatency).toBe(0);
    });

    it('should calculate stats for multiple histograms of same endpoint', () => {
      const histograms = [
        {
          totalCount: 10,
          mean: 100,
          min: 50,
          max: 150,
          percentiles: { 50: 90, 95: 140, 99: 145 },
          stdDev: 10,
          buckets: [],
        },
        {
          totalCount: 10,
          mean: 200,
          min: 150,
          max: 250,
          percentiles: { 50: 190, 95: 240, 99: 245 },
          stdDev: 20,
          buckets: [],
        },
      ];

      const result = calculateEndpointLatencyStats(histograms);
      expect(result.totalCount).toBe(20);
      expect(result.averageLatency).toBe(150);
      expect(result.minLatency).toBe(50);
      expect(result.maxLatency).toBe(250);
      expect(result.p50Latency).toBe(140); // (90 + 190) / 2
    });
  });
});
