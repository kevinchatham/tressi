import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getLatencyDistribution,
  getStatusCodeDistribution,
} from '../src/distribution';

vi.mock('chalk', () => ({
  default: {
    green: (str: string): string => str,
    yellow: (str: string): string => str,
    red: (str: string): string => str,
  },
}));

describe('distribution', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getLatencyDistribution', () => {
    it('should return an empty array for no latencies', () => {
      expect(getLatencyDistribution([])).toEqual([]);
    });

    it('should correctly bucket latencies', () => {
      const latencies = [10, 20, 25, 30, 100, 110]; // min 10, max 110, range 100
      const distribution = getLatencyDistribution(latencies, 3); // bucketSize = ceil(100/3) = 34

      expect(distribution).toHaveLength(3);

      // Bucket 1: 10-43. Contains 10, 20, 25, 30. Count = 4
      expect(distribution[0]).toEqual({
        range: '10-43',
        count: '4',
        percent: '66.7%',
        cumulative: '66.7%',
        chart: '',
      });

      // Bucket 2: 44-77. Contains none. Count = 0
      expect(distribution[1]).toEqual({
        range: '44-77',
        count: '0',
        percent: '0.0%',
        cumulative: '66.7%',
        chart: '',
      });

      // Bucket 3: 78+. Contains 100, 110. Count = 2
      expect(distribution[2]).toEqual({
        range: '78+',
        count: '2',
        percent: '33.3%',
        cumulative: '100.0%',
        chart: '',
      });
    });

    it('should handle a single latency value', () => {
      // min 100, max 100, range 0, bucketSize = 1
      const distribution = getLatencyDistribution([100], 3);
      expect(distribution).toHaveLength(3);
      // Bucket 1: 100-100. Count 1
      expect(distribution[0].count).toBe('1');
      // Other buckets empty
      expect(distribution[1].count).toBe('0');
      expect(distribution[2].count).toBe('0');
    });

    it('should handle all latencies being the same', () => {
      const latencies = [50, 50, 50, 50];
      const distribution = getLatencyDistribution(latencies, 4);
      // All should fall in the first bucket
      expect(distribution[0].count).toBe('4');
      expect(distribution[1].count).toBe('0');
      expect(distribution[2].count).toBe('0');
      expect(distribution[3].count).toBe('0');
    });
  });

  describe('getStatusCodeDistribution', () => {
    it('should return an empty array for no status codes', () => {
      expect(getStatusCodeDistribution({})).toEqual([]);
    });

    it('should correctly calculate status code distribution and charts', () => {
      const statusCodeMap = {
        200: 80, // green
        302: 3, // yellow
        404: 15, // red
        500: 5, // red
      };
      // total = 103, maxCount = 80
      const distribution = getStatusCodeDistribution(statusCodeMap);

      expect(distribution).toHaveLength(4);

      const s200 = distribution.find((d) => d.code === '200');
      expect(s200?.count).toBe('80');
      expect(s200?.percent).toBe('77.7%');
      expect(s200?.chart.length).toBe(15); // round(80/80 * 15) = 15

      const s302 = distribution.find((d) => d.code === '302');
      expect(s302?.count).toBe('3');
      expect(s302?.percent).toBe('2.9%');
      expect(s302?.chart.length).toBe(1); // round(3/80 * 15) = round(0.56) = 1

      const s404 = distribution.find((d) => d.code === '404');
      expect(s404?.count).toBe('15');
      expect(s404?.percent).toBe('14.6%');
      expect(s404?.chart.length).toBe(3); // round(15/80 * 15) = round(2.81) = 3

      const s500 = distribution.find((d) => d.code === '500');
      expect(s500?.count).toBe('5');
      expect(s500?.percent).toBe('4.9%');
      expect(s500?.chart.length).toBe(1); // round(5/80 * 15) = round(0.93) = 1
    });

    it('should handle zero counts correctly', () => {
      const statusCodeMap = {
        200: 10,
        404: 0,
      };
      const distribution = getStatusCodeDistribution(statusCodeMap);
      expect(distribution).toHaveLength(2);
      const s404 = distribution.find((d) => d.code === '404');
      expect(s404?.count).toBe('0');
      expect(s404?.percent).toBe('0.0%');
      expect(s404?.chart).toBe('');
    });
  });
});
