import { describe, expect, it } from 'vitest';

import { convertWorkerHistogramToTestSummaryHistogram } from './histogram-utils';

describe('HistogramUtils', () => {
  describe('convertWorkerHistogramToTestSummaryHistogram', () => {
    it('should return undefined for empty input', () => {
      expect(convertWorkerHistogramToTestSummaryHistogram([])).toBeUndefined();
    });

    it('should merge multiple histograms into one', () => {
      const histograms = [
        {
          buckets: [{ count: 10, lowerBound: 0, upperBound: 100 }],
          max: 100,
          mean: 50,
          min: 10,
          percentiles: { 50: 50 },
          stdDev: 5,
          totalCount: 10,
        },
        {
          buckets: [{ count: 10, lowerBound: 0, upperBound: 200 }],
          max: 200,
          mean: 110,
          min: 20,
          percentiles: { 50: 110 },
          stdDev: 10,
          totalCount: 10,
        },
      ];

      const result = convertWorkerHistogramToTestSummaryHistogram(histograms);
      expect(result).toBeDefined();
      expect(result!.totalCount).toBe(20);
      expect(result!.min).toBe(10);
      expect(result!.max).toBe(200);
      expect(result!.mean).toBe(80); // (50+110)/2
      expect(result!.stdDev).toBe(7.5); // (5+10)/2
      expect(result!.percentiles[50]).toBe(80); // (50+110)/2
      expect(result!.buckets).toHaveLength(10); // Log buckets
    });
  });
});
