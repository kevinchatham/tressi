import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EndpointRateLimiter } from '../../../../src/core/runner/endpoint-rate-limiter';
import type { EndpointRateLimitConfig } from '../../../../src/types/rate-limit.types';

describe('EndpointRateLimiter', () => {
  let limiter: EndpointRateLimiter;
  const endpoint = 'https://api.example.com/users';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create limiter with default values', () => {
      const config: EndpointRateLimitConfig = { rps: 10 };
      limiter = new EndpointRateLimiter(endpoint, config);

      expect(limiter.getEndpoint()).toBe(endpoint);
      const state = limiter.getState();
      expect(state.capacity).toBe(20); // 2 * rps
      expect(state.refillRate).toBe(10);
    });

    it('should create limiter with custom capacity', () => {
      const config: EndpointRateLimitConfig = { rps: 10, capacity: 50 };
      limiter = new EndpointRateLimiter(endpoint, config);

      const state = limiter.getState();
      expect(state.capacity).toBe(50);
      expect(state.refillRate).toBe(10);
    });

    it('should disable rate limiting when explicitly disabled', () => {
      const config: EndpointRateLimitConfig = { enabled: false };
      limiter = new EndpointRateLimiter(endpoint, config);

      expect(limiter.tryConsume()).toBe(true);
    });
  });

  describe('tryConsume', () => {
    beforeEach(() => {
      const config: EndpointRateLimitConfig = { rps: 10 };
      limiter = new EndpointRateLimiter(endpoint, config);
    });

    it('should allow consumption when tokens are available', () => {
      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.getState().availableTokens).toBe(19);
    });

    it('should deny consumption when no tokens are available', () => {
      // Consume all tokens
      for (let i = 0; i < 20; i++) {
        expect(limiter.tryConsume()).toBe(true);
      }

      expect(limiter.tryConsume()).toBe(false);
    });

    it('should allow multiple token consumption', () => {
      expect(limiter.tryConsume(5)).toBe(true);
      expect(limiter.getState().availableTokens).toBe(15);
    });

    it('should deny multiple token consumption when insufficient', () => {
      expect(limiter.tryConsume(25)).toBe(false);
      expect(limiter.getState().availableTokens).toBe(20);
    });
  });

  describe('waitForTokens', () => {
    beforeEach(() => {
      const config: EndpointRateLimitConfig = { rps: 1000 }; // High rate for fast tests
      limiter = new EndpointRateLimiter(endpoint, config);
    });

    it('should wait and consume tokens', async () => {
      // Consume some tokens but not all
      for (let i = 0; i < 1999; i++) {
        limiter.tryConsume();
      }

      const startTime = Date.now();
      await limiter.waitForTokens(1);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be very quick
      expect(limiter.getState().availableTokens).toBe(0); // After consuming the last token
    });

    it('should return immediately when tokens are available', async () => {
      const startTime = Date.now();
      await limiter.waitForTokens(1);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(10); // Should be almost instant
    });
  });

  describe('updateConfig', () => {
    beforeEach(() => {
      const config: EndpointRateLimitConfig = { rps: 10 };
      limiter = new EndpointRateLimiter(endpoint, config);
    });

    it('should update RPS and recalculate capacity', () => {
      limiter.updateConfig({ rps: 20 });

      const state = limiter.getState();
      expect(state.refillRate).toBe(20);
      expect(state.capacity).toBe(40); // 2 * new rps
    });

    it('should update capacity without changing RPS', () => {
      limiter.updateConfig({ capacity: 100 });

      const state = limiter.getState();
      expect(state.refillRate).toBe(10);
      expect(state.capacity).toBe(100);
    });

    it('should update enabled status', () => {
      limiter.updateConfig({ enabled: false });

      const config = limiter.getConfig();
      expect(config.enabled).toBe(false);
    });
  });

  describe('reset', () => {
    beforeEach(() => {
      const config: EndpointRateLimitConfig = { rps: 10 };
      limiter = new EndpointRateLimiter(endpoint, config);
    });

    it('should reset tokens to full capacity', () => {
      limiter.tryConsume(10);
      expect(limiter.getState().availableTokens).toBe(10);

      limiter.reset();
      expect(limiter.getState().availableTokens).toBe(20);
    });
  });

  describe('token refill', () => {
    it('should refill tokens over time', async () => {
      const config: EndpointRateLimitConfig = { rps: 10 };
      limiter = new EndpointRateLimiter(endpoint, config);

      // Consume all tokens
      for (let i = 0; i < 20; i++) {
        limiter.tryConsume();
      }

      expect(limiter.getState().availableTokens).toBe(0);

      // Wait for refill - ensure we wait long enough for at least 1 token
      await new Promise((resolve) => setTimeout(resolve, 150));

      const state = limiter.getState();
      expect(state.availableTokens).toBeGreaterThan(0);
      expect(state.availableTokens).toBeLessThanOrEqual(20);
    });

    it('should only add whole tokens during refill', async () => {
      const config: EndpointRateLimitConfig = { rps: 100 };
      limiter = new EndpointRateLimiter(endpoint, config);

      // Consume all tokens
      for (let i = 0; i < 200; i++) {
        limiter.tryConsume();
      }

      expect(limiter.getState().availableTokens).toBe(0);

      // Wait for 5ms - should not add any tokens (0.005 * 100 = 0.5, floor to 0)
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(limiter.getState().availableTokens).toBe(0);

      // Wait for another 25ms - should add at least 1 token (0.03 * 100 = 3.0, floor to 3)
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(limiter.getState().availableTokens).toBeGreaterThanOrEqual(1);
    });
  });
});
