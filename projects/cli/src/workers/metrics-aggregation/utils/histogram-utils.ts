import { EMPTY_HISTOGRAM } from '@tressi/shared/cli';
import type { LatencyHistogram } from '@tressi/shared/common';

export function convertWorkerHistogramToTestSummaryHistogram(
  histograms: LatencyHistogram[],
): LatencyHistogram | undefined {
  if (!histograms || histograms.length === 0) {
    return undefined;
  }

  let totalCount = 0;
  let min = Infinity;
  let max = 0;
  let weightedMeanSum = 0;
  let weightedStdDevSum = 0;

  const percentiles: Record<number, number> = {
    1: 0,
    5: 0,
    10: 0,
    25: 0,
    50: 0,
    75: 0,
    90: 0,
    95: 0,
    99: 0,
  };

  histograms.forEach((histogram) => {
    totalCount += histogram.totalCount;
    min = Math.min(min, histogram.min);
    max = Math.max(max, histogram.max);
  });

  if (totalCount === 0) {
    return undefined;
  }

  Object.keys(percentiles).forEach((p) => {
    const percentile = Number.parseFloat(p);
    let weightedValue = 0;

    histograms.forEach((histogram) => {
      const weight = histogram.totalCount / totalCount;
      weightedValue += (histogram.percentiles[percentile] || 0) * weight;
    });

    percentiles[percentile] = weightedValue;
  });

  histograms.forEach((histogram) => {
    const weight = histogram.totalCount / totalCount;
    weightedMeanSum += histogram.mean * weight;
    weightedStdDevSum += histogram.stdDev * weight;
  });

  const numBuckets = 10;
  const buckets: { lowerBound: number; upperBound: number; count: number }[] = [];

  if (totalCount > 0) {
    if (max > min) {
      const logMin = Math.log10(min + 1);
      const logMax = Math.log10(max + 1);
      const logRange = logMax - logMin;
      const logBucketSize = logRange / numBuckets;

      for (let i = 0; i < numBuckets; i++) {
        const lowerLog = logMin + i * logBucketSize;
        const upperLog = logMin + (i + 1) * logBucketSize;

        buckets.push({
          count: 0,
          lowerBound: 10 ** lowerLog - 1,
          upperBound: 10 ** upperLog - 1,
        });
      }

      histograms.forEach((h) => {
        h.buckets?.forEach((b) => {
          const midpoint = (b.lowerBound + b.upperBound) / 2;
          const logMidpoint = Math.log10(midpoint + 1);
          let bucketIndex = Math.floor((logMidpoint - logMin) / logBucketSize);

          if (bucketIndex >= numBuckets) {
            bucketIndex = numBuckets - 1;
          }
          if (bucketIndex < 0) {
            bucketIndex = 0;
          }

          buckets[bucketIndex].count += b.count;
        });
      });

      const totalBucketCount = buckets.reduce((sum, b) => sum + b.count, 0);
      if (totalBucketCount < totalCount) {
        buckets[numBuckets - 1].count += totalCount - totalBucketCount;
      } else if (buckets[numBuckets - 1].count === 0 && totalCount > 0) {
        let largestBucketIndex = 0;
        for (let i = 1; i < numBuckets; i++) {
          if (buckets[i].count > buckets[largestBucketIndex].count) {
            largestBucketIndex = i;
          }
        }
        if (buckets[largestBucketIndex].count > 0) {
          buckets[largestBucketIndex].count--;
          buckets[numBuckets - 1].count++;
        }
      }
    } else {
      buckets.push({
        count: totalCount,
        lowerBound: min,
        upperBound: max,
      });
    }
  }

  return {
    buckets,
    max,
    mean: weightedMeanSum,
    min,
    percentiles,
    stdDev: weightedStdDevSum,
    totalCount,
  };
}

export function getEmptyHistogram(): LatencyHistogram {
  return { ...EMPTY_HISTOGRAM };
}
