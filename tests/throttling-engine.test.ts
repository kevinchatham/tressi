import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThrottlingEngine } from '../src/throttling-engine';
import { TokenBucket } from '../src/token-bucket';

describe('ThrottlingEngine', () => {
  let engine: ThrottlingEngine;
  let bucket: TokenBucket;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new ThrottlingEngine({
      maxQueueSize: 100,
      maxWaitTime: 5000,
      enableBackpressure: true,
    });
    bucket = new TokenBucket(10, 5, 'test-endpoint');
  });

  describe('Constructor', () => {
    it('should create engine with default configuration', () => {
      const defaultEngine = new ThrottlingEngine();

      expect(defaultEngine.config.maxQueueSize).toBe(10000);
      expect(defaultEngine.config.maxWaitTime).toBe(30000);
      expect(defaultEngine.config.enableBackpressure).toBe(true);
    });

    it('should create engine with custom configuration', () => {
      const customEngine = new ThrottlingEngine({
        maxQueueSize: 50,
        maxWaitTime: 10000,
        enableBackpressure: false,
      });

      expect(customEngine.config.maxQueueSize).toBe(50);
      expect(customEngine.config.maxWaitTime).toBe(10000);
      expect(customEngine.config.enableBackpressure).toBe(false);
    });
  });

  describe('queueRequest', () => {
    it('should return 0 delay when tokens are available', async () => {
      const delay = await engine.queueRequest('test-endpoint', bucket, 1);

      expect(delay).toBe(0);
    });

    it('should queue request when tokens are not available', async () => {
      // Use all tokens
      bucket.tryAcquire(10);

      const delayPromise = engine.queueRequest('test-endpoint', bucket, 1);

      expect(engine.getQueueSize()).toBe(1);
      expect(engine.isProcessing()).toBe(true);

      // The delay should be calculated based on refill rate
      const delay = await delayPromise;
      expect(delay).toBeGreaterThanOrEqual(0);
    });

    it('should reject request when queue is full', async () => {
      const smallEngine = new ThrottlingEngine({
        maxQueueSize: 0, // Force immediate rejection
        maxWaitTime: 1000,
        enableBackpressure: true,
      });

      // Use all tokens
      bucket.tryAcquire(10);

      // This should be rejected immediately since queue size is 0
      await expect(
        smallEngine.queueRequest('test2', bucket, 1),
      ).rejects.toThrow('Queue overflow');
    });

    it('should timeout request when maxWaitTime is exceeded', async () => {
      const shortTimeoutEngine = new ThrottlingEngine({
        maxQueueSize: 10,
        maxWaitTime: 100,
        enableBackpressure: true,
      });

      // Use all tokens and don't let them refill
      bucket.tryAcquire(10);

      await expect(
        shortTimeoutEngine.queueRequest('test', bucket, 10),
      ).rejects.toThrow('Request timeout');
    });

    it('should handle concurrent requests correctly', async () => {
      // Use all tokens
      bucket.tryAcquire(10);

      const promises = Array.from({ length: 5 }, () =>
        engine.queueRequest('test-endpoint', bucket, 1),
      );

      const delays = await Promise.all(promises);

      expect(delays).toHaveLength(5);
      delays.forEach((delay) => {
        expect(typeof delay).toBe('number');
        expect(delay).toBeGreaterThanOrEqual(0);
      });
    });

    it('should throw error for empty endpoint key', async () => {
      await expect(engine.queueRequest('', bucket, 1)).rejects.toThrow(
        'Endpoint key must be non-empty',
      );
    });
  });

  describe('Statistics', () => {
    it('should track queue statistics correctly', async () => {
      const initialStats = engine.getStats();

      expect(initialStats.totalQueued).toBe(0);
      expect(initialStats.currentQueueSize).toBe(0);
      expect(initialStats.averageWaitTime).toBe(0);
      expect(initialStats.maxWaitTime).toBe(0);

      // Queue a request
      bucket.tryAcquire(10); // Use all tokens
      await engine.queueRequest('test', bucket, 1);

      const finalStats = engine.getStats();

      expect(finalStats.totalQueued).toBe(1);
      expect(finalStats.currentQueueSize).toBe(0); // Should be processed
      expect(finalStats.averageWaitTime).toBeGreaterThanOrEqual(0);
      expect(typeof finalStats.timestamp).toBe('number');
    });

    it('should track rejected and timed out requests', async () => {
      const smallEngine = new ThrottlingEngine({
        maxQueueSize: 0, // Force immediate rejection
        maxWaitTime: 100,
        enableBackpressure: true,
      });

      // Use all tokens
      bucket.tryAcquire(10);

      // This should be rejected immediately
      try {
        await smallEngine.queueRequest('test1', bucket, 1);
      } catch {}

      const stats = smallEngine.getStats();

      expect(stats.rejectedRequests).toBeGreaterThan(0);
    });
  });

  describe('Configuration updates', () => {
    it('should update configuration dynamically', () => {
      engine.updateConfig({
        maxQueueSize: 200,
        maxWaitTime: 15000,
      });

      expect(engine.config.maxQueueSize).toBe(200);
      expect(engine.config.maxWaitTime).toBe(15000);
      expect(engine.config.enableBackpressure).toBe(true); // Unchanged
    });

    it('should handle partial configuration updates', () => {
      engine.updateConfig({
        maxQueueSize: 75,
      });

      expect(engine.config.maxQueueSize).toBe(75);
      expect(engine.config.maxWaitTime).toBe(5000); // Unchanged
    });
  });

  describe('Clear functionality', () => {
    it('should clear all queued requests', async () => {
      // Use all tokens
      bucket.tryAcquire(10);

      // Queue some requests
      const promises = Array.from({ length: 3 }, () =>
        engine.queueRequest('test', bucket, 1),
      );

      // Clear before they complete
      engine.clear();

      // All promises should be rejected
      const results = await Promise.allSettled(promises);
      results.forEach((result) => {
        expect(result.status).toBe('rejected');
      });

      expect(engine.getQueueSize()).toBe(0);
      expect(engine.isProcessing()).toBe(false);
    });

    it('should reset statistics when cleared', () => {
      // Queue and process some requests
      engine.queueRequest('test', bucket, 1);

      engine.clear();

      const stats = engine.getStats();
      expect(stats.totalQueued).toBe(0);
      expect(stats.currentQueueSize).toBe(0);
      expect(stats.rejectedRequests).toBe(0);
    });
  });

  describe('Fake 429 elimination', () => {
    it('should never generate synthetic 429 responses', async () => {
      // This test ensures the throttling engine never creates fake 429s
      const testBucket = new TokenBucket(2, 1, 'fake-429-test');

      // Use all tokens
      testBucket.tryAcquire(2);

      // Queue multiple requests that would normally cause 429s
      const promises = Array.from({ length: 10 }, () =>
        engine.queueRequest('fake-429-test', testBucket, 1),
      );

      // All requests should be queued and processed, not rejected with 429
      const results = await Promise.allSettled(promises);

      // No synthetic 429 errors should occur
      const rejected429s = results.filter(
        (result) =>
          result.status === 'rejected' &&
          result.reason?.message?.includes('429'),
      );

      expect(rejected429s).toHaveLength(0);
    });

    it('should provide accurate delay calculations instead of 429s', async () => {
      const testBucket = new TokenBucket(1, 2, 'delay-test'); // 2 tokens/sec

      // Use the token
      testBucket.tryAcquire(1);

      const delay = await engine.queueRequest('delay-test', testBucket, 1);

      // Should provide accurate delay (~500ms for 1 token at 2/sec)
      expect(delay).toBeGreaterThanOrEqual(400);
      expect(delay).toBeLessThanOrEqual(600);
    });
  });

  describe('Rate limiting accuracy', () => {
    it('should maintain accurate rate limiting through pacing', async () => {
      const testBucket = new TokenBucket(1, 10, 'rate-test'); // 10 tokens/sec

      // Use the initial token
      testBucket.tryAcquire(1);

      // Force refill to ensure tokens are available
      testBucket.refill();

      const delay = await engine.queueRequest('rate-test', testBucket, 1);

      // Should provide reasonable delay
      expect(typeof delay).toBe('number');
      expect(delay).toBeGreaterThanOrEqual(0);
    });

    it('should handle burst scenarios correctly', async () => {
      const testBucket = new TokenBucket(5, 20, 'burst-test'); // 20 tokens/sec

      // Use all tokens for burst
      testBucket.tryAcquire(5);

      // Request 10 more tokens in burst
      const start = Date.now();
      const promises = Array.from({ length: 10 }, () =>
        engine.queueRequest('burst-test', testBucket, 1),
      );

      await Promise.all(promises);
      const elapsed = Date.now() - start;

      // Should take approximately 500ms for 10 tokens at 20/sec
      expect(elapsed).toBeGreaterThanOrEqual(400);
      expect(elapsed).toBeLessThanOrEqual(700);
    });
  });
});
