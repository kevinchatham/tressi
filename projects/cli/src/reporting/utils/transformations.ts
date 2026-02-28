import {
  AggregatedMetrics,
  EndpointSummary,
  GlobalSummary,
  LatencyHistogram,
  LatencyHistogramBucket,
  TestSummary,
  TressiConfig,
} from '@tressi/shared/common';

import pkg from '../../../../../package.json';

/**
 * Converts worker histogram data to TestSummary histogram format
 */
function convertWorkerHistogramToTestSummaryHistogram(
  histograms: LatencyHistogram[],
): LatencyHistogram | undefined {
  if (!histograms || histograms.length === 0) {
    return undefined;
  }

  // Aggregate data from all worker histograms
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

  // Calculate weighted percentiles and aggregate stats
  histograms.forEach((histogram) => {
    totalCount += histogram.totalCount;
    min = Math.min(min, histogram.min);
    max = Math.max(max, histogram.max);
  });

  if (totalCount === 0) {
    return undefined;
  }

  // Calculate weighted percentiles, mean, and stdDev
  Object.keys(percentiles).forEach((p) => {
    const percentile = parseFloat(p);
    let weightedValue = 0;

    histograms.forEach((histogram) => {
      const weight = histogram.totalCount / totalCount;
      weightedValue += (histogram.percentiles[percentile] || 0) * weight;
    });

    percentiles[percentile] = weightedValue;
  });

  // Calculate weighted mean and stdDev
  histograms.forEach((histogram) => {
    const weight = histogram.totalCount / totalCount;
    weightedMeanSum += histogram.mean * weight;
    weightedStdDevSum += histogram.stdDev * weight;
  });

  // Merge buckets from all histograms into 10 logarithmic buckets for visualization
  // Logarithmic buckets are better for latency as they provide more detail for the majority
  // of requests while still capturing the long tail without excessive empty space.
  const numBuckets = 10;
  const buckets: LatencyHistogramBucket[] = [];

  if (totalCount > 0) {
    if (max > min) {
      // Use log scale for bucket boundaries
      // We use log10(val + 1) to handle cases where min might be 0
      const logMin = Math.log10(min + 1);
      const logMax = Math.log10(max + 1);
      const logRange = logMax - logMin;
      const logBucketSize = logRange / numBuckets;

      // Initialize 10 logarithmic buckets
      for (let i = 0; i < numBuckets; i++) {
        const lowerLog = logMin + i * logBucketSize;
        const upperLog = logMin + (i + 1) * logBucketSize;

        buckets.push({
          lowerBound: Math.pow(10, lowerLog) - 1,
          upperBound: Math.pow(10, upperLog) - 1,
          count: 0,
        });
      }

      // Distribute counts from all worker histograms into the new buckets
      histograms.forEach((h) => {
        h.buckets.forEach((b) => {
          // Use the midpoint of the original bucket to decide which new bucket it belongs to
          const midpoint = (b.lowerBound + b.upperBound) / 2;
          const logMidpoint = Math.log10(midpoint + 1);
          let bucketIndex = Math.floor((logMidpoint - logMin) / logBucketSize);

          // Handle edge case for the very last value (max)
          if (bucketIndex >= numBuckets) {
            bucketIndex = numBuckets - 1;
          }
          if (bucketIndex < 0) {
            bucketIndex = 0;
          }

          buckets[bucketIndex].count += b.count;
        });
      });

      // Ensure the last bucket always represents the max value if it has samples
      // This prevents the "0 count in upper bucket" discrepancy when max is an outlier
      const totalBucketCount = buckets.reduce((sum, b) => sum + b.count, 0);
      if (totalBucketCount < totalCount) {
        // If we missed some samples due to rounding/midpoint math,
        // they are almost certainly at the very top end
        buckets[numBuckets - 1].count += totalCount - totalBucketCount;
      } else if (buckets[numBuckets - 1].count === 0 && totalCount > 0) {
        // Final fallback: if the last bucket is still empty but we have samples,
        // move one sample from the largest bucket to the last bucket to ensure
        // the 'max' value is visually represented.
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
      // All samples have the same value (min === max)
      buckets.push({
        lowerBound: min,
        upperBound: max,
        count: totalCount,
      });
    }
  }

  return {
    totalCount,
    min,
    max,
    mean: weightedMeanSum,
    stdDev: weightedStdDevSum,
    percentiles,
    buckets,
  };
}

export function transformAggregatedMetricToTestSummary(
  metrics: AggregatedMetrics,
  finalDurationSec: number,
  endpointMethodMap: Record<string, string>,
  config: TressiConfig,
  epochStartedAt: number,
  epochEndedAt: number,
  responseSamples?: Record<
    string,
    Array<{
      statusCode: number;
      headers: Record<string, string>;
      body: string;
    }>
  >,
  histogramData?: {
    global: LatencyHistogram[];
    endpoints: Record<string, LatencyHistogram[]>;
  },
): TestSummary {
  const global = metrics.global;

  const globalSummary: GlobalSummary = {
    totalEndpoints: Object.keys(metrics.endpoints).length,
    totalRequests: global.totalRequests,
    successfulRequests: global.successfulRequests,
    averageRequestsPerSecond: global.averageRequestsPerSecond,
    peakRequestsPerSecond: global.peakRequestsPerSecond,
    errorRate: global.errorRate,
    failedRequests: global.failedRequests,
    minLatencyMs: global.minLatencyMs,
    maxLatencyMs: global.maxLatencyMs,
    p95LatencyMs: global.p95LatencyMs,
    p99LatencyMs: global.p99LatencyMs,
    p50LatencyMs: global.p50LatencyMs,
    finalDurationSec: finalDurationSec,
    epochStartedAt: epochStartedAt,
    epochEndedAt: epochEndedAt,
    networkBytesSent: global.networkBytesSent || 0,
    networkBytesReceived: global.networkBytesReceived || 0,
    networkBytesPerSec: global.networkBytesPerSec || 0,
    avgSystemCpuUsagePercent: metrics.cpuUsagePercent,
    avgProcessMemoryUsageMB: metrics.memoryUsageMB,
    targetAchieved: 0, // Will be calculated below
    histogram: {} as LatencyHistogram, // Will be populated below
  };

  const endpointSummaries: EndpointSummary[] = Object.entries(
    metrics.endpoints,
  ).map(([url, endpoint]) => {
    const theoreticalMaxRps =
      endpoint.p50LatencyMs > 0 ? 1000 / endpoint.p50LatencyMs : 0;
    const endpointResponseSamples = responseSamples?.[url] || [];

    // Find the request config for this URL to get the target RPS
    const requestConfig = config.requests.find((req) => req.url === url)!;

    // Calculate percentage of target RPS achieved
    const targetAchieved = endpoint.peakRequestsPerSecond / requestConfig.rps;

    const summary: EndpointSummary = {
      method: endpointMethodMap[url],
      url,
      totalRequests: endpoint.totalRequests,
      successfulRequests: endpoint.successfulRequests,
      failedRequests: endpoint.failedRequests,
      minLatencyMs: endpoint.minLatencyMs,
      maxLatencyMs: endpoint.maxLatencyMs,
      p50LatencyMs: endpoint.p50LatencyMs,
      p95LatencyMs: endpoint.p95LatencyMs,
      p99LatencyMs: endpoint.p99LatencyMs,
      averageRequestsPerSecond: endpoint.averageRequestsPerSecond,
      peakRequestsPerSecond: endpoint.peakRequestsPerSecond,
      theoreticalMaxRps: theoreticalMaxRps,
      targetAchieved,
      responseSamples: endpointResponseSamples,
      statusCodeDistribution: endpoint.statusCodeDistribution,
      errorRate: endpoint.errorRate,
      histogram: {} as LatencyHistogram, // Will be populated below
    };

    return summary;
  });

  // Calculate global target achieved as average of all endpoints
  const totalTargetAchieved = endpointSummaries.reduce(
    (sum, e) => sum + e.targetAchieved,
    0,
  );
  globalSummary.targetAchieved =
    endpointSummaries.length > 0
      ? totalTargetAchieved / endpointSummaries.length
      : 0;

  // Build histogram data if provided
  if (histogramData) {
    // Assign global histogram
    const globalHistogram = convertWorkerHistogramToTestSummaryHistogram(
      histogramData.global,
    );
    if (globalHistogram) {
      globalSummary.histogram = globalHistogram;
    }

    // Assign endpoint histograms
    Object.entries(histogramData.endpoints).forEach(
      ([url, endpointHistograms]) => {
        const endpoint = endpointSummaries.find((e) => e.url === url);
        if (endpoint) {
          const endpointHistogram =
            convertWorkerHistogramToTestSummaryHistogram(endpointHistograms);
          if (endpointHistogram) {
            endpoint.histogram = endpointHistogram;
          }
        }
      },
    );
  }

  const result: TestSummary = {
    tressiVersion: pkg.version || 'unknown',
    configSnapshot: config,
    global: globalSummary,
    endpoints: endpointSummaries,
  };

  return result;
}
