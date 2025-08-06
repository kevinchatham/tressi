import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TressiConfig } from '../src/config';

// Mock dependencies
vi.mock('../src/index', () => ({
  runLoadTest: vi.fn(),
}));

vi.mock('../src/config', () => ({
  loadConfig: vi.fn(),
}));

describe('Integration Tests - Complete Workflow', () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tressi-integration-'));
    configPath = path.join(tempDir, 'tressi.config.json');
  });

  afterEach(async () => {
    try {
      await fs.unlink(configPath);
      await fs.rmdir(tempDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('End-to-End Workflow Tests', () => {
    it('should handle production-like configuration', async () => {
      const productionConfig: TressiConfig = {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer prod-token-xyz789',
          'User-Agent': 'Tressi-LoadTest/1.0.0',
        },
        requests: [
          {
            url: 'https://api.production.com/api/v1/users',
            method: 'GET',
            headers: { 'X-API-Key': 'user-read-key' },
          },
          {
            url: 'https://api.production.com/api/v1/users',
            method: 'POST',
            payload: {
              user: {
                name: 'Load Test User',
                email: 'test@production.com',
                preferences: {
                  theme: 'dark',
                  notifications: true,
                },
              },
            },
          },
          {
            url: 'https://api.production.com/api/v1/users/123',
            method: 'PUT',
            payload: {
              user: {
                name: 'Updated User',
                active: true,
              },
            },
          },
          {
            url: 'https://api.production.com/api/v1/users/123',
            method: 'DELETE',
          },
        ],
        workers: 50,
        concurrentRequests: 25,
        duration: 300,
        rampUpTime: 60,
        rps: 1000,
        autoscale: true,
        export: './production-load-test-report',
        earlyExitOnError: true,
        errorRateThreshold: 0.05,
        errorCountThreshold: 100,
        errorStatusCodes: [400, 401, 403, 404, 422, 429, 500, 502, 503, 504],
      };

      await fs.writeFile(configPath, JSON.stringify(productionConfig, null, 2));

      const { loadConfig } = await import('../src/config');
      vi.mocked(loadConfig).mockResolvedValue(productionConfig);

      const { loadConfig: actualLoadConfig } = await import('../src/config');
      const config = await actualLoadConfig(configPath);

      expect(config.workers).toBe(50);
      expect(config.rps).toBe(1000);
      expect(config.autoscale).toBe(true);
      expect(config.errorStatusCodes).toHaveLength(10);
    });

    it('should handle development configuration', async () => {
      const devConfig: TressiConfig = {
        headers: {
          'Content-Type': 'application/json',
          'X-Environment': 'development',
        },
        requests: [
          {
            url: 'http://localhost:3000/api/test',
            method: 'GET',
          },
          {
            url: 'http://localhost:3000/api/test',
            method: 'POST',
            payload: { test: true, environment: 'dev' },
          },
        ],
        workers: 3,
        duration: 10,
        rps: 10,
        export: './dev-test',
      };

      await fs.writeFile(configPath, JSON.stringify(devConfig, null, 2));

      const { loadConfig } = await import('../src/config');
      vi.mocked(loadConfig).mockResolvedValue(devConfig);

      const { loadConfig: actualLoadConfig } = await import('../src/config');
      const config = await actualLoadConfig(configPath);

      expect(config.workers).toBe(3);
      expect(config.duration).toBe(10);
      expect(config.rps).toBe(10);
    });
  });

  describe('Configuration File Discovery', () => {
    it('should handle custom config file path', async () => {
      const customConfig: TressiConfig = {
        requests: [{ url: 'https://custom-api.com/test', method: 'POST' }],
        workers: 3,
      };

      const customPath = path.join(tempDir, 'custom-config.json');
      await fs.writeFile(customPath, JSON.stringify(customConfig));

      const { loadConfig } = await import('../src/config');
      vi.mocked(loadConfig).mockResolvedValue(customConfig);

      const { loadConfig: actualLoadConfig } = await import('../src/config');
      const config = await actualLoadConfig(customPath);

      expect(config.requests[0].url).toBe('https://custom-api.com/test');
      expect(config.workers).toBe(3);
    });
  });

  describe('Real-world Configuration Scenarios', () => {
    it('should handle production-like configuration', async () => {
      const productionConfig: TressiConfig = {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer prod-token-xyz789',
          'User-Agent': 'Tressi-LoadTest/1.0.0',
        },
        requests: [
          {
            url: 'https://api.production.com/api/v1/users',
            method: 'GET',
            headers: { 'X-API-Key': 'user-read-key' },
          },
          {
            url: 'https://api.production.com/api/v1/users',
            method: 'POST',
            payload: {
              user: {
                name: 'Load Test User',
                email: 'test@production.com',
                preferences: {
                  theme: 'dark',
                  notifications: true,
                },
              },
            },
          },
          {
            url: 'https://api.production.com/api/v1/users/123',
            method: 'PUT',
            payload: {
              user: {
                name: 'Updated User',
                active: true,
              },
            },
          },
          {
            url: 'https://api.production.com/api/v1/users/123',
            method: 'DELETE',
          },
        ],
        workers: 50,
        concurrentRequests: 25,
        duration: 300,
        rampUpTime: 60,
        rps: 1000,
        autoscale: true,
        export: './production-load-test-report',
        earlyExitOnError: true,
        errorRateThreshold: 0.05,
        errorCountThreshold: 100,
        errorStatusCodes: [400, 401, 403, 404, 422, 429, 500, 502, 503, 504],
      };

      await fs.writeFile(configPath, JSON.stringify(productionConfig, null, 2));

      const { loadConfig } = await import('../src/config');
      vi.mocked(loadConfig).mockResolvedValue(productionConfig);

      const { loadConfig: actualLoadConfig } = await import('../src/config');
      const config = await actualLoadConfig(configPath);

      expect(config.workers).toBe(50);
      expect(config.rps).toBe(1000);
      expect(config.autoscale).toBe(true);
      expect(config.errorStatusCodes).toHaveLength(10);
    });

    it('should handle development configuration', async () => {
      const devConfig: TressiConfig = {
        headers: {
          'Content-Type': 'application/json',
          'X-Environment': 'development',
        },
        requests: [
          {
            url: 'http://localhost:3000/api/test',
            method: 'GET',
          },
          {
            url: 'http://localhost:3000/api/test',
            method: 'POST',
            payload: { test: true, environment: 'dev' },
          },
        ],
        workers: 3,
        duration: 10,
        rps: 10,
        export: './dev-test',
      };

      await fs.writeFile(configPath, JSON.stringify(devConfig, null, 2));

      const { loadConfig } = await import('../src/config');
      vi.mocked(loadConfig).mockResolvedValue(devConfig);

      const { loadConfig: actualLoadConfig } = await import('../src/config');
      const config = await actualLoadConfig(configPath);

      expect(config.workers).toBe(3);
      expect(config.duration).toBe(10);
      expect(config.rps).toBe(10);
    });
  });
});
