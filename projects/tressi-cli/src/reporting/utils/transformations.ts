import pkg from '../../../../../package.json';
import type { TressiConfig } from '../../common/config/types';
import type { AggregatedMetrics } from '../../common/metrics';
import { roundToDecimals } from '../../utils/math-utils';
import { EndpointSummary, GlobalSummary, TestSummary } from '../types';

export function transformAggregatedMetricToTestSummary(
  metrics: AggregatedMetrics,
  actualDurationSec: number,
  endpointMethodMap: Record<string, string>,
  config: TressiConfig,
  responseSamples?: Record<
    string,
    Array<{
      statusCode: number;
      headers: Record<string, string>;
      body: string;
    }>
  >,
): TestSummary {
  const global = metrics.global;

  const globalSummary: GlobalSummary = {
    totalEndpoints: Object.keys(metrics.endpoints).length,
    totalRequests: global.totalRequests,
    successfulRequests: global.successfulRequests,
    failedRequests: global.failedRequests,
    avgLatencyMs: global.averageLatency,
    minLatencyMs: global.minLatency,
    maxLatencyMs: global.maxLatency,
    p95LatencyMs: global.p95Latency,
    p99LatencyMs: global.p99Latency,
    duration: roundToDecimals(actualDurationSec),
  };

  const endpointSummaries: EndpointSummary[] = Object.entries(
    metrics.endpoints,
  ).map(([url, endpoint]) => {
    const theoreticalMaxRps =
      endpoint.averageLatency > 0 ? 1000 / endpoint.averageLatency : 0;
    const endpointResponseSamples = responseSamples?.[url] || [];

    // Find the request config for this URL to get the target RPS
    const requestConfig = config.requests.find((req) => req.url === url)!;

    // Calculate percentage of target RPS achieved
    const targetAchieved = roundToDecimals(
      (endpoint.requestsPerSecond / requestConfig.rps) * 100,
    );

    const summary: EndpointSummary = {
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
      targetAchieved,
      responseSamples: endpointResponseSamples,
      statusCodeDistribution: endpoint.statusCodeDistribution,
    };

    return summary;
  });

  const result: TestSummary = {
    global: globalSummary,
    endpoints: endpointSummaries,
    tressiVersion: pkg.version || 'unknown',
  };

  return result;
}
