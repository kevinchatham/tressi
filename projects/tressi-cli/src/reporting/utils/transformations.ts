import pkg from '../../../../../package.json';
import type { TressiConfig } from '../../common/config/types';
import type { AggregatedMetrics } from '../../common/metrics';
import { roundToDecimals } from '../../utils/math-utils';
import { EndpointSummary, GlobalSummary, TestSummary } from '../types';

/**
 * Calculate expected number of requests accounting for linear ramp-up
 *
 * For ramp-up scenarios, calculates requests as:
 * - Ramp-up phase: (targetRps / 2) * rampUpDuration (average of 0 to target)
 * - Steady-state: targetRps * (duration - rampUpDuration)
 */
export function calculateExpectedRequests(
  targetRps: number,
  rampUpDurationSec: number | undefined,
  finalDurationSec: number,
): number {
  const rampUp = rampUpDurationSec || 0;

  if (rampUp <= 0 || rampUp > finalDurationSec) {
    return targetRps * finalDurationSec;
  }

  // Linear ramp-up: average RPS during ramp = targetRps / 2
  const rampUpRequests = (targetRps / 2) * rampUp;
  const steadyStateRequests = targetRps * (finalDurationSec - rampUp);

  return Math.ceil(rampUpRequests + steadyStateRequests);
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
): TestSummary {
  const global = metrics.global;

  const globalSummary: GlobalSummary = {
    totalEndpoints: Object.keys(metrics.endpoints).length,
    totalRequests: global.totalRequests,
    successfulRequests: global.successfulRequests,
    failedRequests: global.failedRequests,
    minLatencyMs: global.minLatencyMs,
    maxLatencyMs: global.maxLatencyMs,
    p95LatencyMs: global.p95LatencyMs,
    p99LatencyMs: global.p99LatencyMs,
    p50LatencyMs: global.p50LatencyMs,
    finalDurationSec: roundToDecimals(finalDurationSec),
    epochStartedAt: epochStartedAt, // ← Use required param
    epochEndedAt: epochEndedAt, // ← Use required param
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
    const expectedRequests = calculateExpectedRequests(
      requestConfig.rps,
      requestConfig.rampUpDurationSec,
      finalDurationSec,
    );
    const targetAchieved = roundToDecimals(
      (endpoint.totalRequests / expectedRequests) * 100,
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
      requestsPerSecond: endpoint.requestsPerSecond,
      theoreticalMaxRps: roundToDecimals(theoreticalMaxRps),
      targetAchieved,
      responseSamples: endpointResponseSamples,
      statusCodeDistribution: endpoint.statusCodeDistribution,
    };

    return summary;
  });

  const result: TestSummary = {
    tressiVersion: pkg.version || 'unknown',
    configSnapshot: config,
    global: globalSummary,
    endpoints: endpointSummaries,
  };

  return result;
}
