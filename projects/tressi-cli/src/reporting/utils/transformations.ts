import pkg from '../../../../../package.json';
import type { TressiConfig } from '../../common/config/types';
import type { AggregatedMetrics } from '../../common/metrics';
import { roundToDecimals } from '../../utils/math-utils';
import { TestSummary } from '../types';

export function transformAggregatedMetricToTestSummary(
  metrics: AggregatedMetrics,
  actualDurationSec: number,
  endpointMethodMap: Record<string, string>,
  config: TressiConfig,
  testId?: string,
  bodySamples?: Record<string, Array<{ statusCode: number; body: string }>>,
): TestSummary {
  const global = metrics.global;

  // Calculate total configured RPS from all endpoints
  const totalConfiguredRps = config.requests.reduce((sum, request) => {
    return sum + request.rps;
  }, 0);

  // Calculate achieved percentage based on configured RPS instead of theoretical max
  const achievedPercentage =
    totalConfiguredRps > 0
      ? (global.requestsPerSecond / totalConfiguredRps) * 100
      : 0;

  const theoreticalMaxRps =
    global.averageLatency > 0 ? 1000 / global.averageLatency : 0;

  const globalSummary = {
    totalEndpoints: Object.keys(metrics.endpoints).length,
    totalRequests: global.totalRequests,
    successfulRequests: global.successfulRequests,
    failedRequests: global.failedRequests,
    avgLatencyMs: global.averageLatency,
    minLatencyMs: global.minLatency,
    maxLatencyMs: global.maxLatency,
    p95LatencyMs: global.p95Latency,
    p99LatencyMs: global.p99Latency,
    actualRps: global.requestsPerSecond,
    theoreticalMaxRps: roundToDecimals(theoreticalMaxRps),
    achievedPercentage: roundToDecimals(achievedPercentage),
    duration: roundToDecimals(actualDurationSec),
    avgErrorRate:
      global.totalRequests > 0
        ? (global.failedRequests / global.totalRequests) * 100
        : 0,
    bodySamples,
  };

  const endpointSummaries = Object.entries(metrics.endpoints).map(
    ([url, endpoint]) => {
      const theoreticalMaxRps =
        endpoint.averageLatency > 0 ? 1000 / endpoint.averageLatency : 0;
      const endpointBodySamples = bodySamples?.[url] || [];
      return {
        method: endpointMethodMap[url],
        url,
        totalRequests: endpoint.totalRequests,
        successfulRequests: endpoint.successfulRequests,
        failedRequests: endpoint.failedRequests,
        avgLatencyMs: endpoint.averageLatency,
        minLatencyMs: endpoint.minLatency,
        maxLatencyMs: endpoint.maxLatency,
        p95LatencyMs: endpoint.p95Latency,
        p99LatencyMs: endpoint.p99Latency,
        actualRps: endpoint.requestsPerSecond,
        theoreticalMaxRps: roundToDecimals(theoreticalMaxRps),
        bodySamples: endpointBodySamples,
      };
    },
  );

  return {
    testId,
    global: globalSummary,
    endpoints: endpointSummaries,
    tressiVersion: pkg.version || 'unknown',
  };
}
