import { AggregatedMetrics, TressiConfig } from '@tressi/shared/common';
import { describe, expect, it } from 'vitest';

import { transformAggregatedMetricToTestSummary } from './transformations';

describe('transformAggregatedMetricToTestSummary', () => {
  it('should transform aggregated metrics to TestSummary', () => {
    const metrics = {
      global: {
        totalRequests: 100,
        successfulRequests: 90,
        failedRequests: 10,
        errorRate: 0.1,
        minLatencyMs: 1,
        maxLatencyMs: 100,
        p50LatencyMs: 50,
        p95LatencyMs: 80,
        p99LatencyMs: 95,
        averageRequestsPerSecond: 10,
        peakRequestsPerSecond: 20,
        networkBytesSent: 1000,
        networkBytesReceived: 2000,
        networkBytesPerSec: 200,
      },
      endpoints: {
        '/test': {
          totalRequests: 100,
          successfulRequests: 90,
          failedRequests: 10,
          minLatencyMs: 1,
          maxLatencyMs: 100,
          p50LatencyMs: 50,
          p95LatencyMs: 80,
          p99LatencyMs: 95,
          averageRequestsPerSecond: 10,
          peakRequestsPerSecond: 20,
          statusCodeDistribution: { 200: 90, 500: 10 },
          errorRate: 0.1,
        },
      },
      cpuUsagePercent: 50,
      memoryUsageMB: 100,
    } as unknown as AggregatedMetrics;

    const config = {
      requests: [{ url: '/test', rps: 20 }],
    } as unknown as TressiConfig;

    const result = transformAggregatedMetricToTestSummary(
      metrics,
      10,
      { '/test': 'GET' },
      config,
      1700000000000,
      1700000010000,
    );

    expect(result.global.totalRequests).toBe(100);
    expect(result.endpoints[0].url).toBe('/test');
    expect(result.endpoints[0].targetAchieved).toBe(1);
  });
});
