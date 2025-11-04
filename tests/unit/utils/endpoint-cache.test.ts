import { beforeEach, describe, expect, it } from 'vitest';

import { EndpointCache } from '../../../src/utils/endpoint-cache';

describe('EndpointCache', () => {
  let cache: EndpointCache;

  beforeEach(() => {
    cache = new EndpointCache();
  });

  describe('Basic Operations', () => {
    it('should create and cache endpoint keys', () => {
      const method = 'GET';
      const url = 'https://api.example.com/users';

      const key = cache.getEndpointKey(method, url);

      expect(key).toBe('GET https://api.example.com/users');
      expect(cache.hasEndpointKey(method, url)).toBe(true);
    });

    it('should retrieve cached endpoint keys', () => {
      const method = 'POST';
      const url = 'https://api.example.com/users';

      const key1 = cache.getEndpointKey(method, url);
      const key2 = cache.getEndpointKey(method, url);

      expect(key1).toBe(key2);
      expect(cache.getSize()).toBe(1);
    });

    it('should check if endpoint key is cached', () => {
      const method = 'PUT';
      const url = 'https://api.example.com/users/123';

      expect(cache.hasEndpointKey(method, url)).toBe(false);

      cache.getEndpointKey(method, url);
      expect(cache.hasEndpointKey(method, url)).toBe(true);
    });

    it('should get cached endpoint key without creating', () => {
      const method = 'DELETE';
      const url = 'https://api.example.com/users/123';

      const key = cache.getCachedEndpointKey(method, url);
      expect(key).toBeUndefined();

      cache.getEndpointKey(method, url);
      const cachedKey = cache.getCachedEndpointKey(method, url);
      expect(cachedKey).toBe('DELETE https://api.example.com/users/123');
    });
  });

  describe('Cache Management', () => {
    it('should clear all cached keys', () => {
      cache.getEndpointKey('GET', 'https://api1.com');
      cache.getEndpointKey('POST', 'https://api2.com');

      expect(cache.getSize()).toBe(2);

      cache.clear();
      expect(cache.getSize()).toBe(0);
      expect(cache.isEmpty()).toBe(true);
    });

    it('should remove specific endpoint keys', () => {
      const method = 'GET';
      const url = 'https://api.example.com/users';

      cache.getEndpointKey(method, url);
      expect(cache.hasEndpointKey(method, url)).toBe(true);

      const removed = cache.removeEndpointKey(method, url);
      expect(removed).toBe(true);
      expect(cache.hasEndpointKey(method, url)).toBe(false);

      const removedAgain = cache.removeEndpointKey(method, url);
      expect(removedAgain).toBe(false);
    });

    it('should return correct cache size', () => {
      expect(cache.getSize()).toBe(0);

      cache.getEndpointKey('GET', 'https://api1.com');
      expect(cache.getSize()).toBe(1);

      cache.getEndpointKey('POST', 'https://api2.com');
      expect(cache.getSize()).toBe(2);

      cache.removeEndpointKey('GET', 'https://api1.com');
      expect(cache.getSize()).toBe(1);
    });

    it('should check if cache is empty', () => {
      expect(cache.isEmpty()).toBe(true);

      cache.getEndpointKey('GET', 'https://api.com');
      expect(cache.isEmpty()).toBe(false);

      cache.clear();
      expect(cache.isEmpty()).toBe(true);
    });
  });

  describe('Key Generation', () => {
    it('should generate consistent keys for same inputs', () => {
      const method = 'GET';
      const url = 'https://api.example.com/users';

      const key1 = cache.getEndpointKey(method, url);
      const key2 = cache.getEndpointKey(method, url);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different methods', () => {
      const url = 'https://api.example.com/users';

      const getKey = cache.getEndpointKey('GET', url);
      const postKey = cache.getEndpointKey('POST', url);

      expect(getKey).not.toBe(postKey);
    });

    it('should generate different keys for different URLs', () => {
      const method = 'GET';

      const key1 = cache.getEndpointKey(method, 'https://api1.com');
      const key2 = cache.getEndpointKey(method, 'https://api2.com');

      expect(key1).not.toBe(key2);
    });

    it('should handle special characters in URLs', () => {
      const method = 'GET';
      const url = 'https://api.example.com/users?filter=active&limit=10';

      const key = cache.getEndpointKey(method, url);
      expect(key).toBe(
        'GET https://api.example.com/users?filter=active&limit=10',
      );
    });

    it('should handle empty strings', () => {
      const key = cache.getEndpointKey('', '');
      expect(key).toBe(' ');
    });
  });

  describe('Bulk Operations', () => {
    it('should get all endpoint keys', () => {
      cache.getEndpointKey('GET', 'https://api1.com');
      cache.getEndpointKey('POST', 'https://api2.com');

      const keys = cache.getAllEndpointKeys();

      expect(keys).toHaveLength(2);
      expect(keys).toContain('GET https://api1.com');
      expect(keys).toContain('POST https://api2.com');
    });

    it('should get all cache entries', () => {
      cache.getEndpointKey('GET', 'https://api1.com');
      cache.getEndpointKey('POST', 'https://api2.com');

      const entries = cache.getAllEntries();

      expect(entries).toHaveLength(2);
      expect(entries).toContainEqual([
        'GET|https://api1.com',
        'GET https://api1.com',
      ]);
      expect(entries).toContainEqual([
        'POST|https://api2.com',
        'POST https://api2.com',
      ]);
    });

    it('should return empty arrays when cache is empty', () => {
      expect(cache.getAllEndpointKeys()).toEqual([]);
      expect(cache.getAllEntries()).toEqual([]);
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle many unique endpoints efficiently', () => {
      const iterations = 1000;

      const start = Date.now();
      for (let i = 0; i < iterations; i++) {
        cache.getEndpointKey('GET', `https://api.example.com/users/${i}`);
      }
      const duration = Date.now() - start;

      expect(cache.getSize()).toBe(iterations);
      expect(duration).toBeLessThan(200); // Relaxed for CI environments
    });

    it('should retrieve cached keys quickly', () => {
      // Pre-populate cache
      for (let i = 0; i < 100; i++) {
        cache.getEndpointKey('GET', `https://api.example.com/users/${i}`);
      }

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        cache.getEndpointKey('GET', `https://api.example.com/users/${i}`);
      }
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50); // Should be very fast for cached keys
    });
  });

  describe('Global Instance', () => {
    it('should provide global endpoint cache instance', async () => {
      const { globalEndpointCache } = await import(
        '../../../src/utils/endpoint-cache'
      );

      expect(globalEndpointCache).toBeInstanceOf(EndpointCache);

      const key = globalEndpointCache.getEndpointKey(
        'GET',
        'https://global.com',
      );
      expect(key).toBe('GET https://global.com');
    });
  });
});
