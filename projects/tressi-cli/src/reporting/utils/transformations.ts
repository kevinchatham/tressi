import pkg from '../../../../../package.json';
import type { AggregatedMetric } from '../../common/metrics';
import { TestSummary } from '../types';

export function transformAggregatedMetricToTestSummary(
  metrics: AggregatedMetric,
  actualDurationSec: number,
): TestSummary {
  const global = metrics.global;

  const theoreticalMaxRps =
    global.averageLatency > 0 ? 1000 / global.averageLatency : 0;
  const achievedPercentage =
    theoreticalMaxRps > 0
      ? (global.requestsPerSecond / theoreticalMaxRps) * 100
      : 0;

  const globalSummary = {
    totalRequests: global.totalRequests,
    successfulRequests: global.successfulRequests,
    failedRequests: global.failedRequests,
    avgLatencyMs: global.averageLatency,
    minLatencyMs: global.minLatency,
    maxLatencyMs: global.maxLatency,
    p95LatencyMs: global.p95Latency,
    p99LatencyMs: global.p99Latency,
    actualRps: global.requestsPerSecond,
    theoreticalMaxRps: Math.round(theoreticalMaxRps * 100) / 100,
    achievedPercentage: Math.round(achievedPercentage * 100) / 100,
    duration: actualDurationSec,
  };

  const endpointSummaries = Object.entries(metrics.endpoints).map(
    ([url, endpoint]) => ({
      method: 'GET',
      url,
      totalRequests: endpoint.totalRequests,
      successfulRequests: endpoint.successfulRequests,
      failedRequests: endpoint.failedRequests,
      avgLatencyMs: endpoint.averageLatency,
      minLatencyMs: endpoint.minLatency,
      maxLatencyMs: endpoint.maxLatency,
      p95LatencyMs: endpoint.p95Latency,
      p99LatencyMs: endpoint.p99Latency,
    }),
  );

  return {
    global: globalSummary,
    endpoints: endpointSummaries,
    tressiVersion: pkg.version || 'unknown',
  };
}
