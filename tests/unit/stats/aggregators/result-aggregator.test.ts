import { beforeEach, describe, expect, it } from 'vitest';

import { ResultAggregator } from '../../../../src/stats/aggregators/result-aggregator';
import type { RequestResult } from '../../../../src/types';

describe('ResultAggregator', () => {
  let aggregator: ResultAggregator;
  let baseTimestamp: number;

  beforeEach(() => {
    aggregator = new ResultAggregator(false, 100); // Disable UI for tests
    baseTimestamp = Date.now();
  });

  const createResult = (
    overrides: Partial<RequestResult> = {},
  ): RequestResult => ({
    url: 'http://example.com',
    method: 'GET',
    status: 200,
    latencyMs: 100,
    success: true,
    timestamp: baseTimestamp++,
    ...overrides,
  });

  describe('initialization', () => {
    it('should initialize with empty results', () => {
      expect(aggregator.getSampledResults()).toEqual([]);
      expect(aggregator.getTotalRequestsCount()).toBe(0);
      expect(aggregator.getSuccessfulRequestsCount()).toBe(0);
      expect(aggregator.getFailedRequestsCount()).toBe(0);
    });
  });

  describe('recording results', () => {
    it('should record a single successful result', () => {
      const result = createResult({ success: true });
      aggregator.recordResult(result);

      expect(aggregator.getTotalRequestsCount()).toBe(1);
      expect(aggregator.getSuccessfulRequestsCount()).toBe(1);
      expect(aggregator.getFailedRequestsCount()).toBe(0);
    });

    it('should record a single failed result', () => {
      const result = createResult({ success: false, status: 500 });
      aggregator.recordResult(result);

      expect(aggregator.getTotalRequestsCount()).toBe(1);
      expect(aggregator.getSuccessfulRequestsCount()).toBe(0);
      expect(aggregator.getFailedRequestsCount()).toBe(1);
    });

    it('should record multiple results', () => {
      const results = [
        createResult({ url: 'http://example.com/1', success: true }),
        createResult({ url: 'http://example.com/2', success: true }),
        createResult({
          url: 'http://example.com/3',
          success: false,
          status: 404,
        }),
      ];

      results.forEach((result) => aggregator.recordResult(result));

      expect(aggregator.getTotalRequestsCount()).toBe(3);
      expect(aggregator.getSuccessfulRequestsCount()).toBe(2);
      expect(aggregator.getFailedRequestsCount()).toBe(1);
    });
  });

  describe('sampling behavior', () => {
    it('should maintain all results when below sample limit', () => {
      const results = Array.from({ length: 50 }, (_, i) =>
        createResult({ url: `http://example.com/${i}`, latencyMs: 100 + i }),
      );

      results.forEach((result) => aggregator.recordResult(result));

      expect(aggregator.getSampledResults()).toHaveLength(50);
      expect(aggregator.getTotalRequestsCount()).toBe(50);
    });

    it('should sample results when exceeding limit', () => {
      aggregator = new ResultAggregator(false, 10); // Lower limit for testing
      const results = Array.from({ length: 20 }, (_, i) =>
        createResult({ url: `http://example.com/${i}`, latencyMs: 100 + i }),
      );

      results.forEach((result) => aggregator.recordResult(result));

      expect(aggregator.getSampledResults()).toHaveLength(10);
      expect(aggregator.getTotalRequestsCount()).toBe(20);
    });
  });

  describe('latency statistics', () => {
    it('should calculate correct average latency', () => {
      const results = [
        createResult({ latencyMs: 100 }),
        createResult({ latencyMs: 200 }),
        createResult({ latencyMs: 300 }),
      ];

      results.forEach((result) => aggregator.recordResult(result));

      expect(aggregator.getAverageLatency()).toBe(200);
      expect(aggregator.getMinLatency()).toBe(100);
      expect(aggregator.getMaxLatency()).toBe(300);
    });

    it('should handle latency percentiles', () => {
      const results = Array.from({ length: 100 }, (_, i) =>
        createResult({ latencyMs: i + 1 }),
      );

      results.forEach((result) => aggregator.recordResult(result));

      expect(aggregator.getLatencyAtPercentile(50)).toBe(50);
      expect(aggregator.getLatencyAtPercentile(90)).toBe(90);
      expect(aggregator.getLatencyAtPercentile(95)).toBe(95);
    });
  });

  describe('status code collection', () => {
    it('should collect status codes correctly', () => {
      const results = [
        createResult({ status: 200 }),
        createResult({ status: 200 }),
        createResult({ status: 404, success: false }),
        createResult({ status: 500, success: false }),
      ];

      results.forEach((result) => aggregator.recordResult(result));

      const statusCodeMap = aggregator.getStatusCodeMap();
      expect(statusCodeMap[200]).toBe(2);
      expect(statusCodeMap[404]).toBe(1);
      expect(statusCodeMap[500]).toBe(1);

      const categoryDistribution =
        aggregator.getStatusCodeDistributionByCategory();
      expect(categoryDistribution['2xx']).toBe(2);
      expect(categoryDistribution['4xx']).toBe(1);
      expect(categoryDistribution['5xx']).toBe(1);
    });
  });

  describe('endpoint collection', () => {
    it('should collect endpoint statistics', () => {
      const results = [
        createResult({
          url: 'http://example.com/api/users',
          method: 'GET',
          success: true,
        }),
        createResult({
          url: 'http://example.com/api/users',
          method: 'POST',
          success: true,
        }),
        createResult({
          url: 'http://example.com/api/users',
          method: 'GET',
          success: false,
          status: 404,
        }),
        createResult({
          url: 'http://example.com/api/products',
          method: 'GET',
          success: true,
        }),
      ];

      results.forEach((result) => aggregator.recordResult(result));

      const successfulByEndpoint = aggregator.getSuccessfulRequestsByEndpoint();
      const failedByEndpoint = aggregator.getFailedRequestsByEndpoint();

      expect(successfulByEndpoint.get('GET http://example.com/api/users')).toBe(
        1,
      );
      expect(
        successfulByEndpoint.get('POST http://example.com/api/users'),
      ).toBe(1);
      expect(
        successfulByEndpoint.get('GET http://example.com/api/products'),
      ).toBe(1);
      expect(failedByEndpoint.get('GET http://example.com/api/users')).toBe(1);
    });
  });

  describe('early exit detection', () => {
    it('should detect error rate threshold', () => {
      const results = Array.from({ length: 10 }, (_, i) =>
        createResult({ status: i < 5 ? 500 : 200, success: i >= 5 }),
      );

      results.forEach((result) => aggregator.recordResult(result));

      expect(
        aggregator.shouldEarlyExit({
          earlyExitOnError: true,
          errorRateThreshold: 0.5,
        }),
      ).toBe(true);
    });

    it('should detect error count threshold', () => {
      const results = Array.from({ length: 5 }, () =>
        createResult({ status: 500, success: false }),
      );

      results.forEach((result) => aggregator.recordResult(result));

      expect(
        aggregator.shouldEarlyExit({
          earlyExitOnError: true,
          errorCountThreshold: 3,
        }),
      ).toBe(true);
    });

    it('should not early exit when disabled', () => {
      const results = Array.from({ length: 10 }, () =>
        createResult({ status: 500, success: false }),
      );

      results.forEach((result) => aggregator.recordResult(result));

      expect(
        aggregator.shouldEarlyExit({
          earlyExitOnError: false,
          errorRateThreshold: 0.1,
        }),
      ).toBe(false);
    });
  });

  describe('clear functionality', () => {
    it('should clear all collected data', () => {
      const result = createResult();
      aggregator.recordResult(result);
      expect(aggregator.getTotalRequestsCount()).toBe(1);

      aggregator.clear();
      expect(aggregator.getSampledResults()).toEqual([]);
      expect(aggregator.getTotalRequestsCount()).toBe(0);
      expect(aggregator.getSuccessfulRequestsCount()).toBe(0);
      expect(aggregator.getFailedRequestsCount()).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle zero latency values', () => {
      const result = createResult({ latencyMs: 1 });
      expect(() => {
        aggregator.recordResult(result);
      }).not.toThrow();

      expect(aggregator.getMinLatency()).toBe(1);
      expect(aggregator.getMaxLatency()).toBe(1);
      expect(aggregator.getAverageLatency()).toBe(1);
    });

    it('should handle very large latency values', () => {
      const result = createResult({ latencyMs: 999999 });
      expect(() => {
        aggregator.recordResult(result);
      }).not.toThrow();

      expect(aggregator.getMaxLatency()).toBe(999999);
    });

    it('should handle empty results gracefully', () => {
      expect(aggregator.getAverageLatency()).toBe(0);
      expect(aggregator.getMinLatency()).toBe(Number.MAX_SAFE_INTEGER);
      expect(aggregator.getMaxLatency()).toBe(0);
      expect(aggregator.getLatencyAtPercentile(50)).toBe(0);
    });
  });
});
