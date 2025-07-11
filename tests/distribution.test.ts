import { afterEach, describe, expect, it, vi } from 'vitest';

import { Distribution } from '../src/distribution';

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
      [10, 20, 25, 30, 100, 110].forEach(l => distribution.add(l));
      const result = distribution.getLatencyDistribution({ count: 3 });

      expect(result).toHaveLength(3);

      // Bucket 1: 10-43. Contains 10, 20, 25, 30. Count = 4
      expect(result[0].latency).toBe('10-43');
      expect(result[0].count).toBe('4');

      // Bucket 2: 44-77. Contains none. Count = 0
      expect(result[1].latency).toBe('44-77');
      expect(result[1].count).toBe('0');

      // Bucket 3: 78+. Contains 100, 110. Count = 2
      expect(result[2].latency).toBe('78+');
      expect(result[2].count).toBe('2');
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
      [50, 50, 50, 50].forEach(l => distribution.add(l));
      const result = distribution.getLatencyDistribution({ count: 4 });
      // All should fall in the first bucket
      expect(result[0].count).toBe('4');
    });
  });
});


