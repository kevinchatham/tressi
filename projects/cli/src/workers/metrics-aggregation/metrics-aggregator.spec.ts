import type { IHdrHistogramManager, IStatsCounterManager } from '@tressi/shared/cli';
import type { TressiConfig } from '@tressi/shared/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MetricsAggregator } from './metrics-aggregator';

describe('MetricsAggregator', () => {
  let mockHdrHistogramManagers: IHdrHistogramManager[];
  let mockStatsCounterManagers: IStatsCounterManager[];
  let aggregator: MetricsAggregator;

  beforeEach(() => {
    // Mock HDR histogram managers
    mockHdrHistogramManagers = [
      {
        getAllEndpointHistograms: vi.fn().mockReturnValue([]),
        recordLatency: vi.fn(),
      },
      {
        getAllEndpointHistograms: vi.fn().mockReturnValue([]),
        recordLatency: vi.fn(),
      },
    ];

    // Mock stats counter managers
    mockStatsCounterManagers = [
      {
        getAllEndpointCounters: vi.fn().mockReturnValue([]),
        getEndpointCounters: vi.fn().mockReturnValue({
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 0,
        }),
        getEndpointsCount: vi.fn().mockReturnValue(2),
        recordBytesReceived: vi.fn(),
        recordBytesSent: vi.fn(),
        recordRequest: vi.fn(),
        recordStatusCode: vi.fn(),
      },
      {
        getAllEndpointCounters: vi.fn().mockReturnValue([]),
        getEndpointCounters: vi.fn().mockReturnValue({
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 0,
        }),
        getEndpointsCount: vi.fn().mockReturnValue(1),
        recordBytesReceived: vi.fn(),
        recordBytesSent: vi.fn(),
        recordRequest: vi.fn(),
        recordStatusCode: vi.fn(),
      },
    ];

    // Mock console.log
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided managers', () => {
      aggregator = new MetricsAggregator(
        mockHdrHistogramManagers,
        mockStatsCounterManagers,
        {},
        'test-run-id',
      );

      expect(aggregator).toBeInstanceOf(MetricsAggregator);
    });
  });

  describe('startPolling and stopPolling', () => {
    beforeEach(() => {
      aggregator = new MetricsAggregator(
        mockHdrHistogramManagers,
        mockStatsCounterManagers,
        {},
        'test-run-id',
      );
    });

    it('should start polling with default interval', () => {
      expect(() => aggregator.startPolling()).not.toThrow();
      aggregator.stopPolling();
    });

    it('should start polling with custom interval', () => {
      expect(() => aggregator.startPolling(50)).not.toThrow();
      aggregator.stopPolling();
    });

    it('should clear existing polling interval when starting new one', () => {
      aggregator.startPolling(100);
      expect(() => aggregator.startPolling(50)).not.toThrow();
      aggregator.stopPolling();
    });

    it('should stop polling and clear interval', () => {
      aggregator.startPolling();
      expect(() => aggregator.stopPolling()).not.toThrow();
    });

    it('should handle stopping when no interval exists', () => {
      expect(() => aggregator.stopPolling()).not.toThrow();
    });
  });

  describe('getResults', () => {
    beforeEach(() => {
      aggregator = new MetricsAggregator(
        mockHdrHistogramManagers,
        mockStatsCounterManagers,
        {},
        'test-run-id',
      );
    });

    it('should return aggregated metrics with no data', () => {
      vi.mocked(mockStatsCounterManagers[0].getAllEndpointCounters).mockReturnValue([
        {
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 0,
        },
        {
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 0,
        },
      ]);
      vi.mocked(mockStatsCounterManagers[1].getAllEndpointCounters).mockReturnValue([
        {
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 0,
        },
      ]);

      vi.mocked(mockHdrHistogramManagers[0].getAllEndpointHistograms).mockReturnValue([
        {
          buckets: [],
          max: 0,
          mean: 0,
          min: 0,
          percentiles: {},
          stdDev: 0,
          totalCount: 0,
        },
        {
          buckets: [],
          max: 0,
          mean: 0,
          min: 0,
          percentiles: {},
          stdDev: 0,
          totalCount: 0,
        },
      ]);
      vi.mocked(mockHdrHistogramManagers[1].getAllEndpointHistograms).mockReturnValue([
        {
          buckets: [],
          max: 0,
          mean: 0,
          min: 0,
          percentiles: {},
          stdDev: 0,
          totalCount: 0,
        },
      ]);

      const results = aggregator.getResults(2, [
        'http://example.com/api/1',
        'http://example.com/api/2',
        'http://example.com/api/3',
      ]);

      expect(results.global.totalRequests).toBe(0);
      expect(results.global.successfulRequests).toBe(0);
      expect(results.global.failedRequests).toBe(0);
      expect(results.endpoints).toBeDefined();
    });

    it('should aggregate metrics from all workers', () => {
      vi.mocked(mockStatsCounterManagers[0].getAllEndpointCounters).mockReturnValue([
        {
          bodySampleIndices: [],
          bytesReceived: 10000,
          bytesSent: 5000,
          failureCount: 2,
          sampledStatusCodes: [],
          statusCodeCounts: { 200: 8, 404: 2 },
          successCount: 10,
        },
        {
          bodySampleIndices: [],
          bytesReceived: 5000,
          bytesSent: 2500,
          failureCount: 1,
          sampledStatusCodes: [],
          statusCodeCounts: { 200: 5 },
          successCount: 5,
        },
      ]);
      vi.mocked(mockStatsCounterManagers[1].getAllEndpointCounters).mockReturnValue([
        {
          bodySampleIndices: [],
          bytesReceived: 15000,
          bytesSent: 7500,
          failureCount: 3,
          sampledStatusCodes: [],
          statusCodeCounts: { 200: 12, 500: 3 },
          successCount: 15,
        },
      ]);

      vi.mocked(mockHdrHistogramManagers[0].getAllEndpointHistograms).mockReturnValue([
        {
          buckets: [
            { count: 2, lowerBound: 0, upperBound: 50 },
            { count: 6, lowerBound: 50, upperBound: 100 },
            { count: 4, lowerBound: 100, upperBound: 200 },
          ],
          max: 200,
          mean: 100,
          min: 50,
          percentiles: { 50: 95, 95: 180, 99: 195 },
          stdDev: 50,
          totalCount: 12,
        },
        {
          buckets: [
            { count: 2, lowerBound: 0, upperBound: 100 },
            { count: 3, lowerBound: 100, upperBound: 200 },
            { count: 1, lowerBound: 200, upperBound: 300 },
          ],
          max: 300,
          mean: 150,
          min: 80,
          percentiles: { 50: 140, 95: 280, 99: 295 },
          stdDev: 75,
          totalCount: 6,
        },
      ]);
      vi.mocked(mockHdrHistogramManagers[1].getAllEndpointHistograms).mockReturnValue([
        {
          buckets: [
            { count: 3, lowerBound: 0, upperBound: 60 },
            { count: 9, lowerBound: 60, upperBound: 120 },
            { count: 6, lowerBound: 120, upperBound: 250 },
          ],
          max: 250,
          mean: 120,
          min: 60,
          percentiles: { 50: 115, 95: 220, 99: 240 },
          stdDev: 60,
          totalCount: 18,
        },
      ]);

      const results = aggregator.getResults(2, [
        'http://example.com/api/1',
        'http://example.com/api/2',
        'http://example.com/api/3',
      ]);

      expect(results.global.totalRequests).toBe(36);
      expect(results.global.successfulRequests).toBe(30);
      expect(results.global.failedRequests).toBe(6);
      expect(results.endpoints.find((e) => e.url === 'http://example.com/api/1')).toBeDefined();
      expect(results.endpoints.find((e) => e.url === 'http://example.com/api/2')).toBeDefined();
      expect(results.endpoints.find((e) => e.url === 'http://example.com/api/3')).toBeDefined();
    });
  });

  describe('Timestamp Management', () => {
    // biome-ignore lint/suspicious/noExplicitAny: test
    let mockConfig: any;

    beforeEach(() => {
      mockConfig = {
        requests: [
          {
            duration: 60,
            method: 'GET',
            rps: 10,
            url: 'http://example.com',
          },
        ],
      };
    });

    it('should set endTime when stopPolling is called', () => {
      const aggregator = new MetricsAggregator(
        mockHdrHistogramManagers,
        mockStatsCounterManagers,
        {},
        'test-run-id',
      );

      aggregator.startPolling();
      const beforeStop = Date.now();
      aggregator.stopPolling();
      const afterStop = Date.now();

      const endTime = aggregator.endTime;
      expect(endTime).toBeGreaterThanOrEqual(beforeStop);
      expect(endTime).toBeLessThanOrEqual(afterStop);
    });

    it('should pass correct timestamps to transformAggregatedMetricToTestSummary', () => {
      const aggregator = new MetricsAggregator(
        mockHdrHistogramManagers,
        mockStatsCounterManagers,
        {},
        'test-run-id',
      );

      const startTime = Date.now() - 5000;
      aggregator.setStartTime(startTime);
      aggregator.setConfig(mockConfig);
      aggregator.setEndpoints(['http://example.com']);

      const endTime = Date.now();
      aggregator.setEndTime(endTime);

      const summary = aggregator.getTestSummary();

      expect(summary.global.epochStartedAt).toBe(startTime);
      expect(summary.global.epochEndedAt).toBeCloseTo(endTime, -2);
    });
  });

  describe('Peak Instant RPS Tracking', () => {
    beforeEach(() => {
      aggregator = new MetricsAggregator(
        mockHdrHistogramManagers,
        mockStatsCounterManagers,
        {},
        'test-run-id',
      );
    });

    it('should calculate global instantaneous RPS correctly', () => {
      const startTime = 1000;
      const pollTime = 2000; // 1 second later

      vi.useFakeTimers();
      vi.setSystemTime(startTime);

      aggregator.setStartTime(startTime);

      // First poll (or initial state)
      vi.mocked(mockStatsCounterManagers[0].getAllEndpointCounters).mockReturnValue([
        {
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 0,
        },
        {
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 0,
        },
      ]);
      vi.mocked(mockStatsCounterManagers[1].getAllEndpointCounters).mockReturnValue([
        {
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 0,
        },
      ]);

      aggregator.getResults(2, ['url1', 'url2', 'url3']);

      // Advance time and increase request counts
      vi.setSystemTime(pollTime);

      vi.mocked(mockStatsCounterManagers[0].getAllEndpointCounters).mockReturnValue([
        {
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 5,
        },
        {
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 5,
        },
      ]);
      vi.mocked(mockStatsCounterManagers[1].getAllEndpointCounters).mockReturnValue([
        {
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 10,
        },
      ]);

      // Total requests = 5 + 5 + 10 = 20
      // Time diff = 1s
      // RPS = 20 / 1 = 20

      const results = aggregator.getResults(2, ['url1', 'url2', 'url3']);

      // Since we haven't reached steady state (rampUpDurationSec defaults to 0, but we haven't pushed any snapshots yet)
      // averageRequestsPerSecond should be the current interval RPS (20)
      expect(results.global.averageRequestsPerSecond).toBe(20);
      expect(results.global.peakRequestsPerSecond).toBe(20);

      // Second poll with lower RPS
      vi.setSystemTime(3000);
      vi.mocked(mockStatsCounterManagers[0].getAllEndpointCounters).mockReturnValue([
        {
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 7, // +2
        },
        {
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 8, // +3
        },
      ]);
      vi.mocked(mockStatsCounterManagers[1].getAllEndpointCounters).mockReturnValue([
        {
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 15, // +5
        },
      ]);
      // Total requests = 7 + 8 + 15 = 30
      // Request diff = 30 - 20 = 10
      // Time diff = 1s
      // Interval RPS = 10 / 1 = 10
      // Peak RPS should remain 20 (high-water mark)

      const results2 = aggregator.getResults(2, ['url1', 'url2', 'url3']);
      expect(results2.global.peakRequestsPerSecond).toBe(20);
      expect(results2.global.averageRequestsPerSecond).toBe(10); // Still not in steady state because we haven't pushed snapshots to _snapshots yet in this test

      vi.useRealTimers();
    });

    it('should calculate cumulative average RPS from steady state', () => {
      const startTime = 1000;
      vi.useFakeTimers();
      vi.setSystemTime(startTime);

      aggregator.setStartTime(startTime);
      aggregator.setConfig({
        options: { rampUpDurationSec: 1 },
        requests: [{ rps: 10, url: 'url1' }],
      } as unknown as TressiConfig);
      aggregator.setEndpoints(['url1']);

      const baseCounters = {
        bodySampleIndices: [],
        bytesReceived: 0,
        bytesSent: 0,
        failureCount: 0,
        sampledStatusCodes: [],
        statusCodeCounts: {},
        successCount: 0,
      };

      // 1. Initial poll at T=1000 (Start)
      vi.mocked(mockStatsCounterManagers[0].getAllEndpointCounters).mockReturnValue([
        { ...baseCounters },
      ]);
      vi.mocked(mockStatsCounterManagers[1].getAllEndpointCounters).mockReturnValue([]);
      aggregator.getResults(1, ['url1']); // This updates _previousGlobalCounts

      // 2. Poll at T=2000 (End of ramp-up)
      vi.setSystemTime(2000);
      vi.mocked(mockStatsCounterManagers[0].getAllEndpointCounters).mockReturnValue([
        { ...baseCounters, successCount: 10 },
      ]);
      const resRampEnd = aggregator.getResults(1, ['url1']);
      // @ts-expect-error - accessing private for test verification
      aggregator._snapshots.push(resRampEnd);

      // 3. Poll at T=3000 (Steady state 1s)
      vi.setSystemTime(3000);
      vi.mocked(mockStatsCounterManagers[0].getAllEndpointCounters).mockReturnValue([
        { ...baseCounters, successCount: 30 },
      ]);
      // Interval RPS = (30-10)/1 = 20
      // Steady state started at T=2000.
      // Steady requests = 30 - 10 = 20.
      // Steady duration = 3000 - 2000 = 1s.
      // Average RPS = 20 / 1 = 20.
      const resSteady1 = aggregator.getResults(1, ['url1']);
      expect(resSteady1.global.averageRequestsPerSecond).toBe(20);
      // @ts-expect-error
      aggregator._snapshots.push(resSteady1);

      // 4. Poll at T=4000 (Steady state 2s)
      vi.setSystemTime(4000);
      vi.mocked(mockStatsCounterManagers[0].getAllEndpointCounters).mockReturnValue([
        { ...baseCounters, successCount: 40 },
      ]);
      // Interval RPS = (40-30)/1 = 10
      // Steady requests = 40 - 10 = 30.
      // Steady duration = 4000 - 2000 = 2s.
      // Average RPS = 30 / 2 = 15.
      const resSteady2 = aggregator.getResults(1, ['url1']);
      expect(resSteady2.global.averageRequestsPerSecond).toBe(15);
      expect(resSteady2.global.peakRequestsPerSecond).toBe(20); // Peak was 20 at T=3000

      vi.useRealTimers();
    });

    it('should calculate endpoint instantaneous RPS correctly', () => {
      const startTime = 1000;
      const pollTime = 2000; // 1 second later

      vi.useFakeTimers();
      vi.setSystemTime(startTime);

      aggregator.setStartTime(startTime);
      aggregator.setEndpoints(['url1', 'url2', 'url3']);

      // Initial state via getResults
      vi.mocked(mockStatsCounterManagers[0].getAllEndpointCounters).mockReturnValue([
        {
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 0,
        },
        {
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 0,
        },
      ]);
      vi.mocked(mockStatsCounterManagers[1].getAllEndpointCounters).mockReturnValue([
        {
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 0,
        },
      ]);

      aggregator.getResults(2, ['url1', 'url2', 'url3']);

      // Advance time and increase request counts for url1
      vi.setSystemTime(pollTime);

      // url1 is at index 0 (worker 0, local 0) and index 1 (worker 1, local 0)
      // Wait, _getGlobalEndpointIndex(workerId, localEndpointIndex) = workerId + localEndpointIndex * workersCount
      // workersCount = 2
      // url1 (index 0): worker 0, local 0 -> 0 + 0*2 = 0
      // url2 (index 1): worker 1, local 0 -> 1 + 0*2 = 1
      // url3 (index 2): worker 0, local 1 -> 0 + 1*2 = 2

      vi.mocked(mockStatsCounterManagers[0].getAllEndpointCounters).mockReturnValue([
        {
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 10,
        }, // url1
        {
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 0,
        }, // url3
      ]);
      vi.mocked(mockStatsCounterManagers[1].getAllEndpointCounters).mockReturnValue([
        {
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 5,
        }, // url2
      ]);

      const results = aggregator.getResults(2, ['url1', 'url2', 'url3']);

      const url1Result = results.endpoints.find((e) => e.url === 'url1');
      const url2Result = results.endpoints.find((e) => e.url === 'url2');

      expect(url1Result?.averageRequestsPerSecond).toBe(10);
      expect(url2Result?.averageRequestsPerSecond).toBe(5);

      vi.useRealTimers();
    });

    it('should handle zero time difference gracefully', () => {
      const startTime = 1000;

      vi.useFakeTimers();
      vi.setSystemTime(startTime);

      aggregator.setStartTime(startTime);

      vi.mocked(mockStatsCounterManagers[0].getAllEndpointCounters).mockReturnValue([
        {
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 10,
        },
        {
          bodySampleIndices: [],
          bytesReceived: 0,
          bytesSent: 0,
          failureCount: 0,
          sampledStatusCodes: [],
          statusCodeCounts: {},
          successCount: 0,
        },
      ]);

      // Same timestamp as start
      const results = aggregator.getResults(1, ['url1', 'url2']);

      expect(results.global.averageRequestsPerSecond).toBe(0);

      vi.useRealTimers();
    });
  });
});
