import chalk from 'chalk';

/**
 * Calculates the latency distribution for a given set of latencies.
 * @param latencies An array of latency values.
 * @param bucketCount The number of buckets to create.
 * @returns An array of bucket objects with range, count, and percentage values.
 */

export function getLatencyDistribution(
  latencies: number[],
  bucketCount = 6,
): {
  range: string;
  count: string;
  percent: string;
  cumulative: string;
}[] {
  if (latencies.length === 0) {
    return [];
  }

  const totalCount = latencies.length;
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);
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

  for (const latency of latencies) {
    const targetBucket = buckets.find(
      (b) => latency >= b.lowerBound && latency <= b.upperBound,
    );
    if (targetBucket) {
      targetBucket.count++;
    }
  }

  let cumulativeCount = 0;

  return buckets.map((bucket) => {
    const percentOfTotal =
      totalCount > 0 ? (bucket.count / totalCount) * 100 : 0;
    cumulativeCount += bucket.count;
    const cumulativePercent =
      totalCount > 0 ? (cumulativeCount / totalCount) * 100 : 0;

    return {
      range: bucket.range,
      count: bucket.count.toString(),
      percent: `${percentOfTotal.toFixed(1)}%`,
      cumulative: `${cumulativePercent.toFixed(1)}%`,
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
        percent: `${percent.toFixed(1)}%`,
        chart,
      };
    });
}
