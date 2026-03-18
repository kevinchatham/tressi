import { EndpointLatencyStats, GlobalLatencyStats } from '@tressi/shared/cli';
import { LatencyHistogram } from '@tressi/shared/common';

export function calculateGlobalLatencyStats(
  endpointHistograms: Record<string, LatencyHistogram[]>,
): GlobalLatencyStats {
  let totalCount = 0;
  let weightedSum = 0;
  let minLatency = Infinity;
  let maxLatency = 0;

  const allHistograms: LatencyHistogram[] = [];
  Object.values(endpointHistograms).forEach((histograms) => {
    allHistograms.push(...histograms);
  });

  if (allHistograms.length === 0) {
    return {
      averageLatency: 0,
      minLatency: 0,
      maxLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
    };
  }

  allHistograms.forEach((histogram) => {
    totalCount += histogram.totalCount;
    weightedSum += histogram.mean * histogram.totalCount;
    minLatency = Math.min(minLatency, histogram.min);
    maxLatency = Math.max(maxLatency, histogram.max);
  });

  const averageLatency = totalCount > 0 ? weightedSum / totalCount : 0;

  let weightedP50 = 0;
  let weightedP95 = 0;
  let weightedP99 = 0;

  allHistograms.forEach((histogram) => {
    const weight = totalCount > 0 ? histogram.totalCount / totalCount : 0;
    weightedP50 += (histogram.percentiles[50] || 0) * weight;
    weightedP95 += (histogram.percentiles[95] || 0) * weight;
    weightedP99 += (histogram.percentiles[99] || 0) * weight;
  });

  return {
    averageLatency,
    minLatency: minLatency === Infinity ? 0 : minLatency,
    maxLatency,
    p50Latency: weightedP50,
    p95Latency: weightedP95,
    p99Latency: weightedP99,
  };
}

export function calculateEndpointLatencyStats(
  histograms: LatencyHistogram[],
): EndpointLatencyStats {
  let totalCount = 0;
  let weightedSum = 0;
  let minLatency = Infinity;
  let maxLatency = 0;

  if (histograms.length === 0) {
    return {
      averageLatency: 0,
      minLatency: 0,
      maxLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      totalCount: 0,
    };
  }

  histograms.forEach((histogram) => {
    totalCount += histogram.totalCount;
    weightedSum += histogram.mean * histogram.totalCount;
    minLatency = Math.min(minLatency, histogram.min);
    maxLatency = Math.max(maxLatency, histogram.max);
  });

  const averageLatency = totalCount > 0 ? weightedSum / totalCount : 0;

  let weightedP50 = 0;
  let weightedP95 = 0;
  let weightedP99 = 0;

  histograms.forEach((histogram) => {
    const weight = totalCount > 0 ? histogram.totalCount / totalCount : 0;
    weightedP50 += (histogram.percentiles[50] || 0) * weight;
    weightedP95 += (histogram.percentiles[95] || 0) * weight;
    weightedP99 += (histogram.percentiles[99] || 0) * weight;
  });

  return {
    averageLatency,
    minLatency: minLatency === Infinity ? 0 : minLatency,
    maxLatency,
    p50Latency: weightedP50,
    p95Latency: weightedP95,
    p99Latency: weightedP99,
    totalCount,
  };
}
