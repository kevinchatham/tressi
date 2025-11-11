import { beforeEach, describe, expect, it } from 'vitest';

import { EndpointRateLimiterManager } from '../../../src/core/endpoint-rate-limiter-manager';
import type { TressiRequestConfig } from '../../../src/types';
import type { EndpointRateLimitConfig } from '../../../src/types/rate-limit.types';

describe('EndpointRateLimiterManager', () => {
  let manager: EndpointRateLimiterManager;

  beforeEach(() => {
    manager = new EndpointRateLimiterManager();
  });

  describe('constructor', () => {
    it('should create manager with default configuration', () => {
      expect(manager.getManagedEndpoints()).toEqual([]);
    });

    it('should create manager with default capacity configuration', () => {
      const config = {
        defaultCapacity: 50,
      };
      manager = new EndpointRateLimiterManager(config);

      expect(manager.getManagedEndpoints()).toEqual([]);
    });
  });

  describe('getLimiter', () => {
    it('should create new limiter for endpoint', () => {
      const request: TressiRequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      };

      const limiter = manager.getLimiter(request.url, request);

      expect(limiter).toBeDefined();
      expect(limiter.getEndpoint()).toBe(request.url);
      expect(manager.getManagedEndpoints()).toContain(request.url);
    });

    it('should return existing limiter for same endpoint', () => {
      const request: TressiRequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      };

      const limiter1 = manager.getLimiter(request.url, request);
      const limiter2 = manager.getLimiter(request.url, request);

      expect(limiter1).toBe(limiter2);
    });

    it('should use per-endpoint RPS when provided', () => {
      const request: TressiRequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      };

      const limiter = manager.getLimiter(request.url, request);
      const config = limiter.getConfig();

      expect(config.rps).toBe(50);
      expect(config.enabled).toBe(true);
    });

    it('should throw error when RPS is not provided', () => {
      manager = new EndpointRateLimiterManager({});

      const request: TressiRequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      };

      expect(() => {
        manager.getLimiter(request.url, request);
      }).toThrow('RPS is required for endpoint: https://api.example.com/users');
    });

    it('should disable rate limiting when RPS is 0', () => {
      const request: TressiRequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      };

      const limiter = manager.getLimiter(request.url, request);
      const config = limiter.getConfig();

      expect(config.enabled).toBe(false);
    });
  });

  describe('updateEndpointConfig', () => {
    it('should update configuration for existing endpoint', () => {
      const request: TressiRequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      };

      const limiter = manager.getLimiter(request.url, request);

      manager.updateEndpointConfig(request.url, newConfig);

      const updatedConfig = limiter.getConfig();
      expect(updatedConfig.rps).toBe(75);
      expect(updatedConfig.capacity).toBe(100);
    });

    it('should create new limiter for non-existent endpoint', () => {
      const endpoint = 'https://api.example.com/posts';

      manager.updateEndpointConfig(endpoint, config);

      expect(manager.getManagedEndpoints()).toContain(endpoint);
    });
  });

  describe('removeLimiter', () => {
    it('should remove limiter for endpoint', () => {
      const request: TressiRequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      };

      manager.getLimiter(request.url, request);
      expect(manager.getManagedEndpoints()).toContain(request.url);

      manager.removeLimiter(request.url);
      expect(manager.getManagedEndpoints()).not.toContain(request.url);
    });
  });

  describe('resetAll', () => {
    it('should reset all limiters', () => {
      const requests: TressiRequestConfig[] = [];

      manager.initializeForRequests(requests);

      // Consume some tokens
      for (const endpoint of manager.getManagedEndpoints()) {
        const limiter = manager.getLimiter(endpoint);
        limiter.tryConsume(5);
      }

      manager.resetAll();

      // All limiters should be reset to full capacity
      for (const endpoint of manager.getManagedEndpoints()) {
        const limiter = manager.getLimiter(endpoint);
        const state = limiter.getState();
        expect(state.availableTokens).toBe(state.capacity);
      }
    });
  });

  describe('initializeForRequests', () => {
    it('should initialize limiters for all requests', () => {
      const requests: TressiRequestConfig[] = [];

      manager.initializeForRequests(requests);

      expect(manager.getManagedEndpoints()).toHaveLength(3);
      expect(manager.getManagedEndpoints()).toContain(
        'https://api.example.com/users',
      );
      expect(manager.getManagedEndpoints()).toContain(
        'https://api.example.com/posts',
      );
      expect(manager.getManagedEndpoints()).toContain(
        'https://api.example.com/comments',
      );
    });

    it('should handle duplicate URLs', () => {
      const requests: TressiRequestConfig[] = [];

      manager.initializeForRequests(requests);

      expect(manager.getManagedEndpoints()).toHaveLength(1);
      expect(manager.getManagedEndpoints()).toContain(
        'https://api.example.com/users',
      );
    });
  });

  describe('updateGlobalConfig', () => {
    it('should update global configuration', () => {
      const initialConfig = { defaultCapacity: 20 };
      manager = new EndpointRateLimiterManager(initialConfig);

      const newConfig = { defaultCapacity: 100 };
      manager.updateGlobalConfig(newConfig);

      const request: TressiRequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      };

      const limiter = manager.getLimiter(request.url, request);
      const config = limiter.getConfig();

      expect(config.capacity).toBe(100);
    });

    it('should update endpoint-specific configurations', () => {
      const endpoint = 'https://api.example.com/users';
      const endpointConfig = new Map<string, EndpointRateLimitConfig>();

      manager.updateGlobalConfig({ endpointLimits: endpointConfig });

      const limiter = manager.getLimiter(endpoint);
      const config = limiter.getConfig();

      expect(config.rps).toBe(75);
      expect(config.capacity).toBe(150);
    });
  });
});
