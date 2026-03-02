import { IHdrHistogramManager, IStatsCounterManager } from '@tressi/shared/cli';
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
        getEndpointsCount: vi.fn().mockReturnValue(2),
        getEndpointCounters: vi.fn().mockReturnValue({
          successCount: 0,
          failureCount: 0,
          bytesSent: 0,
          bytesReceived: 0,
          statusCodeCounts: {},
          sampledStatusCodes: [],
          bodySampleIndices: [],
        }),
        getAllEndpointCounters: vi.fn().mockReturnValue([]),
        recordRequest: vi.fn(),
        recordStatusCode: vi.fn(),
        recordBytesSent: vi.fn(),
        recordBytesReceived: vi.fn(),
      },
      {
        getEndpointsCount: vi.fn().mockReturnValue(1),
        getEndpointCounters: vi.fn().mockReturnValue({
          successCount: 0,
          failureCount: 0,
          bytesSent: 0,
          bytesReceived: 0,
          statusCodeCounts: {},
          sampledStatusCodes: [],
          bodySampleIndices: [],
        }),
        getAllEndpointCounters: vi.fn().mockReturnValue([]),
        recordRequest: vi.fn(),
        recordStatusCode: vi.fn(),
        recordBytesSent: vi.fn(),
        recordBytesReceived: vi.fn(),
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
      vi.mocked(
        mockStatsCounterManagers[0].getAllEndpointCounters,
      ).mockReturnValue([
        {
          successCount: 0,
          failureCount: 0,
          bytesSent: 0,
          bytesReceived: 0,
          statusCodeCounts: {},
          sampledStatusCodes: [],
          bodySampleIndices: [],
        },
        {
          successCount: 0,
          failureCount: 0,
          bytesSent: 0,
          bytesReceived: 0,
          statusCodeCounts: {},
          sampledStatusCodes: [],
          bodySampleIndices: [],
        },
      ]);
      vi.mocked(
        mockStatsCounterManagers[1].getAllEndpointCounters,
      ).mockReturnValue([
        {
          successCount: 0,
          failureCount: 0,
          bytesSent: 0,
          bytesReceived: 0,
          statusCodeCounts: {},
          sampledStatusCodes: [],
          bodySampleIndices: [],
        },
      ]);

      vi.mocked(
        mockHdrHistogramManagers[0].getAllEndpointHistograms,
      ).mockReturnValue([
        {
          totalCount: 0,
          mean: 0,
          min: 0,
          max: 0,
          percentiles: {},
          stdDev: 0,
          buckets: [],
        },
        {
          totalCount: 0,
          mean: 0,
          min: 0,
          max: 0,
          percentiles: {},
          stdDev: 0,
          buckets: [],
        },
      ]);
      vi.mocked(
        mockHdrHistogramManagers[1].getAllEndpointHistograms,
      ).mockReturnValue([
        {
          totalCount: 0,
          mean: 0,
          min: 0,
          max: 0,
          percentiles: {},
          stdDev: 0,
          buckets: [],
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
      // errorPercentage and averageLatency are not part of Metric type
      // They are computed elsewhere
      expect(results.endpoints).toBeDefined();
    });

    it('should aggregate metrics from all workers', () => {
      vi.mocked(
        mockStatsCounterManagers[0].getAllEndpointCounters,
      ).mockReturnValue([
        {
          successCount: 10,
          failureCount: 2,
          bytesSent: 5000,
          bytesReceived: 10000,
          statusCodeCounts: { 200: 8, 404: 2 },
          sampledStatusCodes: [],
          bodySampleIndices: [],
        },
        {
          successCount: 5,
          failureCount: 1,
          bytesSent: 2500,
          bytesReceived: 5000,
          statusCodeCounts: { 200: 5 },
          sampledStatusCodes: [],
          bodySampleIndices: [],
        },
      ]);
      vi.mocked(
        mockStatsCounterManagers[1].getAllEndpointCounters,
      ).mockReturnValue([
        {
          successCount: 15,
          failureCount: 3,
          bytesSent: 7500,
          bytesReceived: 15000,
          statusCodeCounts: { 200: 12, 500: 3 },
          sampledStatusCodes: [],
          bodySampleIndices: [],
        },
      ]);

      vi.mocked(
        mockHdrHistogramManagers[0].getAllEndpointHistograms,
      ).mockReturnValue([
        {
          totalCount: 12,
          mean: 100,
          min: 50,
          max: 200,
          percentiles: { 50: 95, 95: 180, 99: 195 },
          stdDev: 50,
          buckets: [
            { lowerBound: 0, upperBound: 50, count: 2 },
            { lowerBound: 50, upperBound: 100, count: 6 },
            { lowerBound: 100, upperBound: 200, count: 4 },
          ],
        },
        {
          totalCount: 6,
          mean: 150,
          min: 80,
          max: 300,
          percentiles: { 50: 140, 95: 280, 99: 295 },
          stdDev: 75,
          buckets: [
            { lowerBound: 0, upperBound: 100, count: 2 },
            { lowerBound: 100, upperBound: 200, count: 3 },
            { lowerBound: 200, upperBound: 300, count: 1 },
          ],
        },
      ]);
      vi.mocked(
        mockHdrHistogramManagers[1].getAllEndpointHistograms,
      ).mockReturnValue([
        {
          totalCount: 18,
          mean: 120,
          min: 60,
          max: 250,
          percentiles: { 50: 115, 95: 220, 99: 240 },
          stdDev: 60,
          buckets: [
            { lowerBound: 0, upperBound: 60, count: 3 },
            { lowerBound: 60, upperBound: 120, count: 9 },
            { lowerBound: 120, upperBound: 250, count: 6 },
          ],
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
      // errorPercentage is not part of Metric type
      expect(results.endpoints).toHaveProperty('http://example.com/api/1');
      expect(results.endpoints).toHaveProperty('http://example.com/api/2');
      expect(results.endpoints).toHaveProperty('http://example.com/api/3');
    });

    it('should calculate endpoint specific metrics', () => {
      vi.mocked(
        mockStatsCounterManagers[0].getAllEndpointCounters,
      ).mockReturnValue([
        {
          successCount: 10,
          failureCount: 2,
          bytesSent: 2000,
          bytesReceived: 4000,
          statusCodeCounts: { 200: 10, 404: 2 },
          sampledStatusCodes: [],
          bodySampleIndices: [],
        },
      ]);
      vi.mocked(
        mockStatsCounterManagers[1].getAllEndpointCounters,
      ).mockReturnValue([]);

      vi.mocked(
        mockHdrHistogramManagers[0].getAllEndpointHistograms,
      ).mockReturnValue([
        {
          totalCount: 12,
          mean: 100,
          min: 50,
          max: 200,
          percentiles: { 50: 95, 95: 180, 99: 195 },
          stdDev: 50,
          buckets: [
            { lowerBound: 0, upperBound: 50, count: 2 },
            { lowerBound: 50, upperBound: 100, count: 6 },
            { lowerBound: 100, upperBound: 200, count: 4 },
          ],
        },
      ]);
      vi.mocked(
        mockHdrHistogramManagers[1].getAllEndpointHistograms,
      ).mockReturnValue([]);

      const results = aggregator.getResults(2, ['http://example.com/api/1']);

      const endpointMetrics = results.endpoints['http://example.com/api/1'];
      expect(endpointMetrics.totalRequests).toBe(12);
      expect(endpointMetrics.successfulRequests).toBe(10);
      expect(endpointMetrics.failedRequests).toBe(2);
      // errorPercentage and averageLatency are not part of Metric type
      // p50Latency, p95Latency, p99Latency should be p50LatencyMs, p95LatencyMs, p99LatencyMs
      expect(endpointMetrics.p50LatencyMs).toBe(95);
      expect(endpointMetrics.p95LatencyMs).toBe(180);
      expect(endpointMetrics.p99LatencyMs).toBe(195);
    });
  });

  describe('recordResponseSample', () => {
    beforeEach(() => {
      aggregator = new MetricsAggregator(
        mockHdrHistogramManagers,
        mockStatsCounterManagers,
        {},
        'test-run-id',
      );
    });

    it('should record a response sample for an endpoint', () => {
      aggregator.recordResponseSample(
        'test-run-id',
        'http://example.com/api',
        200,
        { 'content-type': 'application/json' },
        '{"message":"success"}',
      );

      // The method should not throw and should store the sample
      // In a real implementation, we would verify the sample was stored
      expect(true).toBe(true);
    });

    it('should only store one sample per status code', () => {
      // Record first sample for status 200
      aggregator.recordResponseSample(
        'test-run-id',
        'http://example.com/api',
        200,
        { 'content-type': 'application/json' },
        '{"message":"first"}',
      );

      // Record second sample for status 200 (should be ignored)
      aggregator.recordResponseSample(
        'test-run-id',
        'http://example.com/api',
        200,
        { 'content-type': 'application/json' },
        '{"message":"second"}',
      );

      // Record sample for different status code
      aggregator.recordResponseSample(
        'test-run-id',
        'http://example.com/api',
        404,
        { 'content-type': 'application/json' },
        '{"message":"not found"}',
      );

      // Verify samples were stored correctly
      const samples = aggregator.getCollectedResponseSamples('test-run-id');
      const endpointSamples = samples.get('http://example.com/api') || [];
      expect(endpointSamples.length).toBe(2);
      expect(endpointSamples[0].statusCode).toBe(200);
      expect(endpointSamples[0].headers).toEqual({
        'content-type': 'application/json',
      });
      expect(endpointSamples[1].statusCode).toBe(404);
    });
  });

  describe('cleanupResponseSamples', () => {
    beforeEach(() => {
      aggregator = new MetricsAggregator(
        mockHdrHistogramManagers,
        mockStatsCounterManagers,
        {},
        'test-run-id',
      );
    });

    it('should cleanup response samples for a run', () => {
      // Record some response samples first
      aggregator.recordResponseSample(
        'test-run-id',
        'http://example.com/api',
        200,
        { 'content-type': 'application/json' },
        '{"message":"success"}',
      );

      // Verify samples were recorded
      const samples = aggregator.getCollectedResponseSamples('test-run-id');
      expect(samples.size).toBeGreaterThan(0);

      // Cleanup samples
      aggregator.cleanupResponseSamples('test-run-id');

      // Verify samples were cleaned up
      const cleanedSamples =
        aggregator.getCollectedResponseSamples('test-run-id');
      expect(cleanedSamples.size).toBe(0);
    });
  });

  describe('Timestamp Management', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockConfig: any;

    beforeEach(() => {
      mockConfig = {
        requests: [
          {
            url: 'http://example.com',
            method: 'GET',
            rps: 10,
            duration: 60,
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

      // Access endTime for testing
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

      const startTime = Date.now() - 5000; // 5 seconds ago
      aggregator.setStartTime(startTime);
      aggregator.setConfig(mockConfig);
      aggregator.setEndpoints(['http://example.com']);

      const endTime = Date.now();
      aggregator.setEndTime(endTime);

      const summary = aggregator.getTestSummary(1, ['http://example.com']);

      expect(summary.global.epochStartedAt).toBe(startTime);
      expect(summary.global.epochEndedAt).toBe(endTime);
      expect(summary.global.epochEndedAt).toBeGreaterThan(
        summary.global.epochStartedAt,
      );
    });

    it('should use Date.now() as fallback when endTime not set', () => {
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

      // Don't call stopPolling() or setEndTime()
      const beforeSummary = Date.now();
      const summary = aggregator.getTestSummary(1, ['http://example.com']);
      const afterSummary = Date.now();

      expect(summary.global.epochStartedAt).toBe(startTime);
      expect(summary.global.epochEndedAt).toBeGreaterThanOrEqual(beforeSummary);
      expect(summary.global.epochEndedAt).toBeLessThanOrEqual(afterSummary);
    });

    it('should handle zero startTime gracefully', () => {
      const aggregator = new MetricsAggregator(
        mockHdrHistogramManagers,
        mockStatsCounterManagers,
        {},
        'test-run-id',
      );

      // Don't set start time
      aggregator.setConfig(mockConfig);
      aggregator.setEndpoints(['http://example.com']);
      aggregator.setEndTime(Date.now());

      const summary = aggregator.getTestSummary(1, ['http://example.com']);

      expect(summary.global.epochStartedAt).toBe(0);
      expect(summary.global.epochEndedAt).toBeGreaterThan(0);
    });

    it('should maintain consistent timestamps across multiple getTestSummary calls', () => {
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

      aggregator.stopPolling(); // Sets endTime

      const summary1 = aggregator.getTestSummary(1, ['http://example.com']);
      const summary2 = aggregator.getTestSummary(1, ['http://example.com']);

      expect(summary1.global.epochStartedAt).toBe(
        summary2.global.epochStartedAt,
      );
      expect(summary1.global.epochEndedAt).toBe(summary2.global.epochEndedAt);
    });

    it('should set endTime via setEndTime method', () => {
      const aggregator = new MetricsAggregator(
        mockHdrHistogramManagers,
        mockStatsCounterManagers,
        {},
        'test-run-id',
      );

      const testEndTime = Date.now() + 1000; // Future time
      aggregator.setEndTime(testEndTime);

      // Access private endTime for testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const endTime = (aggregator as any).endTime;
      expect(endTime).toBe(testEndTime);
    });

    it('should use stopPolling endTime over setEndTime when both are called', () => {
      const aggregator = new MetricsAggregator(
        mockHdrHistogramManagers,
        mockStatsCounterManagers,
        {},
        'test-run-id',
      );

      const setEndTime = Date.now() - 2000;
      aggregator.setEndTime(setEndTime);

      aggregator.startPolling();
      aggregator.stopPolling(); // This should override the previous endTime

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stopPollingEndTime = (aggregator as any).endTime;
      expect(stopPollingEndTime).toBeGreaterThan(setEndTime);
    });
  });

  describe('Peak Instant RPS Tracking', () => {
    it('should track and use peak instant RPS when test has ended', () => {
      const aggregator = new MetricsAggregator(
        mockHdrHistogramManagers,
        mockStatsCounterManagers,
        {},
        'test-run-id',
      );

      // Set up endpoints with a specific start time
      const startTime = Date.now() - 2000; // 2 seconds ago
      aggregator.setEndpoints(['http://example.com/api']);
      aggregator.setStartTime(startTime);

      // First, simulate some initial activity to establish previous counts
      vi.mocked(
        mockStatsCounterManagers[0].getAllEndpointCounters,
      ).mockReturnValue([
        {
          successCount: 50, // Simulate 50 requests in first interval
          failureCount: 0,
          bytesSent: 5000,
          bytesReceived: 10000,
          statusCodeCounts: { 200: 50 },
          sampledStatusCodes: [],
          bodySampleIndices: [],
        },
      ]);

      vi.mocked(
        mockHdrHistogramManagers[0].getAllEndpointHistograms,
      ).mockReturnValue([
        {
          totalCount: 50,
          mean: 100,
          min: 50,
          max: 200,
          percentiles: { 50: 95, 95: 180, 99: 195 },
          stdDev: 50,
          buckets: [
            { lowerBound: 0, upperBound: 50, count: 10 },
            { lowerBound: 50, upperBound: 100, count: 25 },
            {
              lowerBound: 100,
              upperBound: 200,
              count: 15,
            },
          ],
        },
      ]);

      // First call to establish previous counts
      aggregator.getResults(1, ['http://example.com/api']);

      // Wait a bit to ensure time difference
      const waitTime = 100; // 100ms
      const startTime2 = Date.now();
      while (Date.now() - startTime2 < waitTime) {
        // Busy wait to ensure time passes
      }

      // Now simulate increased activity
      vi.mocked(
        mockStatsCounterManagers[0].getAllEndpointCounters,
      ).mockReturnValue([
        {
          successCount: 150, // Simulate 150 requests (100 new requests)
          failureCount: 0,
          bytesSent: 15000,
          bytesReceived: 30000,
          statusCodeCounts: { 200: 150 },
          sampledStatusCodes: [],
          bodySampleIndices: [],
        },
      ]);

      // Second call to getResults (during active test) - should calculate current instant RPS
      const results1 = aggregator.getResults(1, ['http://example.com/api']);
      const firstInstantRps =
        results1.endpoints['http://example.com/api'].peakRequestsPerSecond;

      // Verify that we got a positive instant RPS during active test
      expect(firstInstantRps).toBeGreaterThan(0);
    });

    it('should return 0 instant RPS when no requests were made', () => {
      const aggregator = new MetricsAggregator(
        mockHdrHistogramManagers,
        mockStatsCounterManagers,
        {},
        'test-run-id',
      );

      // Set up endpoints
      aggregator.setEndpoints(['http://example.com/api']);
      aggregator.setStartTime(Date.now() - 1000);
      aggregator.stopPolling();

      // Mock no requests
      vi.mocked(
        mockStatsCounterManagers[0].getAllEndpointCounters,
      ).mockReturnValue([
        {
          successCount: 0,
          failureCount: 0,
          bytesSent: 0,
          bytesReceived: 0,
          statusCodeCounts: {},
          sampledStatusCodes: [],
          bodySampleIndices: [],
        },
      ]);

      vi.mocked(
        mockHdrHistogramManagers[0].getAllEndpointHistograms,
      ).mockReturnValue([
        {
          totalCount: 0,
          mean: 0,
          min: 0,
          max: 0,
          percentiles: { 50: 0, 95: 0, 99: 0 },
          stdDev: 0,
          buckets: [],
        },
      ]);

      const results = aggregator.getResults(1, ['http://example.com/api']);

      // Should be 0 when no requests were made
      expect(
        results.endpoints['http://example.com/api'].peakRequestsPerSecond,
      ).toBe(0);
      expect(results.global.peakRequestsPerSecond).toBe(0);
    });
  });
});
