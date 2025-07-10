import chalk from 'chalk';
import { Histogram } from 'hdr-histogram-js';

/**
 * Calculates the latency distribution for a given set of latencies.
 * @param histogram An HDR histogram instance.
 * @param bucketCount The number of buckets to create.
 * @param chartWidth Optional width for the bar chart. If provided, a text-based chart is generated.
 * @returns An array of bucket objects with range, count, percentage, cumulative, and chart values.
 */
export function getLatencyDistribution(
  histogram: Histogram,
  bucketCount = 6,
  chartWidth?: number,
): {
  range: string;
  count: string;
  percent: string;
  cumulative: string;
  chart: string;
}[] {
  if (histogram.totalCount === 0) {
    return [];
  }

  const totalCount = histogram.totalCount;
  const minLatency = histogram.minNonZeroValue;
  const maxLatency = histogram.maxValue;
  const range = maxLatency - minLatency;
  const bucketSize = Math.ceil(range / bucketCount) || 1;

  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const lowerBound = Math.floor(minLatency + i * bucketSize);
    const upperBound = Math.floor(minLatency + (i + 1) * bucketSize - 1);
    return {
      range: `${lowerBound}-${upperBound}`,
      count: 0,
      lowerBound,
      upperBound,
    };
  });

  // Make the last bucket catch all remaining values
  buckets[buckets.length - 1].upperBound = Infinity;
  buckets[buckets.length - 1].range =
    `${buckets[buckets.length - 1].lowerBound}+`;

  const distributionOutput = histogram.outputPercentileDistribution();
  const lines = distributionOutput.split('\n');

  // Skip header and footer lines, focus on data lines
  const dataLines = lines.slice(3, lines.length - 3); // Adjust slice based on actual output

  let cumulativeCount = 0;
  let maxCount = 0;

  dataLines.forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 3) {
      const value = parseFloat(parts[0]);
      const count = parseInt(parts[2]);

      // Find the appropriate bucket for this value
      const targetBucket = buckets.find(b => value >= b.lowerBound && value <= b.upperBound);

      if (targetBucket) {
        targetBucket.count += count;
        if (targetBucket.count > maxCount) {
          maxCount = targetBucket.count;
        }
      }
    }
  });

  return buckets.map((bucket) => {
    const percentOfTotal =
      totalCount > 0 ? (bucket.count / totalCount) * 100 : 0;
    cumulativeCount += bucket.count;
    const cumulativePercent =
      totalCount > 0 ? (cumulativeCount / totalCount) * 100 : 0;

    let chart = '';
    if (chartWidth) {
      const barLength =
        maxCount > 0 ? Math.round((bucket.count / maxCount) * chartWidth) : 0;
      chart = '█'.repeat(barLength);
    }

    return {
      range: bucket.range,
      count: bucket.count.toString(),
      percent: `${percentOfTotal.toFixed(0)}%`,
      cumulative: `${cumulativePercent.toFixed(0)}%`,
      chart,
    };
  });
}
export function getStatusCodeDistribution(
  statusCodeMap: Record<number, number>,
): { code: string; count: string; percent: string; chart: string }[] {
  const totalCount = Object.values(statusCodeMap).reduce(
    (sum, count) => sum + count,
    0,
  );

  if (totalCount === 0) {
    return [];
  }

  const maxCount = Math.max(...Object.values(statusCodeMap));

  return Object.entries(statusCodeMap)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([code, count]) => {
      const percent = (count / totalCount) * 100;
      const chartBarCount =
        maxCount > 0 ? Math.round((count / maxCount) * 15) : 0;

      const numericCode = Number(code);
      let chartColor = chalk.green;
      if (numericCode >= 500) {
        chartColor = chalk.red;
      } else if (numericCode >= 400) {
        chartColor = chalk.red;
      } else if (numericCode >= 300) {
        chartColor = chalk.yellow;
      }

      const chart = chartColor('█'.repeat(chartBarCount));

      return {
        code,
        count: count.toString(),
        percent: `${percent.toFixed(0)}%`,
        chart,
      };
    });
}

/**
 * Aggregates a status code map into standard categories (2xx, 3xx, 4xx, 5xx).
 * @param statusCodeMap A record where keys are status codes and values are their counts.
 * @returns An object containing the counts for each status code category.
 */
export function getStatusCodeDistributionByCategory(
  statusCodeMap: Record<number, number>,
): {
  '2xx': number;
  '3xx': number;
  '4xx': number;
  '5xx': number;
  other: number;
} {
  const distribution = {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
    other: 0,
  };

  for (const [codeStr, count] of Object.entries(statusCodeMap)) {
    const code = Number(codeStr);
    if (code >= 200 && code < 300) {
      distribution['2xx'] += count;
    } else if (code >= 300 && code < 400) {
      distribution['3xx'] += count;
    } else if (code >= 400 && code < 500) {
      distribution['4xx'] += count;
    } else if (code >= 500 && code < 600) {
      distribution['5xx'] += count;
    } else {
      distribution.other += count;
    }
  }

  return distribution;
}
