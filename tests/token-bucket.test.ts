import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TokenBucket } from '../src/token-bucket';

describe('TokenBucket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create a bucket with correct initial values', () => {
      const bucket = new TokenBucket(10, 5, 'test-endpoint');

      expect(bucket.capacity).toBe(10);
      expect(bucket.tokens).toBe(10);
      expect(bucket.refillRate).toBe(5);
      expect(bucket.endpointKey).toBe('test-endpoint');
      expect(typeof bucket.lastRefill).toBe('number');
    });

    it('should throw error for invalid capacity', () => {
      expect(() => new TokenBucket(0, 5, 'test')).toThrow(
        'Capacity must be positive',
      );
      expect(() => new TokenBucket(-1, 5, 'test')).toThrow(
        'Capacity must be positive',
      );
    });

    it('should throw error for invalid refill rate', () => {
      expect(() => new TokenBucket(10, 0, 'test')).toThrow(
        'Refill rate must be positive',
      );
      expect(() => new TokenBucket(10, -1, 'test')).toThrow(
        'Refill rate must be positive',
      );
    });

    it('should throw error for empty endpoint key', () => {
      expect(() => new TokenBucket(10, 5, '')).toThrow(
        'Endpoint key must be non-empty',
      );
      expect(() => new TokenBucket(10, 5, '   ')).toThrow(
        'Endpoint key must be non-empty',
      );
    });
  });

  describe('tryAcquire', () => {
    it('should acquire tokens when available', () => {
      const bucket = new TokenBucket(10, 5, 'test');

      expect(bucket.tryAcquire(5)).toBe(true);
      expect(bucket.tokens).toBe(5);
    });

    it('should fail to acquire when insufficient tokens', () => {
      const bucket = new TokenBucket(3, 5, 'test');

      expect(bucket.tryAcquire(5)).toBe(false);
      expect(bucket.tokens).toBe(3);
    });

    it('should acquire single token by default', () => {
      const bucket = new TokenBucket(10, 5, 'test');

      expect(bucket.tryAcquire()).toBe(true);
      expect(bucket.tokens).toBe(9);
    });

    it('should throw error for non-positive tokens', () => {
      const bucket = new TokenBucket(10, 5, 'test');

      expect(() => bucket.tryAcquire(0)).toThrow('Tokens must be positive');
      expect(() => bucket.tryAcquire(-1)).toThrow('Tokens must be positive');
    });

    it('should handle exact token amount', () => {
      const bucket = new TokenBucket(5, 5, 'test');

      expect(bucket.tryAcquire(5)).toBe(true);
      expect(bucket.tokens).toBe(0);
    });
  });

  describe('getWaitTime', () => {
    it('should return 0 when tokens are available', () => {
      const bucket = new TokenBucket(10, 5, 'test');

      expect(bucket.getWaitTime(5)).toBe(0);
    });

    it('should calculate correct wait time for insufficient tokens', () => {
      const bucket = new TokenBucket(5, 10, 'test');

      expect(bucket.getWaitTime(8)).toBe(300); // 300ms = 0.3s for 3 tokens
    });

    it('should handle single token by default', () => {
      const bucket = new TokenBucket(1, 10, 'test');

      bucket.tryAcquire(1); // Use the token
      expect(bucket.getWaitTime()).toBe(100); // 100ms for 1 token at 10/sec
    });

    it('should throw error for non-positive tokens', () => {
      const bucket = new TokenBucket(10, 5, 'test');

      expect(() => bucket.getWaitTime(0)).toThrow('Tokens must be positive');
      expect(() => bucket.getWaitTime(-1)).toThrow('Tokens must be positive');
    });

    it('should handle fractional wait times', () => {
      const bucket = new TokenBucket(2, 1, 'test');

      bucket.tryAcquire(2); // Use all tokens
      expect(bucket.getWaitTime(1)).toBe(1000);
      expect(bucket.getWaitTime(2)).toBe(2000);
    });
  });

  describe('refill', () => {
    it('should add tokens based on elapsed time', () => {
      const bucket = new TokenBucket(10, 5, 'test');

      // Use all tokens
      bucket.tryAcquire(10);
      expect(bucket.tokens).toBe(0);

      // Mock time passing
      const originalNow = Date.now;
      const mockNow = vi.fn().mockReturnValue(Date.now() + 1000); // 1 second passed
      Date.now = mockNow;

      bucket.refill();
      expect(bucket.tokens).toBe(5); // 5 tokens added (5/sec * 1 sec)

      Date.now = originalNow;
    });

    it('should not exceed capacity', () => {
      const bucket = new TokenBucket(5, 10, 'test');

      // Use some tokens
      bucket.tryAcquire(3);
      expect(bucket.tokens).toBe(2);

      // Mock large time passing
      const originalNow = Date.now;
      const mockNow = vi.fn().mockReturnValue(Date.now() + 10000); // 10 seconds passed
      Date.now = mockNow;

      bucket.refill();
      expect(bucket.tokens).toBe(5); // Should not exceed capacity

      Date.now = originalNow;
    });

    it('should handle zero elapsed time', () => {
      const bucket = new TokenBucket(10, 5, 'test');
      const initialTokens = bucket.tokens;

      bucket.refill();
      expect(bucket.tokens).toBe(initialTokens);
    });

    it('should handle clock moving backwards', () => {
      const bucket = new TokenBucket(10, 5, 'test');
      const originalNow = Date.now;

      // Mock time moving backwards
      const mockNow = vi.fn().mockReturnValue(Date.now() - 1000);
      Date.now = mockNow;

      const initialTokens = bucket.tokens;
      bucket.refill();
      expect(bucket.tokens).toBe(initialTokens);

      Date.now = originalNow;
    });
  });

  describe('reset', () => {
    it('should restore bucket to full capacity', () => {
      const bucket = new TokenBucket(10, 5, 'test');

      bucket.tryAcquire(7);
      expect(bucket.tokens).toBe(3);

      bucket.reset();
      expect(bucket.tokens).toBe(10);
    });

    it('should update lastRefill timestamp', () => {
      const bucket = new TokenBucket(10, 5, 'test');
      const originalTime = bucket.lastRefill;

      // Wait a bit
      const waitStart = Date.now();
      while (Date.now() - waitStart < 10) {
        // Busy wait for a few milliseconds
      }

      bucket.reset();
      expect(bucket.lastRefill).toBeGreaterThan(originalTime);
    });
  });

  describe('getState', () => {
    it('should return current state object', () => {
      const bucket = new TokenBucket(10, 5, 'test-endpoint');

      const state = bucket.getState();

      expect(state).toEqual({
        capacity: 10,
        tokens: 10,
        refillRate: 5,
        lastRefill: expect.any(Number),
        endpointKey: 'test-endpoint',
      });
    });

    it('should reflect current token count', () => {
      const bucket = new TokenBucket(10, 5, 'test');

      bucket.tryAcquire(3);
      const state = bucket.getState();

      expect(state.tokens).toBe(7);
    });
  });

  describe('Integration tests', () => {
    it('should handle rapid acquire attempts', () => {
      const bucket = new TokenBucket(5, 10, 'test');

      // Rapid fire acquire attempts
      expect(bucket.tryAcquire(3)).toBe(true);
      expect(bucket.tryAcquire(3)).toBe(false);
      expect(bucket.tryAcquire(2)).toBe(true);
      expect(bucket.tryAcquire(1)).toBe(false);
    });

    it('should correctly calculate wait times after partial refill', () => {
      const bucket = new TokenBucket(10, 2, 'test');

      // Use all tokens
      bucket.tryAcquire(10);
      expect(bucket.tokens).toBe(0);

      // Mock time passing for partial refill
      const originalNow = Date.now;
      let currentTime = Date.now();
      const mockNow = vi.fn().mockImplementation(() => currentTime);
      Date.now = mockNow;

      // Advance 1.5 seconds
      currentTime += 1500;

      // After 1.5 seconds, we should have 3 tokens (2 * 1.5 = 3)
      expect(bucket.tokens).toBe(3); // 3 tokens added
      expect(bucket.getWaitTime(3)).toBe(0); // No wait needed for 3 tokens

      Date.now = originalNow;
    });

    it('should maintain consistency between tryAcquire and getWaitTime', () => {
      const bucket = new TokenBucket(5, 1, 'test');

      // Use all tokens
      bucket.tryAcquire(5);

      const waitTime = bucket.getWaitTime(1);
      expect(waitTime).toBe(1000); // 1 second for 1 token

      // After waiting, should be able to acquire
      const originalNow = Date.now;
      const mockNow = vi.fn().mockReturnValue(Date.now() + 1000);
      Date.now = mockNow;

      expect(bucket.tryAcquire(1)).toBe(true);

      Date.now = originalNow;
    });
  });

  describe('Performance tests', () => {
    it('should handle high-frequency operations efficiently', () => {
      const bucket = new TokenBucket(1000, 100, 'test');

      const start = Date.now();

      // Perform many operations
      for (let i = 0; i < 10000; i++) {
        bucket.tryAcquire(1);
        bucket.getWaitTime(1);
      }

      const elapsed = Date.now() - start;

      // Should complete quickly (less than 100ms for 20k operations)
      expect(elapsed).toBeLessThan(100);
    });

    it('should have minimal memory footprint', () => {
      const bucket = new TokenBucket(1000, 500, 'test-endpoint');

      // Check that instance doesn't hold unnecessary references
      const state = bucket.getState();
      const keys = Object.keys(state);

      // Should only have essential properties
      expect(keys).toEqual([
        'capacity',
        'tokens',
        'refillRate',
        'lastRefill',
        'endpointKey',
      ]);
    });
  });
});
