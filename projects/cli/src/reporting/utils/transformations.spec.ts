import { TestSummary, TressiConfig } from '@tressi/shared/common';
import { describe, expect, it } from 'vitest';

import { transformAggregatedMetricToTestSummary } from './transformations';

describe('transformAggregatedMetricToTestSummary', () => {
  it('should transform aggregated metrics to TestSummary', () => {
    const config = {
      requests: [{ url: '/test', rps: 20 }],
    } as unknown as TressiConfig;

    const snapshot = {
      configSnapshot: config,
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
        peakRequestsPerSecond: 10,
        networkBytesSent: 1000,
        networkBytesReceived: 2000,
        networkBytesPerSec: 200,
        finalDurationSec: 10,
        avgSystemCpuUsagePercent: 50,
        avgProcessMemoryUsageMB: 100,
      },
      endpoints: [
        {
          url: '/test',
          totalRequests: 100,
          successfulRequests: 90,
          failedRequests: 10,
          minLatencyMs: 1,
          maxLatencyMs: 100,
          p50LatencyMs: 50,
          p95LatencyMs: 80,
          p99LatencyMs: 95,
          averageRequestsPerSecond: 10,
          peakRequestsPerSecond: 10,
          statusCodeDistribution: { 200: 90, 500: 10 },
          errorRate: 0.1,
          targetAchieved: 0.5,
        },
      ],
    } as unknown as TestSummary;

    const result = transformAggregatedMetricToTestSummary([snapshot]);

    expect(result.global.totalRequests).toBe(100);
    expect(result.endpoints[0].url).toBe('/test');
    expect(result.endpoints[0].targetAchieved).toBe(0.5);
  });
});
