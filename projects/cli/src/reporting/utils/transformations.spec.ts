import type { TestSummary, TressiConfig } from '@tressi/shared/common';
import { describe, expect, it } from 'vitest';

import { transformAggregatedMetricsToTestSummary } from './transformations';

const BASE_TIME = 1000000000000; // Fixed base time for tests

describe('transformAggregatedMetricToTestSummary', () => {
  it('should transform aggregated metrics to TestSummary', () => {
    const config = {
      options: { rampUpDurationSec: 0 },
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
        epochEndedAt: BASE_TIME + 10000,
        epochStartedAt: BASE_TIME,
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

    const result = transformAggregatedMetricsToTestSummary([snapshot]);

    expect(result.global.totalRequests).toBe(100);
    expect(result.endpoints[0].url).toBe('/test');
    expect(result.endpoints[0].targetAchieved).toBe(0.5);
  });

  describe('ramp-up exclusion', () => {
    it('should exclude ramp-up period from global metrics calculations', () => {
      const config = {
        options: { rampUpDurationSec: 5 },
        requests: [{ rps: 20, url: '/test' }],
      } as unknown as TressiConfig;

      // Snapshot 1: During ramp-up (t=0-5s)
      const rampUpSnapshot = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 5,
            peakRequestsPerSecond: 5,
            totalRequests: 25,
            url: '/test',
          },
        ],
        global: {
          averageRequestsPerSecond: 5,
          avgProcessMemoryUsageMB: 80,
          avgSystemCpuUsagePercent: 30,
          epochEndedAt: BASE_TIME + 3000,
          epochStartedAt: BASE_TIME,
          peakRequestsPerSecond: 5,
          totalRequests: 25,
        },
      } as unknown as TestSummary;

      // Snapshot 2: After ramp-up (t=5s+)
      const steadyStateSnapshot = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 20,
            peakRequestsPerSecond: 22,
            totalRequests: 100,
            url: '/test',
          },
        ],
        global: {
          averageRequestsPerSecond: 22,
          avgProcessMemoryUsageMB: 120,
          avgSystemCpuUsagePercent: 60,
          epochEndedAt: BASE_TIME + 10000,
          epochStartedAt: BASE_TIME,
          peakRequestsPerSecond: 22,
          totalRequests: 100,
        },
      } as unknown as TestSummary;

      const result = transformAggregatedMetricsToTestSummary([rampUpSnapshot, steadyStateSnapshot]);

      // Peak RPS should be from steady-state only (22, not max of 22 and 5)
      expect(result.global.peakRequestsPerSecond).toBe(22);

      // CPU and memory should be from steady-state only
      expect(result.global.avgSystemCpuUsagePercent).toBe(60);
      expect(result.global.avgProcessMemoryUsageMB).toBe(120);
    });

    it('should use per-endpoint ramp-up when greater than global', () => {
      const config = {
        options: { rampUpDurationSec: 5 },
        requests: [{ rampUpDurationSec: 10, rps: 20, url: '/test' }],
      } as unknown as TressiConfig;

      // Snapshot at t=7s (after global ramp-up but during endpoint ramp-up)
      const snapshotDuringEndpointRampUp = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 15,
            peakRequestsPerSecond: 15,
            totalRequests: 75,
            url: '/test',
          },
        ],
        global: {
          averageRequestsPerSecond: 15,
          avgProcessMemoryUsageMB: 100,
          avgSystemCpuUsagePercent: 50,
          epochEndedAt: BASE_TIME + 7000,
          epochStartedAt: BASE_TIME,
          peakRequestsPerSecond: 15,
          totalRequests: 75,
        },
      } as unknown as TestSummary;

      // Snapshot at t=12s (after endpoint ramp-up)
      const snapshotAfterEndpointRampUp = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 20,
            peakRequestsPerSecond: 22,
            totalRequests: 100,
            url: '/test',
          },
        ],
        global: {
          averageRequestsPerSecond: 22,
          avgProcessMemoryUsageMB: 120,
          avgSystemCpuUsagePercent: 60,
          epochEndedAt: BASE_TIME + 12000,
          epochStartedAt: BASE_TIME,
          peakRequestsPerSecond: 22,
          totalRequests: 100,
        },
      } as unknown as TestSummary;

      const result = transformAggregatedMetricsToTestSummary([
        snapshotDuringEndpointRampUp,
        snapshotAfterEndpointRampUp,
      ]);

      // Global metrics should use max endpoint ramp-up (10s), so only the second snapshot counts
      expect(result.global.peakRequestsPerSecond).toBe(22);
      expect(result.global.avgSystemCpuUsagePercent).toBe(60);
      expect(result.global.avgProcessMemoryUsageMB).toBe(120);

      // Endpoint metrics should also use its own ramp-up (10s), so only the second snapshot counts
      expect(result.endpoints[0].peakRequestsPerSecond).toBe(22);
    });

    it('should fall back to all snapshots if no steady-state data exists', () => {
      const config = {
        options: { rampUpDurationSec: 10 },
        requests: [{ rps: 20, url: '/test' }],
      } as unknown as TressiConfig;

      // Both snapshots are during ramp-up
      const snapshot1 = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 5,
            peakRequestsPerSecond: 5,
            totalRequests: 25,
            url: '/test',
          },
        ],
        global: {
          averageRequestsPerSecond: 5,
          avgProcessMemoryUsageMB: 80,
          avgSystemCpuUsagePercent: 30,
          epochEndedAt: BASE_TIME + 3000,
          epochStartedAt: BASE_TIME,
          peakRequestsPerSecond: 5,
          totalRequests: 25,
        },
      } as unknown as TestSummary;

      const snapshot2 = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 10,
            peakRequestsPerSecond: 12,
            totalRequests: 100,
            url: '/test',
          },
        ],
        global: {
          averageRequestsPerSecond: 10,
          avgProcessMemoryUsageMB: 100,
          avgSystemCpuUsagePercent: 50,
          epochEndedAt: BASE_TIME + 8000,
          epochStartedAt: BASE_TIME,
          peakRequestsPerSecond: 12,
          totalRequests: 100,
        },
      } as unknown as TestSummary;

      const result = transformAggregatedMetricsToTestSummary([snapshot1, snapshot2]);

      // Should use all snapshots when no steady-state data exists
      expect(result.global.avgSystemCpuUsagePercent).toBe(40); // (30 + 50) / 2
      expect(result.global.avgProcessMemoryUsageMB).toBe(90); // (80 + 100) / 2
    });

    it('should handle endpoint inheriting global ramp-up when endpoint ramp-up is 0', () => {
      const config = {
        options: { rampUpDurationSec: 5 },
        requests: [{ rampUpDurationSec: 0, rps: 20, url: '/test' }],
      } as unknown as TressiConfig;

      // Snapshot at t=6s (after global ramp-up of 5s)
      const snapshotAfterRampUp = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 20,
            peakRequestsPerSecond: 22,
            totalRequests: 100,
            url: '/test',
          },
        ],
        global: {
          averageRequestsPerSecond: 22,
          avgProcessMemoryUsageMB: 120,
          avgSystemCpuUsagePercent: 60,
          epochEndedAt: BASE_TIME + 6000,
          epochStartedAt: BASE_TIME,
          peakRequestsPerSecond: 22,
          totalRequests: 100,
        },
      } as unknown as TestSummary;

      // Snapshot at t=3s (during ramp-up)
      const snapshotDuringRampUp = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 10,
            peakRequestsPerSecond: 10,
            totalRequests: 50,
            url: '/test',
          },
        ],
        global: {
          averageRequestsPerSecond: 10,
          avgProcessMemoryUsageMB: 80,
          avgSystemCpuUsagePercent: 40,
          epochEndedAt: BASE_TIME + 3000,
          epochStartedAt: BASE_TIME,
          peakRequestsPerSecond: 10,
          totalRequests: 50,
        },
      } as unknown as TestSummary;

      const result = transformAggregatedMetricsToTestSummary([
        snapshotDuringRampUp,
        snapshotAfterRampUp,
      ]);

      // Both global and endpoint should use the 5s global ramp-up
      expect(result.global.peakRequestsPerSecond).toBe(22);
      expect(result.endpoints[0].peakRequestsPerSecond).toBe(22);
    });

    it('should use peakRequestsPerSecond (not averageRequestsPerSecond) for global peak RPS', () => {
      const config = {
        options: { rampUpDurationSec: 0 },
        requests: [{ rps: 30, url: '/test' }],
      } as unknown as TressiConfig;

      // Snapshot where average and peak differ clearly
      const snapshot = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 15,
            peakRequestsPerSecond: 28,
            totalRequests: 150,
            url: '/test',
          },
        ],
        global: {
          averageRequestsPerSecond: 15,
          avgProcessMemoryUsageMB: 100,
          avgSystemCpuUsagePercent: 50,
          epochEndedAt: BASE_TIME + 10000,
          epochStartedAt: BASE_TIME,
          finalDurationSec: 10,
          peakRequestsPerSecond: 28,
          totalRequests: 150,
        },
      } as unknown as TestSummary;

      const result = transformAggregatedMetricsToTestSummary([snapshot]);

      // Must reflect the observed peak (28), not the average (15)
      expect(result.global.peakRequestsPerSecond).toBe(28);
    });

    it('should fall back to all snapshots for global peak RPS when no steady-state data exists', () => {
      const config = {
        options: { rampUpDurationSec: 60 },
        requests: [{ rps: 20, url: '/test' }],
      } as unknown as TressiConfig;

      // Both snapshots are within the ramp-up window (test ends before 60 s)
      const snapshot1 = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 5,
            peakRequestsPerSecond: 8,
            totalRequests: 40,
            url: '/test',
          },
        ],
        global: {
          averageRequestsPerSecond: 5,
          avgProcessMemoryUsageMB: 80,
          avgSystemCpuUsagePercent: 30,
          epochEndedAt: BASE_TIME + 3000,
          epochStartedAt: BASE_TIME,
          finalDurationSec: 3,
          peakRequestsPerSecond: 8,
          totalRequests: 40,
        },
      } as unknown as TestSummary;

      const snapshot2 = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 10,
            peakRequestsPerSecond: 14,
            totalRequests: 100,
            url: '/test',
          },
        ],
        global: {
          averageRequestsPerSecond: 10,
          avgProcessMemoryUsageMB: 100,
          avgSystemCpuUsagePercent: 50,
          epochEndedAt: BASE_TIME + 8000,
          epochStartedAt: BASE_TIME,
          finalDurationSec: 8,
          peakRequestsPerSecond: 14,
          totalRequests: 100,
        },
      } as unknown as TestSummary;

      const result = transformAggregatedMetricsToTestSummary([snapshot1, snapshot2]);

      // Should fall back to the highest peakRequestsPerSecond across all snapshots (14)
      expect(result.global.peakRequestsPerSecond).toBe(14);
      // Must not be -Infinity (Math.max(...[]) guard)
      expect(result.global.peakRequestsPerSecond).toBeGreaterThanOrEqual(0);
    });
  });

  describe('averageRequestsPerSecond', () => {
    it('should compute global averageRequestsPerSecond from totalRequests / finalDurationSec', () => {
      const config = {
        options: { rampUpDurationSec: 0 },
        requests: [{ rps: 10, url: '/test' }],
      } as unknown as TressiConfig;

      const snapshot = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 0,
            peakRequestsPerSecond: 10,
            totalRequests: 100,
            url: '/test',
          },
        ],
        global: {
          averageRequestsPerSecond: 0,
          avgProcessMemoryUsageMB: 100,
          avgSystemCpuUsagePercent: 50,
          epochEndedAt: BASE_TIME + 10000,
          epochStartedAt: BASE_TIME,
          finalDurationSec: 10,
          peakRequestsPerSecond: 10,
          totalRequests: 100,
        },
      } as unknown as TestSummary;

      const result = transformAggregatedMetricsToTestSummary([snapshot]);

      // 100 requests / 10 s = 10 rps
      expect(result.global.averageRequestsPerSecond).toBe(10);
    });

    it('should return 0 for global averageRequestsPerSecond when finalDurationSec is 0', () => {
      const config = {
        options: { rampUpDurationSec: 0 },
        requests: [{ rps: 10, url: '/test' }],
      } as unknown as TressiConfig;

      const snapshot = {
        configSnapshot: config,
        endpoints: [
          { averageRequestsPerSecond: 0, peakRequestsPerSecond: 0, totalRequests: 0, url: '/test' },
        ],
        global: {
          averageRequestsPerSecond: 0,
          avgProcessMemoryUsageMB: 0,
          avgSystemCpuUsagePercent: 0,
          epochEndedAt: BASE_TIME,
          epochStartedAt: BASE_TIME,
          finalDurationSec: 0,
          peakRequestsPerSecond: 0,
          totalRequests: 0,
        },
      } as unknown as TestSummary;

      const result = transformAggregatedMetricsToTestSummary([snapshot]);

      expect(result.global.averageRequestsPerSecond).toBe(0);
      expect(result.endpoints[0].averageRequestsPerSecond).toBe(0);
    });

    it('should exclude ramp-up time from endpoint averageRequestsPerSecond', () => {
      // 30 s test, 10 s ramp-up → endpoint was active for 20 s steady-state
      const config = {
        options: { rampUpDurationSec: 10 },
        requests: [{ rps: 20, url: '/test' }],
      } as unknown as TressiConfig;

      const snapshot = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 0,
            peakRequestsPerSecond: 20,
            totalRequests: 400, // 20 rps × 20 steady-state seconds
            url: '/test',
          },
        ],
        global: {
          averageRequestsPerSecond: 0,
          avgProcessMemoryUsageMB: 100,
          avgSystemCpuUsagePercent: 50,
          epochEndedAt: BASE_TIME + 30000,
          epochStartedAt: BASE_TIME,
          finalDurationSec: 30,
          peakRequestsPerSecond: 20,
          totalRequests: 400,
        },
      } as unknown as TestSummary;

      const result = transformAggregatedMetricsToTestSummary([snapshot]);

      // Should divide by 20 s (30 - 10), not 30 s → 400 / 20 = 20
      expect(result.endpoints[0].averageRequestsPerSecond).toBe(20);
      // Global now uses steady-state duration → 400 / 20 = 20
      expect(result.global.averageRequestsPerSecond).toBe(20);
    });

    it('should fall back to full duration for endpoint averageRequestsPerSecond when ramp-up >= total duration', () => {
      // Edge case: ramp-up longer than test (early exit scenario)
      const config = {
        options: { rampUpDurationSec: 60 },
        requests: [{ rps: 20, url: '/test' }],
      } as unknown as TressiConfig;

      const snapshot = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 0,
            peakRequestsPerSecond: 10,
            totalRequests: 50,
            url: '/test',
          },
        ],
        global: {
          averageRequestsPerSecond: 0,
          avgProcessMemoryUsageMB: 80,
          avgSystemCpuUsagePercent: 30,
          epochEndedAt: BASE_TIME + 5000,
          epochStartedAt: BASE_TIME,
          finalDurationSec: 5,
          peakRequestsPerSecond: 10,
          totalRequests: 50,
        },
      } as unknown as TestSummary;

      const result = transformAggregatedMetricsToTestSummary([snapshot]);

      // ramp-up (60 s) > totalDuration (5 s) → fall back to full duration → 50 / 5 = 10
      expect(result.endpoints[0].averageRequestsPerSecond).toBe(10);
    });
  });

  describe('configSnapshot absence', () => {
    it('should preserve endpoint targetAchieved when endpoint URL has no matching config entry', () => {
      // configSnapshot exists but does not contain an entry for the endpoint URL.
      // The function must not overwrite targetAchieved in this case.
      const config = {
        options: { rampUpDurationSec: 0 },
        requests: [{ rps: 10, url: '/other' }],
      } as unknown as TressiConfig;

      const snapshot = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 8,
            peakRequestsPerSecond: 10,
            targetAchieved: 0.8,
            totalRequests: 80,
            url: '/unmatched',
          },
        ],
        global: {
          averageRequestsPerSecond: 8,
          avgProcessMemoryUsageMB: 100,
          avgSystemCpuUsagePercent: 50,
          epochEndedAt: BASE_TIME + 10000,
          epochStartedAt: BASE_TIME,
          finalDurationSec: 10,
          peakRequestsPerSecond: 10,
          totalRequests: 80,
        },
      } as unknown as TestSummary;

      const result = transformAggregatedMetricsToTestSummary([snapshot]);

      // No config entry for '/unmatched' → targetAchieved must be left untouched at 0.8
      expect(result.endpoints[0].targetAchieved).toBe(0.8);
      // averageRequestsPerSecond is still recomputed (80 / 10 = 8)
      expect(result.endpoints[0].averageRequestsPerSecond).toBe(8);
    });

    it('should not throw and should preserve existing targetAchieved when configSnapshot is absent', () => {
      const snapshot = {
        configSnapshot: undefined,
        endpoints: [
          {
            averageRequestsPerSecond: 10,
            peakRequestsPerSecond: 10,
            targetAchieved: 0.75,
            totalRequests: 100,
            url: '/test',
          },
        ],
        global: {
          averageRequestsPerSecond: 10,
          avgProcessMemoryUsageMB: 100,
          avgSystemCpuUsagePercent: 50,
          epochEndedAt: BASE_TIME + 10000,
          epochStartedAt: BASE_TIME,
          finalDurationSec: 10,
          peakRequestsPerSecond: 10,
          targetAchieved: 0.75,
          totalRequests: 100,
        },
      } as unknown as TestSummary;

      const result = transformAggregatedMetricsToTestSummary([snapshot]);

      // No config → targetAchieved should not be overwritten
      expect(result.global.targetAchieved).toBe(0.75);
      // averageRequestsPerSecond still computes correctly (no config, no ramp-up → full duration)
      expect(result.global.averageRequestsPerSecond).toBe(10);
    });
  });

  describe('targetAchieved', () => {
    it('should compute global targetAchieved using steady-state duration, not full duration', () => {
      // 30 s test with 10 s ramp-up → 20 s steady-state window
      // 400 requests total; full-duration avg = 400/30 ≈ 13.33; steady-state avg = 400/20 = 20
      const config = {
        options: { rampUpDurationSec: 10 },
        requests: [{ rps: 20, url: '/test' }],
      } as unknown as TressiConfig;

      const snapshot = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 0,
            peakRequestsPerSecond: 20,
            totalRequests: 400,
            url: '/test',
          },
        ],
        global: {
          averageRequestsPerSecond: 0,
          avgProcessMemoryUsageMB: 100,
          avgSystemCpuUsagePercent: 50,
          epochEndedAt: BASE_TIME + 30000,
          epochStartedAt: BASE_TIME,
          finalDurationSec: 30,
          peakRequestsPerSecond: 20,
          totalRequests: 400,
        },
      } as unknown as TestSummary;

      const result = transformAggregatedMetricsToTestSummary([snapshot]);

      // global.averageRequestsPerSecond now uses steady-state duration (400/20 = 20)
      expect(result.global.averageRequestsPerSecond).toBe(20);
      // global.targetAchieved must use steady-state denominator (400/20 = 20 rps / 20 target = 1.0)
      expect(result.global.targetAchieved).toBeCloseTo(1.0, 5);
    });

    it('should compute global targetAchieved using sum of all endpoint rps as denominator', () => {
      // Two endpoints with different targets; one underperforms.
      // global.targetAchieved = steadyStateAvgRps / (rps_a + rps_b)
      const config = {
        options: { rampUpDurationSec: 0 },
        requests: [
          { rps: 20, url: '/fast' },
          { rps: 20, url: '/slow' },
        ],
      } as unknown as TressiConfig;

      // /fast delivers 20 rps; /slow only 10 rps → combined 300 total in 10 s = 30 rps actual
      const snapshot = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 0,
            peakRequestsPerSecond: 20,
            totalRequests: 200,
            url: '/fast',
          },
          {
            averageRequestsPerSecond: 0,
            peakRequestsPerSecond: 10,
            totalRequests: 100,
            url: '/slow',
          },
        ],
        global: {
          averageRequestsPerSecond: 0,
          avgProcessMemoryUsageMB: 100,
          avgSystemCpuUsagePercent: 50,
          epochEndedAt: BASE_TIME + 10000,
          epochStartedAt: BASE_TIME,
          finalDurationSec: 10,
          peakRequestsPerSecond: 20,
          totalRequests: 300,
        },
      } as unknown as TestSummary;

      const result = transformAggregatedMetricsToTestSummary([snapshot]);

      // totalTargetRps = 20 + 20 = 40
      // steadyStateAvgRps = 300 / 10 = 30  (no ramp-up → active duration == total duration)
      // global.targetAchieved = 30 / 40 = 0.75
      expect(result.global.targetAchieved).toBeCloseTo(0.75, 5);

      // Endpoint targetAchieved is computed independently
      // /fast: 200 / 10 = 20 rps / 20 = 1.0
      expect(result.endpoints[0].targetAchieved).toBeCloseTo(1.0, 5);
      // /slow: 100 / 10 = 10 rps / 20 = 0.5
      expect(result.endpoints[1].targetAchieved).toBeCloseTo(0.5, 5);
    });

    it('should fall back to full duration for global targetAchieved when ramp-up >= total duration', () => {
      // ramp-up (60 s) > totalDuration (5 s) → fall back to full duration (5 s)
      const config = {
        options: { rampUpDurationSec: 60 },
        requests: [{ rps: 10, url: '/test' }],
      } as unknown as TressiConfig;

      const snapshot = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 0,
            peakRequestsPerSecond: 10,
            totalRequests: 50,
            url: '/test',
          },
        ],
        global: {
          averageRequestsPerSecond: 0,
          avgProcessMemoryUsageMB: 80,
          avgSystemCpuUsagePercent: 30,
          epochEndedAt: BASE_TIME + 5000,
          epochStartedAt: BASE_TIME,
          finalDurationSec: 5,
          peakRequestsPerSecond: 10,
          totalRequests: 50,
        },
      } as unknown as TestSummary;

      const result = transformAggregatedMetricsToTestSummary([snapshot]);

      // globalActiveDurationSec falls back to 5 s → 50 / 5 = 10 rps / 10 target = 1.0
      expect(result.global.targetAchieved).toBeCloseTo(1.0, 5);
    });

    it('should not overwrite existing global targetAchieved when totalTargetRps is 0', () => {
      const config = {
        options: { rampUpDurationSec: 0 },
        requests: [{ rps: 0, url: '/test' }],
      } as unknown as TressiConfig;

      const snapshot = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 10,
            peakRequestsPerSecond: 10,
            totalRequests: 100,
            url: '/test',
          },
        ],
        global: {
          averageRequestsPerSecond: 10,
          avgProcessMemoryUsageMB: 100,
          avgSystemCpuUsagePercent: 50,
          epochEndedAt: BASE_TIME + 10000,
          epochStartedAt: BASE_TIME,
          finalDurationSec: 10,
          peakRequestsPerSecond: 10,
          targetAchieved: 0.42,
          totalRequests: 100,
        },
      } as unknown as TestSummary;

      const result = transformAggregatedMetricsToTestSummary([snapshot]);

      // totalTargetRps === 0 → guard prevents division; snapshot value preserved
      expect(result.global.targetAchieved).toBe(0.42);
    });

    it('should not overwrite existing endpoint targetAchieved when endpoint rps is 0', () => {
      const config = {
        options: { rampUpDurationSec: 0 },
        requests: [{ rps: 0, url: '/test' }],
      } as unknown as TressiConfig;

      const snapshot = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 10,
            peakRequestsPerSecond: 10,
            targetAchieved: 0.99,
            totalRequests: 100,
            url: '/test',
          },
        ],
        global: {
          averageRequestsPerSecond: 10,
          avgProcessMemoryUsageMB: 100,
          avgSystemCpuUsagePercent: 50,
          epochEndedAt: BASE_TIME + 10000,
          epochStartedAt: BASE_TIME,
          finalDurationSec: 10,
          peakRequestsPerSecond: 10,
          totalRequests: 100,
        },
      } as unknown as TestSummary;

      const result = transformAggregatedMetricsToTestSummary([snapshot]);

      // requestConfig.rps === 0 → guard prevents division; snapshot value is preserved
      expect(result.endpoints[0].targetAchieved).toBe(0.99);
    });
  });

  describe('multi-endpoint', () => {
    it('should compute per-endpoint metrics independently when multiple endpoints exist', () => {
      const config = {
        options: { rampUpDurationSec: 0 },
        requests: [
          { rps: 10, url: '/alpha' },
          { rps: 20, url: '/beta' },
        ],
      } as unknown as TressiConfig;

      // Single snapshot; both endpoints fully active, no ramp-up
      const snapshot = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 0,
            peakRequestsPerSecond: 10,
            totalRequests: 100,
            url: '/alpha',
          },
          {
            averageRequestsPerSecond: 0,
            peakRequestsPerSecond: 20,
            totalRequests: 200,
            url: '/beta',
          },
        ],
        global: {
          averageRequestsPerSecond: 0,
          avgProcessMemoryUsageMB: 100,
          avgSystemCpuUsagePercent: 50,
          epochEndedAt: BASE_TIME + 10000,
          epochStartedAt: BASE_TIME,
          finalDurationSec: 10,
          peakRequestsPerSecond: 20,
          totalRequests: 300,
        },
      } as unknown as TestSummary;

      const result = transformAggregatedMetricsToTestSummary([snapshot]);

      // /alpha: 100 / 10 s = 10 rps; targetAchieved = 10/10 = 1.0
      expect(result.endpoints[0].averageRequestsPerSecond).toBe(10);
      expect(result.endpoints[0].targetAchieved).toBeCloseTo(1.0, 5);

      // /beta: 200 / 10 s = 20 rps; targetAchieved = 20/20 = 1.0
      expect(result.endpoints[1].averageRequestsPerSecond).toBe(20);
      expect(result.endpoints[1].targetAchieved).toBeCloseTo(1.0, 5);

      // global: 300 / 10 s = 30 rps
      expect(result.global.averageRequestsPerSecond).toBe(30);
      // global targetAchieved: steady-state avg (30) / totalTargetRps (30) = 1.0
      expect(result.global.targetAchieved).toBeCloseTo(1.0, 5);
    });

    it('should set peakRequestsPerSecond to 0 for an endpoint absent from all snapshots', () => {
      const config = {
        options: { rampUpDurationSec: 0 },
        requests: [
          { rps: 10, url: '/present' },
          { rps: 10, url: '/absent' },
        ],
      } as unknown as TressiConfig;

      // First snapshot: only /present appears — /absent has not started yet.
      const snapshot1 = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 10,
            peakRequestsPerSecond: 12,
            totalRequests: 100,
            url: '/present',
          },
        ],
        global: {
          averageRequestsPerSecond: 10,
          avgProcessMemoryUsageMB: 100,
          avgSystemCpuUsagePercent: 50,
          epochEndedAt: BASE_TIME + 5000,
          epochStartedAt: BASE_TIME,
          finalDurationSec: 5,
          peakRequestsPerSecond: 12,
          totalRequests: 100,
        },
      } as unknown as TestSummary;

      // Last snapshot: /absent appears in endpoints (cumulative data) but was never in
      // any polling snapshot, so no snapshot will match it during the scan loop.
      const snapshot2 = {
        configSnapshot: config,
        endpoints: [
          {
            averageRequestsPerSecond: 10,
            peakRequestsPerSecond: 12,
            totalRequests: 100,
            url: '/present',
          },
          {
            averageRequestsPerSecond: 0,
            peakRequestsPerSecond: 0,
            totalRequests: 0,
            url: '/absent',
          },
        ],
        global: {
          averageRequestsPerSecond: 10,
          avgProcessMemoryUsageMB: 100,
          avgSystemCpuUsagePercent: 50,
          epochEndedAt: BASE_TIME + 10000,
          epochStartedAt: BASE_TIME,
          finalDurationSec: 10,
          peakRequestsPerSecond: 12,
          totalRequests: 100,
        },
      } as unknown as TestSummary;

      const result = transformAggregatedMetricsToTestSummary([snapshot1, snapshot2]);

      // /absent appears in the last-snapshot endpoints but was never seen in any polling snapshot
      // → endpointSnapshots is empty → peakRequestsPerSecond must be 0 (not -Infinity)
      const absentEndpoint = result.endpoints.find((e) => e.url === '/absent');
      expect(absentEndpoint).toBeDefined();
      expect(absentEndpoint!.peakRequestsPerSecond).toBe(0);
      expect(absentEndpoint!.averageRequestsPerSecond).toBe(0);
    });
  });
});
