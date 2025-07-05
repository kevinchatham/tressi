import { describe, expect,it } from 'vitest';

import { average, percentile } from '../src/stats';

/**
 * Test suite for the statistics utility functions.
 */
describe('stats', () => {
  /**
   * Tests for the `average` function.
   */
  describe('average', () => {
    /**
     * It should return 0 when given an empty array to prevent division by zero.
     */
    it('should return 0 for an empty array', () => {
      expect(average([])).toBe(0);
    });

    /**
     * It should correctly calculate the arithmetic mean of an array of positive numbers.
     */
    it('should calculate the average of an array of numbers', () => {
      expect(average([1, 2, 3, 4, 5])).toBe(3);
    });

    /**
     * It should also correctly calculate the arithmetic mean of an array of negative numbers.
     */
    it('should handle negative numbers', () => {
      expect(average([-1, -2, -3, -4, -5])).toBe(-3);
    });
  });

  /**
   * Tests for the `percentile` function.
   */
  describe('percentile', () => {
    /**
     * It should return 0 for an empty array to avoid errors.
     */
    it('should return 0 for an empty array', () => {
      expect(percentile([], 95)).toBe(0);
    });

    /**
     * It should correctly find the value at the 95th percentile.
     */
    it('should calculate the 95th percentile', () => {
      const data = Array.from({ length: 100 }, (_, i) => i + 1);
      expect(percentile(data, 95)).toBe(96);
    });

    /**
     * It should correctly find the value at the 99th percentile.
     */
    it('should calculate the 99th percentile', () => {
      const data = Array.from({ length: 100 }, (_, i) => i + 1);
      expect(percentile(data, 99)).toBe(100);
    });

    /**
     * It should correctly find the value at the 50th percentile, which is the median.
     */
    it('should calculate the 50th percentile (median)', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(percentile(data, 50)).toBe(6);
    });

    /**
     * It should handle a single-element array correctly, returning that element.
     */
    it('should handle an array with a single element', () => {
      expect(percentile([10], 95)).toBe(10);
    });
  });
}); 