import { afterEach, describe, expect, it, vi } from 'vitest';

import { Distribution } from '../src/stats/distribution';

vi.mock('chalk', () => ({
  default: {
    green: (str: string): string => str,
    yellow: (str: string): string => str,
    red: (str: string): string => str,
  },
}));

describe('Distribution', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getLatencyDistribution', () => {
    it('should return an empty array for no latencies', () => {
      const distribution = new Distribution();
      expect(distribution.getLatencyDistribution({ count: 10 })).toEqual([]);
    });

    it('should correctly bucket latencies', () => {
      const distribution = new Distribution();
      const testLatencies = [10, 20, 25, 30, 100, 110];
      testLatencies.forEach((l) => distribution.add(l));
      const result = distribution.getLatencyDistribution({ count: 3 });

      expect(result).toHaveLength(3);

      // Verify buckets are created and contain expected data
      expect(result[0].count).toBe('4'); // First bucket has 4 values
      expect(result[1].count).toBe('0'); // Middle bucket is empty
      expect(result[2].count).toBe('2'); // Last bucket has 2 values

      // Verify the format is correct (range strings)
      expect(result[0].latency).toMatch(/^\d+-\d+$/);
      expect(result[1].latency).toMatch(/^\d+-\d+$/);
      expect(result[2].latency).toMatch(/^\d+\+$/);
    });

    it('should handle a single latency value', () => {
      const distribution = new Distribution();
      distribution.add(100);
      const result = distribution.getLatencyDistribution({ count: 3 });
      expect(result).toHaveLength(3);
      expect(result[0].count).toBe('1');
      expect(result[1].count).toBe('0');
      expect(result[2].count).toBe('0');
    });

    it('should handle all latencies being the same', () => {
      const distribution = new Distribution();
      [50, 50, 50, 50].forEach((l) => distribution.add(l));
      const result = distribution.getLatencyDistribution({ count: 4 });
      // All should fall in the first bucket
      expect(result[0].count).toBe('4');
    });
  });
});
