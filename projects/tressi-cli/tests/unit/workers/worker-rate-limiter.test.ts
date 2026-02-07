import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TressiRequestConfig } from '../../../src/common/config/types';
import { WorkerRateLimiter } from '../../../src/workers/worker-rate-limiter';

describe('WorkerRateLimiter', () => {
  let mockEndpoints: TressiRequestConfig[];
  let limiter: WorkerRateLimiter;

  beforeEach(() => {
    mockEndpoints = [
      {
        url: 'http://example.com/api/1',
        method: 'GET',
        payload: {},
        headers: {},
        rps: 10,
        rampUpDurationSec: 0,
        earlyExit: {
          enabled: false,
          errorRateThreshold: 0,
          exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
          monitoringWindowMs: 5000,
        },
      },
      {
        url: 'http://example.com/api/2',
        method: 'POST',
        payload: {},
        headers: {},
        rps: 5,
        rampUpDurationSec: 0,
        earlyExit: {
          enabled: false,
          errorRateThreshold: 0,
          exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
          monitoringWindowMs: 5000,
        },
      },
      {
        url: 'http://example.com/api/3',
        method: 'PUT',
        payload: {},
        headers: {},
        rps: 2,
        rampUpDurationSec: 0,
        earlyExit: {
          enabled: false,
          errorRateThreshold: 0,
          exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
          monitoringWindowMs: 5000,
        },
      },
    ];

    limiter = new WorkerRateLimiter(mockEndpoints);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided endpoints', () => {
      expect(limiter).toBeInstanceOf(WorkerRateLimiter);
    });

    it('should initialize rate limiting for provided endpoints', () => {
      const requests = limiter.getAvailableRequests(20, 0);
      expect(Array.isArray(requests)).toBe(true);
    });
  });

  describe('getAvailableRequests', () => {
    beforeEach(() => {
      // Mock Date.now to control timing - must be before limiter creation
      vi.useFakeTimers();
      // Re-create limiter with fake timers active so Date.now() is mocked
      limiter = new WorkerRateLimiter(mockEndpoints);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return available requests immediately without blocking', () => {
      // Advance time to build up tokens
      vi.advanceTimersByTime(1000);

      const requests = limiter.getAvailableRequests(20, 1000);
      expect(Array.isArray(requests)).toBe(true);
      expect(requests.length).toBeGreaterThan(0);
    });

    it('should respect batch size limit', () => {
      // Advance time to build up tokens
      vi.advanceTimersByTime(1000);

      const batchSize = 2;
      const requests = limiter.getAvailableRequests(batchSize, 1000);
      expect(requests.length).toBeLessThanOrEqual(batchSize);
    });

    it('should respect RPS limits over time', () => {
      // Advance time to build up tokens
      vi.advanceTimersByTime(1000);

      const initialRequests = limiter.getAvailableRequests(20, 1000);

      // Immediately check again - should have fewer/no requests due to token depletion
      const immediateRequests = limiter.getAvailableRequests(20, 1000);
      expect(immediateRequests.length).toBeLessThan(initialRequests.length);

      // Advance time to allow token refill
      vi.advanceTimersByTime(1000);

      // Should have tokens available again
      const refilledRequests = limiter.getAvailableRequests(20, 2000);
      expect(refilledRequests.length).toBeGreaterThan(0);
    });

    it('should handle multiple endpoints with different RPS', () => {
      // Advance time to build up tokens
      vi.advanceTimersByTime(1000);

      const requests = limiter.getAvailableRequests(10, 1000);

      // Should distribute across endpoints based on RPS
      const endpointCounts = new Map<string, number>();
      requests.forEach((req) => {
        endpointCounts.set(req.url, (endpointCounts.get(req.url) || 0) + 1);
      });

      expect(endpointCounts.size).toBeGreaterThan(0);
    });

    it('should allow burst requests up to 2x RPS', () => {
      // For 10 RPS endpoint, should allow up to 20 tokens
      const endpoint = mockEndpoints[0]; // 10 RPS
      const singleEndpointLimiter = new WorkerRateLimiter([endpoint]);

      // Advance time to build up tokens
      vi.advanceTimersByTime(2000); // 2 seconds = 20 tokens

      const requests = singleEndpointLimiter.getAvailableRequests(25, 2000);
      expect(requests.length).toBeLessThanOrEqual(20); // Max burst is 2x RPS
    });

    it('should return empty array when no tokens available', () => {
      // Advance time to build up tokens
      vi.advanceTimersByTime(1000);

      // Exhaust all tokens
      limiter.getAvailableRequests(100, 1000);

      // Immediately check again
      const requests = limiter.getAvailableRequests(10, 1000);
      expect(requests).toEqual([]);
    });
  });

  describe('reset behavior', () => {
    it('should naturally refill tokens over time', () => {
      vi.useFakeTimers();

      // Advance time to build up tokens
      vi.advanceTimersByTime(1000);

      // Use up some tokens
      limiter.getAvailableRequests(10, 1000);

      // Advance time to allow token refill
      vi.advanceTimersByTime(1000);

      // Should have fresh tokens available
      const requests = limiter.getAvailableRequests(10, 2000);
      expect(requests.length).toBeGreaterThan(0);

      vi.useRealTimers();
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle empty endpoints array', () => {
      const emptyLimiter = new WorkerRateLimiter([]);
      const requests = emptyLimiter.getAvailableRequests(20, 0);
      expect(requests).toEqual([]);
    });

    it('should handle very high RPS values', () => {
      const highRpsEndpoints: TressiRequestConfig[] = [
        {
          url: 'http://example.com/api/1',
          method: 'GET',
          payload: {},
          headers: {},
          rps: 1000,
          rampUpDurationSec: 0,
          earlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
            monitoringWindowMs: 5000,
          },
        },
      ];
      const highRpsLimiter = new WorkerRateLimiter(highRpsEndpoints);

      vi.advanceTimersByTime(1000);

      const requests = highRpsLimiter.getAvailableRequests(100, 1000);
      expect(requests.length).toBe(100); // Should allow up to batch size
    });

    it('should handle fractional RPS values', () => {
      const fractionalEndpoints: TressiRequestConfig[] = [
        {
          url: 'http://example.com/api/1',
          method: 'GET',
          payload: {},
          headers: {},
          rps: 0.5,
          rampUpDurationSec: 0,
          earlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
            monitoringWindowMs: 5000,
          },
        },
      ];
      const fractionalLimiter = new WorkerRateLimiter(fractionalEndpoints);

      vi.advanceTimersByTime(2000); // 2 seconds = 1 token

      const requests = fractionalLimiter.getAvailableRequests(10, 2000);
      expect(requests.length).toBe(1); // Should allow 1 request
    });
  });
});
