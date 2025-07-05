import { describe, expect,it } from 'vitest';

import { average, percentile } from '../src/stats';

describe('stats', () => {
  describe('average', () => {
    it('should return 0 for an empty array', () => {
      expect(average([])).toBe(0);
    });

    it('should calculate the average of an array of numbers', () => {
      expect(average([1, 2, 3, 4, 5])).toBe(3);
    });

    it('should handle negative numbers', () => {
      expect(average([-1, -2, -3, -4, -5])).toBe(-3);
    });
  });

  describe('percentile', () => {
    it('should return 0 for an empty array', () => {
      expect(percentile([], 95)).toBe(0);
    });

    it('should calculate the 95th percentile', () => {
      const data = Array.from({ length: 100 }, (_, i) => i + 1);
      expect(percentile(data, 95)).toBe(96);
    });

    it('should calculate the 99th percentile', () => {
      const data = Array.from({ length: 100 }, (_, i) => i + 1);
      expect(percentile(data, 99)).toBe(100);
    });

    it('should calculate the 50th percentile (median)', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(percentile(data, 50)).toBe(6);
    });

    it('should handle an array with a single element', () => {
      expect(percentile([10], 95)).toBe(10);
    });
  });
}); 