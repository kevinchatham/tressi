import { beforeEach, describe, expect, it } from 'vitest';

import { CentralizedRateLimiter } from '../../../src/core/rate-limiter';
import type { TressiRequestConfig } from '../../../src/types';

describe('CentralizedRateLimiter', () => {
  let rateLimiter: CentralizedRateLimiter;
  const testRequests: TressiRequestConfig[] = [];

  beforeEach(() => {
    rateLimiter = new CentralizedRateLimiter(testRequests);
  });

  describe('initialization', () => {
    it('should initialize with correct endpoints', () => {
      const stats = rateLimiter.getStats();
      expect(Object.keys(stats)).toHaveLength(2);
      expect(stats['GET:http://example.com/health'].targetRPS).toBe(1);
      expect(stats['GET:http://example.com/success'].targetRPS).toBe(10);
    });
  });

  describe('rate limiting', () => {
    it('should return ready endpoints immediately', () => {
      const nextEndpoint = rateLimiter.getNextReadyEndpoint();
      expect(nextEndpoint).toBeDefined();
      expect(nextEndpoint?.endpointKey).toMatch(/health|success/);
    });

    it('should enforce rate limits after requests', () => {
      // Record requests for both endpoints
      rateLimiter.recordRequest('GET:http://example.com/health');
      rateLimiter.recordRequest('GET:http://example.com/success');

      // Both should be rate limited immediately after
      const nextEndpoint = rateLimiter.getNextReadyEndpoint();
      expect(nextEndpoint).toBeNull();
    });

    it('should calculate correct wait times', () => {
      rateLimiter.recordRequest('GET:http://example.com/health');

      const waitTime = rateLimiter.getMinWaitTime();
      expect(waitTime).toBeGreaterThan(0);
      expect(waitTime).toBeLessThanOrEqual(1000); // 1 second for 1 RPS
    });
  });

  describe('statistics', () => {
    it('should track request counts', () => {
      rateLimiter.recordRequest('GET:http://example.com/health');

      const stats = rateLimiter.getStats();
      expect(stats['GET:http://example.com/health'].requestCount).toBe(1);
    });
  });
});
