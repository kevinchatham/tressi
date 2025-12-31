import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  IBodySampleManager,
  IHdrHistogramManager,
  IStatsCounterManager,
} from '../../../src/workers/interfaces';
import { MetricsAggregator } from '../../../src/workers/metrics-aggregator';

describe('MetricsAggregator', () => {
  let mockHdrHistogramManagers: IHdrHistogramManager[];
  let mockStatsCounterManagers: IStatsCounterManager[];
  let mockBodySampleManagers: IBodySampleManager[];
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

    // Mock body sample managers
    mockBodySampleManagers = [
      {
        getEndpointsCount: vi.fn().mockReturnValue(1),
        getBodySampleIndices: vi.fn().mockReturnValue([]),
        recordBodySample: vi.fn(),
        clearBodySamples: vi.fn(),
      },
      {
        getEndpointsCount: vi.fn().mockReturnValue(1),
        getBodySampleIndices: vi.fn().mockReturnValue([]),
        recordBodySample: vi.fn(),
        clearBodySamples: vi.fn(),
      },
      {
        getEndpointsCount: vi.fn().mockReturnValue(1),
        getBodySampleIndices: vi.fn().mockReturnValue([]),
        recordBodySample: vi.fn(),
        clearBodySamples: vi.fn(),
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
        mockBodySampleManagers,
      );

      expect(aggregator).toBeInstanceOf(MetricsAggregator);
    });
  });

  describe('startPolling and stopPolling', () => {
    beforeEach(() => {
      aggregator = new MetricsAggregator(
        mockHdrHistogramManagers,
        mockStatsCounterManagers,
        mockBodySampleManagers,
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
        mockBodySampleManagers,
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
        { totalCount: 0, mean: 0, min: 0, max: 0, percentiles: {}, stdDev: 0 },
        { totalCount: 0, mean: 0, min: 0, max: 0, percentiles: {}, stdDev: 0 },
      ]);
      vi.mocked(
        mockHdrHistogramManagers[1].getAllEndpointHistograms,
      ).mockReturnValue([
        { totalCount: 0, mean: 0, min: 0, max: 0, percentiles: {}, stdDev: 0 },
      ]);

      const results = aggregator.getResults(2, [
        'http://example.com/api/1',
        'http://example.com/api/2',
        'http://example.com/api/3',
      ]);

      expect(results.global.totalRequests).toBe(0);
      expect(results.global.successfulRequests).toBe(0);
      expect(results.global.failedRequests).toBe(0);
      expect(results.global.errorPercentage).toBe(0);
      expect(results.global.averageLatency).toBe(0);
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
        },
        {
          totalCount: 6,
          mean: 150,
          min: 80,
          max: 300,
          percentiles: { 50: 140, 95: 280, 99: 295 },
          stdDev: 75,
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
      expect(results.global.errorPercentage).toBe(0);
      // The AggregatedMetric type doesn't have a workerThreads property
      // This assertion was based on outdated expectations
      expect(results.endpoints).toHaveProperty('http://example.com/api/1');
      expect(results.endpoints).toHaveProperty('http://example.com/api/2');
      expect(results.endpoints).toHaveProperty('http://example.com/api/3');
    });

    it('should calculate endpoint-specific metrics', () => {
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
        },
      ]);
      vi.mocked(
        mockHdrHistogramManagers[1].getAllEndpointHistograms,
      ).mockReturnValue([]);

      const results = aggregator.getResults(2, ['http://example.com/api/1']);

      const endpointMetrics = results.endpoints['http://example.com/api/1'];
      expect(endpointMetrics.totalRequests).toBe(12);
      expect(endpointMetrics.successfulRequests).toBe(12);
      expect(endpointMetrics.failedRequests).toBe(0);
      expect(endpointMetrics.errorPercentage).toBe(0);
      expect(endpointMetrics.averageLatency).toBe(100);
      expect(endpointMetrics.p50Latency).toBe(95);
      expect(endpointMetrics.p95Latency).toBe(180);
      expect(endpointMetrics.p99Latency).toBe(195);
    });
  });

  describe('getBodySamplesForEndpoint', () => {
    beforeEach(() => {
      aggregator = new MetricsAggregator(
        mockHdrHistogramManagers,
        mockStatsCounterManagers,
        mockBodySampleManagers,
      );
    });

    it('should return empty array for invalid endpoint index', () => {
      const samples = aggregator.getBodySamplesForEndpoint(-1);
      expect(samples).toEqual([]);
    });

    it('should return empty array for out of bounds endpoint index', () => {
      const samples = aggregator.getBodySamplesForEndpoint(100);
      expect(samples).toEqual([]);
    });

    it('should return body samples for valid endpoint', () => {
      const mockSamples = [
        { sampleIndex: 1, statusCode: 200 },
        { sampleIndex: 2, statusCode: 404 },
      ];
      vi.mocked(mockBodySampleManagers[0].getBodySampleIndices).mockReturnValue(
        mockSamples,
      );

      const samples = aggregator.getBodySamplesForEndpoint(0);
      expect(samples).toEqual(mockSamples);
    });
  });

  describe('reset', () => {
    beforeEach(() => {
      aggregator = new MetricsAggregator(
        mockHdrHistogramManagers,
        mockStatsCounterManagers,
        mockBodySampleManagers,
      );
    });

    it('should clear body samples for all endpoints', () => {
      aggregator.reset();

      mockBodySampleManagers.forEach((manager) => {
        expect(manager.clearBodySamples).toHaveBeenCalledWith(0);
      });
    });

    it('should reset aggregation state', () => {
      // Setup mock data for the test
      mockStatsCounterManagers.forEach((manager) => {
        vi.mocked(manager.getAllEndpointCounters).mockReturnValue([
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
      });

      // Test that reset affects observable behavior through getResults
      aggregator.reset();

      const resetResults = aggregator.getResults(2, [
        'http://example.com/api/1',
      ]);

      // Reset should affect the results returned by getResults
      expect(resetResults.global.totalRequests).toBe(0);
    });
  });
});
