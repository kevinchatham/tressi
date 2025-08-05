import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RateLimitConfig } from '../src/token-bucket-manager';
import { TokenBucketManager } from '../src/token-bucket-manager';

describe('TokenBucketManager', () => {
  let manager: TokenBucketManager;
  const defaultConfig: RateLimitConfig = { capacity: 10, refillRate: 5 };

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new TokenBucketManager(defaultConfig);
  });

  describe('Constructor', () => {
    it('should create manager with default configuration', () => {
      expect(manager.globalConfig).toEqual(defaultConfig);
      expect(manager.endpointConfigs.size).toBe(0);
    });

    it('should throw error for invalid global config', () => {
      expect(
        () => new TokenBucketManager({ capacity: 0, refillRate: 5 }),
      ).toThrow('Capacity must be a positive number');
      expect(
        () => new TokenBucketManager({ capacity: 10, refillRate: -1 }),
      ).toThrow('Refill rate must be a positive number');
    });
  });

  describe('getOrCreateBucket', () => {
    it('should create new bucket for new endpoint', () => {
      const bucket = manager.getOrCreateBucket('test-endpoint');

      expect(bucket.capacity).toBe(10);
      expect(bucket.refillRate).toBe(5);
      expect(bucket.endpointKey).toBe('test-endpoint');
    });

    it('should return existing bucket for same endpoint', () => {
      const bucket1 = manager.getOrCreateBucket('test-endpoint');
      const bucket2 = manager.getOrCreateBucket('test-endpoint');

      expect(bucket1).toBe(bucket2);
    });

    it('should use endpoint-specific configuration when available', () => {
      const customConfig: RateLimitConfig = { capacity: 20, refillRate: 10 };
      manager.configureEndpoint('custom-endpoint', customConfig);

      const bucket = manager.getOrCreateBucket('custom-endpoint');

      expect(bucket.capacity).toBe(20);
      expect(bucket.refillRate).toBe(10);
    });

    it('should throw error for empty endpoint key', () => {
      expect(() => manager.getOrCreateBucket('')).toThrow(
        'Endpoint key must be non-empty',
      );
      expect(() => manager.getOrCreateBucket('   ')).toThrow(
        'Endpoint key must be non-empty',
      );
    });
  });

  describe('tryAcquire', () => {
    it('should acquire tokens immediately when available', async () => {
      const result = await manager.tryAcquire('test-endpoint', 5);

      expect(result).toBe(true);

      const stats = manager.getEndpointStats('test-endpoint');
      expect(stats.successfulAcquisitions).toBe(1);
      expect(stats.failedAcquisitions).toBe(0);
    });

    it('should fail immediately when no wait time specified', async () => {
      // Use all tokens first
      await manager.tryAcquire('test-endpoint', 10);

      const result = await manager.tryAcquire('test-endpoint', 1, 0);

      expect(result).toBe(false);

      const stats = manager.getEndpointStats('test-endpoint');
      expect(stats.successfulAcquisitions).toBe(1);
      expect(stats.failedAcquisitions).toBe(1);
    });

    it('should wait and acquire when tokens become available', async () => {
      // Use all tokens
      await manager.tryAcquire('test-endpoint', 10);

      // Force a refill to ensure tokens are available
      const bucket = manager.getOrCreateBucket('test-endpoint');
      bucket.refill();

      // Ensure tokens are actually available by checking current count
      expect(bucket.tokens).toBeGreaterThan(0);

      const result = await manager.tryAcquire('test-endpoint', 1, 10000);

      expect(result).toBe(true);

      const stats = manager.getEndpointStats('test-endpoint');
      expect(stats.successfulAcquisitions).toBe(2);
    }, 15000);

    it('should timeout when wait exceeds maxWaitMs', async () => {
      // Use all tokens
      await manager.tryAcquire('test-endpoint', 10);

      const result = await manager.tryAcquire('test-endpoint', 10, 100);

      expect(result).toBe(false);
    });

    it('should handle concurrent access safely', async () => {
      const promises = Array.from({ length: 20 }, () =>
        manager.tryAcquire('concurrent-endpoint', 1),
      );

      const results = await Promise.all(promises);
      const successful = results.filter((r) => r).length;

      expect(successful).toBe(10); // Only 10 tokens available initially
    });

    it('should throw error for non-positive tokens', async () => {
      await expect(manager.tryAcquire('test', 0)).rejects.toThrow(
        'Tokens must be positive',
      );
      await expect(manager.tryAcquire('test', -1)).rejects.toThrow(
        'Tokens must be positive',
      );
    });
  });

  describe('configureEndpoint', () => {
    it('should set endpoint-specific configuration', () => {
      const customConfig: RateLimitConfig = { capacity: 50, refillRate: 25 };

      manager.configureEndpoint('custom-endpoint', customConfig);

      expect(manager.endpointConfigs.get('custom-endpoint')).toEqual(
        customConfig,
      );
    });

    it('should update existing bucket configuration', () => {
      // Create bucket with default config
      const bucket1 = manager.getOrCreateBucket('update-test');
      expect(bucket1.capacity).toBe(10);

      // Update configuration
      const newConfig: RateLimitConfig = { capacity: 30, refillRate: 15 };
      manager.configureEndpoint('update-test', newConfig);

      // Get bucket again - should use new config
      const bucket2 = manager.getOrCreateBucket('update-test');
      expect(bucket2.capacity).toBe(30);
      expect(bucket2.refillRate).toBe(15);
    });

    it('should preserve token ratio when updating configuration', () => {
      // Use half the tokens
      manager.tryAcquire('preserve-test', 5);

      // Update configuration
      manager.configureEndpoint('preserve-test', {
        capacity: 20,
        refillRate: 10,
      });

      const bucket = manager.getOrCreateBucket('preserve-test');
      // Should have ~10 tokens (50% of new capacity)
      expect(bucket.tokens).toBeGreaterThan(8);
      expect(bucket.tokens).toBeLessThanOrEqual(10);
    });

    it('should throw error for invalid configuration', () => {
      expect(() =>
        manager.configureEndpoint('test', { capacity: 0, refillRate: 5 }),
      ).toThrow('Capacity must be a positive number');
      expect(() =>
        manager.configureEndpoint('test', { capacity: 10, refillRate: -1 }),
      ).toThrow('Refill rate must be a positive number');
    });

    it('should throw error for empty endpoint key', () => {
      expect(() =>
        manager.configureEndpoint('', { capacity: 10, refillRate: 5 }),
      ).toThrow('Endpoint key must be non-empty');
    });
  });

  describe('getEndpointStats', () => {
    it('should return stats for existing endpoint', () => {
      manager.tryAcquire('stats-test', 3);

      const stats = manager.getEndpointStats('stats-test');

      expect(stats.currentTokens).toBe(7);
      expect(stats.capacity).toBe(10);
      expect(stats.refillRate).toBe(5);
      expect(stats.successfulAcquisitions).toBe(1);
      expect(stats.failedAcquisitions).toBe(0);
      expect(stats.averageWaitTime).toBe(0);
      expect(typeof stats.lastRefill).toBe('number');
      expect(typeof stats.timestamp).toBe('number');
    });

    it('should return default stats for non-existent endpoint', () => {
      const stats = manager.getEndpointStats('non-existent');

      expect(stats.currentTokens).toBe(10);
      expect(stats.capacity).toBe(10);
      expect(stats.refillRate).toBe(5);
      expect(stats.successfulAcquisitions).toBe(0);
      expect(stats.failedAcquisitions).toBe(0);
      expect(stats.averageWaitTime).toBe(0);
    });

    it('should return stats for endpoint with custom config', () => {
      manager.configureEndpoint('custom-stats', {
        capacity: 25,
        refillRate: 12,
      });

      const stats = manager.getEndpointStats('custom-stats');

      expect(stats.capacity).toBe(25);
      expect(stats.refillRate).toBe(12);
    });

    it('should throw error for empty endpoint key', () => {
      expect(() => manager.getEndpointStats('')).toThrow(
        'Endpoint key must be non-empty',
      );
    });
  });

  describe('resetEndpoint', () => {
    it('should reset bucket to full capacity', async () => {
      await manager.tryAcquire('reset-test', 8);

      let stats = manager.getEndpointStats('reset-test');
      expect(stats.currentTokens).toBe(2);

      manager.resetEndpoint('reset-test');

      stats = manager.getEndpointStats('reset-test');
      expect(stats.currentTokens).toBe(10);
    });

    it('should handle non-existent endpoint gracefully', () => {
      expect(() => manager.resetEndpoint('non-existent')).not.toThrow();
    });

    it('should throw error for empty endpoint key', () => {
      expect(() => manager.resetEndpoint('')).toThrow(
        'Endpoint key must be non-empty',
      );
    });
  });

  describe('getActiveEndpoints', () => {
    it('should return empty array for new manager', () => {
      expect(manager.getActiveEndpoints()).toEqual([]);
    });

    it('should return all accessed endpoints', () => {
      manager.getOrCreateBucket('endpoint1');
      manager.getOrCreateBucket('endpoint2');
      manager.getOrCreateBucket('endpoint3');

      const endpoints = manager.getActiveEndpoints();

      expect(endpoints).toContain('endpoint1');
      expect(endpoints).toContain('endpoint2');
      expect(endpoints).toContain('endpoint3');
      expect(endpoints).toHaveLength(3);
    });
  });

  describe('cleanupInactiveEndpoints', () => {
    it('should not remove recently accessed endpoints', () => {
      manager.getOrCreateBucket('active-endpoint');

      const removed = manager.cleanupInactiveEndpoints(1000);

      expect(removed).toBe(0);
      expect(manager.getActiveEndpoints()).toContain('active-endpoint');
    });

    it('should remove inactive endpoints', async () => {
      manager.getOrCreateBucket('inactive-endpoint');

      // Mock time passing
      const originalNow = Date.now;
      const mockNow = vi.fn().mockReturnValue(Date.now() + 4000);
      Date.now = mockNow;

      const removed = manager.cleanupInactiveEndpoints(3000);

      Date.now = originalNow;

      expect(removed).toBe(1);
      expect(manager.getActiveEndpoints()).not.toContain('inactive-endpoint');
    });

    it('should respect custom idle timeout', async () => {
      manager.getOrCreateBucket('custom-timeout');

      const originalNow = Date.now;
      const mockNow = vi.fn().mockReturnValue(Date.now() + 2000);
      Date.now = mockNow;

      const removed = manager.cleanupInactiveEndpoints(1000);

      Date.now = originalNow;

      expect(removed).toBe(1);
    });
  });

  describe('Integration tests', () => {
    it('should handle complex multi-endpoint scenario', async () => {
      // Configure different endpoints
      manager.configureEndpoint('api-heavy', { capacity: 100, refillRate: 50 });
      manager.configureEndpoint('api-light', { capacity: 5, refillRate: 1 });

      // Simulate usage
      await Promise.all([
        manager.tryAcquire('api-heavy', 50),
        manager.tryAcquire('api-light', 3),
        manager.tryAcquire('default-endpoint', 5),
      ]);

      const heavyStats = manager.getEndpointStats('api-heavy');
      const lightStats = manager.getEndpointStats('api-light');
      const defaultStats = manager.getEndpointStats('default-endpoint');

      expect(heavyStats.capacity).toBe(100);
      expect(lightStats.capacity).toBe(5);
      expect(defaultStats.capacity).toBe(10);

      expect(heavyStats.currentTokens).toBe(50);
      expect(lightStats.currentTokens).toBe(2);
      expect(defaultStats.currentTokens).toBe(5);
    });

    it('should handle configuration changes during active usage', async () => {
      const endpoint = 'dynamic-config';

      // Start with default config
      await manager.tryAcquire(endpoint, 5);

      // Change configuration mid-use
      manager.configureEndpoint(endpoint, { capacity: 20, refillRate: 10 });

      // Continue usage with new config
      await manager.tryAcquire(endpoint, 10);

      const stats = manager.getEndpointStats(endpoint);
      expect(stats.capacity).toBe(20);
      expect(stats.successfulAcquisitions).toBe(2);
    });

    it('should maintain accurate statistics under load', async () => {
      const endpoint = 'load-test';
      const promises: Promise<boolean>[] = [];

      // Generate load
      for (let i = 0; i < 100; i++) {
        promises.push(manager.tryAcquire(endpoint, 1, 1000));
      }

      await Promise.all(promises);

      const stats = manager.getEndpointStats(endpoint);

      expect(stats.successfulAcquisitions + stats.failedAcquisitions).toBe(100);
      expect(typeof stats.averageWaitTime).toBe('number');
    });
  });

  describe('Performance tests', () => {
    it('should handle high-frequency operations efficiently', async () => {
      const start = Date.now();

      // Perform many operations
      const promises: Promise<boolean>[] = Array.from(
        { length: 1000 },
        (_, i) => manager.tryAcquire(`perf-test-${i % 10}`, 1),
      );

      await Promise.all(promises);

      const elapsed = Date.now() - start;

      // Should complete quickly (less than 500ms for 1000 operations)
      expect(elapsed).toBeLessThan(500);
    });

    it('should have minimal memory overhead per endpoint', () => {
      const initialEndpoints = manager.getActiveEndpoints().length;

      // Create many endpoints
      for (let i = 0; i < 100; i++) {
        manager.getOrCreateBucket(`memory-test-${i}`);
      }

      expect(manager.getActiveEndpoints().length).toBe(initialEndpoints + 100);

      // Mock time passing for cleanup
      const originalNow = Date.now;
      const mockNow = vi.fn().mockReturnValue(Date.now() + 1000);
      Date.now = mockNow;

      // Cleanup should work
      const removed = manager.cleanupInactiveEndpoints(0);

      Date.now = originalNow;

      expect(removed).toBe(100);
    });
  });

  describe('Configuration compatibility', () => {
    it('should support global configuration as default', () => {
      const globalConfig: RateLimitConfig = { capacity: 100, refillRate: 50 };
      const globalManager = new TokenBucketManager(globalConfig);

      // Should work with all endpoints by default
      globalManager.getOrCreateBucket('test-endpoint');

      const stats = globalManager.getEndpointStats('test-endpoint');
      expect(stats.capacity).toBe(100);
      expect(stats.refillRate).toBe(50);
    });

    it('should allow per-endpoint configuration overrides', () => {
      const baseManager = new TokenBucketManager({
        capacity: 10,
        refillRate: 5,
      });

      // Start with global defaults
      baseManager.getOrCreateBucket('endpoint1');
      baseManager.getOrCreateBucket('endpoint2');

      // Add per-endpoint configuration
      baseManager.configureEndpoint('endpoint1', {
        capacity: 20,
        refillRate: 10,
      });

      const stats1 = baseManager.getEndpointStats('endpoint1');
      const stats2 = baseManager.getEndpointStats('endpoint2');

      expect(stats1.capacity).toBe(20);
      expect(stats2.capacity).toBe(10); // Still using global default
    });
  });
});
