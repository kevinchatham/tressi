import type { TressiRequestConfig } from 'tressi-common/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkerRateLimiter } from '../../../src/workers/worker-rate-limiter';

describe('WorkerRateLimiter', () => {
  let mockEndpoints: TressiRequestConfig[];
  let limiter: WorkerRateLimiter;

  beforeEach(() => {
    mockEndpoints = [
      { url: 'http://example.com/api/1', method: 'GET', rps: 10 },
      { url: 'http://example.com/api/2', method: 'POST', rps: 5 },
      { url: 'http://example.com/api/3', method: 'PUT', rps: 2 },
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
      const requests = limiter.getAvailableRequests();
      expect(Array.isArray(requests)).toBe(true);
    });
  });

  describe('getAvailableRequests', () => {
    beforeEach(() => {
      // Mock Date.now to control timing
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return available requests immediately without blocking', () => {
      const requests = limiter.getAvailableRequests();
      expect(Array.isArray(requests)).toBe(true);
      expect(requests.length).toBeGreaterThan(0);
    });

    it('should respect batch size limit', () => {
      const batchSize = 2;
      const requests = limiter.getAvailableRequests(batchSize);
      expect(requests.length).toBeLessThanOrEqual(batchSize);
    });

    it('should respect RPS limits over time', () => {
      // Initial requests should be available
      const initialRequests = limiter.getAvailableRequests(20);
      expect(initialRequests.length).toBeGreaterThan(0);

      // Immediately check again - should have fewer/no requests due to token depletion
      const immediateRequests = limiter.getAvailableRequests(20);
      expect(immediateRequests.length).toBeLessThan(initialRequests.length);

      // Advance time to allow token refill
      vi.advanceTimersByTime(1000);

      // Should have tokens available again
      const refilledRequests = limiter.getAvailableRequests(20);
      expect(refilledRequests.length).toBeGreaterThan(0);
    });

    it('should handle multiple endpoints with different RPS', () => {
      const requests = limiter.getAvailableRequests(10);

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

      const requests = singleEndpointLimiter.getAvailableRequests(25);
      expect(requests.length).toBeLessThanOrEqual(20); // Max burst is 2x RPS
    });

    it('should return empty array when no tokens available', () => {
      // Exhaust all tokens
      limiter.getAvailableRequests(100);

      // Immediately check again
      const requests = limiter.getAvailableRequests(10);
      expect(requests).toEqual([]);
    });
  });

  describe('reset behavior', () => {
    it('should naturally refill tokens over time', () => {
      vi.useFakeTimers();

      // Use up some tokens
      limiter.getAvailableRequests(10);

      // Advance time to allow token refill
      vi.advanceTimersByTime(1000);

      // Should have fresh tokens available
      const requests = limiter.getAvailableRequests(10);
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
      const requests = emptyLimiter.getAvailableRequests();
      expect(requests).toEqual([]);
    });

    it('should handle zero RPS as 1 RPS', () => {
      const zeroRpsEndpoints: TressiRequestConfig[] = [
        { url: 'http://example.com/api/1', method: 'GET', rps: 0 },
      ];
      const zeroRpsLimiter = new WorkerRateLimiter(zeroRpsEndpoints);

      vi.advanceTimersByTime(1000);

      const requests = zeroRpsLimiter.getAvailableRequests(10);
      expect(requests.length).toBeGreaterThan(0); // Should treat 0 as 1 RPS
    });

    it('should handle very high RPS values', () => {
      const highRpsEndpoints: TressiRequestConfig[] = [
        { url: 'http://example.com/api/1', method: 'GET', rps: 1000 },
      ];
      const highRpsLimiter = new WorkerRateLimiter(highRpsEndpoints);

      vi.advanceTimersByTime(1000);

      const requests = highRpsLimiter.getAvailableRequests(100);
      expect(requests.length).toBe(100); // Should allow up to batch size
    });

    it('should handle fractional RPS values', () => {
      const fractionalEndpoints: TressiRequestConfig[] = [
        { url: 'http://example.com/api/1', method: 'GET', rps: 0.5 },
      ];
      const fractionalLimiter = new WorkerRateLimiter(fractionalEndpoints);

      vi.advanceTimersByTime(2000); // 2 seconds = 1 token

      const requests = fractionalLimiter.getAvailableRequests(10);
      expect(requests.length).toBe(1); // Should allow 1 request
    });
  });
});
