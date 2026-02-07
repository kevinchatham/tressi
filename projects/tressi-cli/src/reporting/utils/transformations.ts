import pkg from '../../../../../package.json';
import type { TressiConfig } from '../../common/config/types';
import type { AggregatedMetrics } from '../../common/metrics';
import { roundToDecimals } from '../../utils/math-utils';
import type { LatencyHistogram as WorkerLatencyHistogram } from '../../workers/types';
import {
  EndpointSummary,
  GlobalSummary,
  LatencyHistogram,
  TestSummary,
} from '../types';

/**
 * Converts worker histogram data to TestSummary histogram format
 */
function convertWorkerHistogramToTestSummaryHistogram(
  histograms: WorkerLatencyHistogram[],
): LatencyHistogram | undefined {
  if (!histograms || histograms.length === 0) {
    return undefined;
  }

  // Aggregate data from all worker histograms
  let totalCount = 0;
  let min = Infinity;
  let max = 0;

  const percentiles = {
    1: 0,
    5: 0,
    10: 0,
    25: 0,
    50: 0,
    75: 0,
    90: 0,
    95: 0,
    99: 0,
    99.9: 0,
  };

  // Calculate weighted percentiles
  histograms.forEach((histogram) => {
    totalCount += histogram.totalCount;
    min = Math.min(min, histogram.min);
    max = Math.max(max, histogram.max);
  });

  if (totalCount === 0) {
    return undefined;
  }

  // Calculate weighted percentiles
  Object.keys(percentiles).forEach((p) => {
    const percentile = parseFloat(p);
    let weightedValue = 0;

    histograms.forEach((histogram) => {
      const weight = histogram.totalCount / totalCount;
      weightedValue += (histogram.percentiles[percentile] || 0) * weight;
    });

    percentiles[percentile as keyof typeof percentiles] = weightedValue;
  });

  return {
    totalCount,
    min,
    max,
    percentiles,
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
    global: WorkerLatencyHistogram[];
    endpoints: Record<string, WorkerLatencyHistogram[]>;
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
    finalDurationSec: roundToDecimals(finalDurationSec),
    epochStartedAt: epochStartedAt,
    epochEndedAt: epochEndedAt,
    networkBytesSent: global.networkBytesSent || 0,
    networkBytesReceived: global.networkBytesReceived || 0,
    networkBytesPerSec: global.networkBytesPerSec || 0,
    avgSystemCpuUsagePercent: metrics.cpuUsagePercent,
    avgProcessMemoryUsageMB: metrics.memoryUsageMB,
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
    const targetAchieved = roundToDecimals(
      (endpoint.averageRequestsPerSecond / requestConfig.rps) * 100,
    );

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
      theoreticalMaxRps: roundToDecimals(theoreticalMaxRps),
      targetAchieved,
      responseSamples: endpointResponseSamples,
      statusCodeDistribution: endpoint.statusCodeDistribution,
      errorRate: endpoint.errorRate,
      histogram: {} as LatencyHistogram, // Will be populated below
    };

    return summary;
  });

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
