import type { TestSummary, TressiConfig } from '@tressi/shared/common';
import { describe, expect, it } from 'vitest';

import { transformAggregatedMetricToTestSummary } from './transformations';

describe('transformAggregatedMetricToTestSummary', () => {
  it('should transform aggregated metrics to TestSummary', () => {
    const config = {
      requests: [{ rps: 20, url: '/test' }],
    } as unknown as TressiConfig;

    const snapshot = {
      configSnapshot: config,
      endpoints: [
        {
          averageRequestsPerSecond: 10,
          errorRate: 0.1,
          failedRequests: 10,
          maxLatencyMs: 100,
          minLatencyMs: 1,
          p50LatencyMs: 50,
          p95LatencyMs: 80,
          p99LatencyMs: 95,
          peakRequestsPerSecond: 10,
          statusCodeDistribution: { 200: 90, 500: 10 },
          successfulRequests: 90,
          targetAchieved: 0.5,
          totalRequests: 100,
          url: '/test',
        },
      ],
      global: {
        averageRequestsPerSecond: 10,
        avgProcessMemoryUsageMB: 100,
        avgSystemCpuUsagePercent: 50,
        errorRate: 0.1,
        failedRequests: 10,
        finalDurationSec: 10,
        maxLatencyMs: 100,
        minLatencyMs: 1,
        networkBytesPerSec: 200,
        networkBytesReceived: 2000,
        networkBytesSent: 1000,
        p50LatencyMs: 50,
        p95LatencyMs: 80,
        p99LatencyMs: 95,
        peakRequestsPerSecond: 10,
        successfulRequests: 90,
        totalRequests: 100,
      },
    } as unknown as TestSummary;

    const result = transformAggregatedMetricToTestSummary([snapshot]);

    expect(result.global.totalRequests).toBe(100);
    expect(result.endpoints[0].url).toBe('/test');
    expect(result.endpoints[0].targetAchieved).toBe(0.5);
  });
});
