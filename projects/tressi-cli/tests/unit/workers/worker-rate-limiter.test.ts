import { describe, expect, it } from 'vitest';

import { TressiRequestConfig } from '../../../src/common/config/types';
import { WorkerRateLimiter } from '../../../src/workers/worker-rate-limiter';

describe('WorkerRateLimiter', () => {
  describe('ramp-up', () => {
    it('should start at 0 RPS when rampUpDurationSec is set', () => {
      const endpoints: TressiRequestConfig[] = [
        {
          url: 'http://test.com',
          method: 'GET',
          payload: {},
          headers: {},
          rps: 100,
          rampUpDurationSec: 60,
          earlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [],
            monitoringWindowMs: 5000,
          },
        },
      ];

      const limiter = new WorkerRateLimiter(endpoints);

      // Immediately after creation, should not return requests due to epsilon check
      const requests = limiter.getAvailableRequests(20);
      expect(requests.length).toBe(0);
    });

    it('should work without ramp-up (rampUpDurationSec=0)', () => {
      const endpoints: TressiRequestConfig[] = [
        {
          url: 'http://test.com',
          method: 'GET',
          payload: {},
          headers: {},
          rps: 10,
          rampUpDurationSec: 0,
          earlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [],
            monitoringWindowMs: 5000,
          },
        },
      ];

      const limiter = new WorkerRateLimiter(endpoints);

      // Without ramp-up, should allow full RPS immediately via first-call logic
      const requests = limiter.getAvailableRequests(20);
      expect(requests.length).toBe(10);
    });

    it('should handle multiple endpoints with different configurations', () => {
      const endpoints: TressiRequestConfig[] = [
        {
          url: 'http://test1.com',
          method: 'GET',
          payload: {},
          headers: {},
          rps: 5,
          rampUpDurationSec: 0,
          earlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [],
            monitoringWindowMs: 5000,
          },
        },
        {
          url: 'http://test2.com',
          method: 'GET',
          payload: {},
          headers: {},
          rps: 3,
          rampUpDurationSec: 0,
          earlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [],
            monitoringWindowMs: 5000,
          },
        },
      ];

      const limiter = new WorkerRateLimiter(endpoints);

      // Should return requests for both endpoints
      const requests = limiter.getAvailableRequests(20);
      expect(requests.length).toBe(8); // 5 + 3

      // Verify the distribution
      const endpoint1Requests = requests.filter(
        (r) => r.url === 'http://test1.com',
      ).length;
      const endpoint2Requests = requests.filter(
        (r) => r.url === 'http://test2.com',
      ).length;
      expect(endpoint1Requests).toBe(5);
      expect(endpoint2Requests).toBe(3);
    });

    it('should respect batch size limits', () => {
      const endpoints: TressiRequestConfig[] = [
        {
          url: 'http://test.com',
          method: 'GET',
          payload: {},
          headers: {},
          rps: 100,
          rampUpDurationSec: 0,
          earlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [],
            monitoringWindowMs: 5000,
          },
        },
      ];

      const limiter = new WorkerRateLimiter(endpoints);

      // Should respect batch size limit
      const requests = limiter.getAvailableRequests(5);
      expect(requests.length).toBe(5);
    });

    it('should handle very low RPS with ramp-up', () => {
      const endpoints: TressiRequestConfig[] = [
        {
          url: 'http://test.com',
          method: 'GET',
          payload: {},
          headers: {},
          rps: 1,
          rampUpDurationSec: 60,
          earlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [],
            monitoringWindowMs: 5000,
          },
        },
      ];

      const limiter = new WorkerRateLimiter(endpoints);

      // With RPS=1 and 60s ramp-up, at t=0 the currentRps should be very low
      const requests = limiter.getAvailableRequests(20);
      // Should return 0 due to epsilon check (currentRps < 0.001)
      expect(requests.length).toBe(0);
    });
  });
});
