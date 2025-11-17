import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runLoadTest } from '../../src/index';
import { TressiConfig } from '../../src/types';
import { ServerManager } from '../utils/server-manager';

describe('Tressi Load Testing E2E', () => {
  let serverManager: ServerManager;
  let baseUrl: string;

  beforeAll(async () => {
    serverManager = new ServerManager();
    baseUrl = await serverManager.start();
  });

  afterAll(async () => {
    await serverManager.stop();
  });

  describe('Basic Load Testing', () => {
    it('should execute a simple load test against server endpoints', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET' as const,
            rps: 10,
          },
        ],
        options: {
          durationSec: 5,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            monitoringWindowMs: 1000,
            stopMode: 'endpoint',
          },
        },
      };

      const results = await runLoadTest(config);

      expect(results.global.totalRequests).toBeGreaterThan(40);
      expect(results.global.successfulRequests).toBeGreaterThan(0);
      expect(results.endpoints[0].url).toContain('/success');
    });

    it('should handle POST requests with payload', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/echo`,
            method: 'POST' as const,
            payload: { test: 'data' },
            headers: {
              'Content-Type': 'application/json',
            },
            rps: 5,
          },
        ],
        options: {
          durationSec: 3,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            monitoringWindowMs: 1000,
            stopMode: 'endpoint',
          },
        },
      };

      const results = await runLoadTest(config);

      expect(results.global.totalRequests).toBeGreaterThan(10);
      expect(results.endpoints[0].url).toContain('/echo');
    });

    it('should handle multiple endpoints', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET' as const,
            rps: 10,
          },
          {
            url: `${baseUrl}/delay/50`,
            method: 'GET' as const,
            rps: 5,
          },
        ],
        options: {
          durationSec: 5,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            monitoringWindowMs: 1000,
            stopMode: 'endpoint',
          },
        },
      };

      const results = await runLoadTest(config);

      expect(results.global.totalRequests).toBeGreaterThan(30);
      expect(results.endpoints).toHaveLength(2);
    });

    it('should handle custom headers', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/headers`,
            method: 'GET' as const,
            headers: {
              'X-Custom-Header': 'test-value',
              'User-Agent': 'tressi-test',
            },
            rps: 5,
          },
        ],
        options: {
          durationSec: 3,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            monitoringWindowMs: 1000,
            stopMode: 'endpoint',
          },
        },
      };

      const results = await runLoadTest(config);

      expect(results.global.totalRequests).toBeGreaterThan(10);
      expect(results.endpoints[0].url).toContain('/headers');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid URLs gracefully', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/invalid-endpoint`,
            method: 'GET' as const,
            rps: 5,
          },
        ],
        options: {
          durationSec: 3,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            monitoringWindowMs: 1000,
            stopMode: 'endpoint',
          },
        },
      };

      const results = await runLoadTest(config);

      expect(results.global.totalRequests).toBeGreaterThan(0);
      expect(results.global.failedRequests).toBeGreaterThan(0);
    });

    it('should handle 404 responses', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/status/404`,
            method: 'GET' as const,
            rps: 5,
          },
        ],
        options: {
          durationSec: 3,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            monitoringWindowMs: 1000,
            stopMode: 'endpoint',
          },
        },
      };

      const results = await runLoadTest(config);

      expect(results.global.totalRequests).toBeGreaterThan(10);
      expect(results.endpoints[0].failedRequests).toBeGreaterThan(0);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate required configuration fields', async () => {
      const invalidConfig = {
        requests: [],
        options: {},
      };

      await expect(
        runLoadTest(invalidConfig as unknown as TressiConfig),
      ).rejects.toThrow();
    });

    it('should validate URL formats', async () => {
      const invalidConfig = {
        requests: [
          {
            url: 'invalid-url',
            method: 'GET' as const,
          },
        ],
        options: {
          durationSec: 1,
          silent: true,
        },
      };

      await expect(
        runLoadTest(invalidConfig as unknown as TressiConfig),
      ).rejects.toThrow();
    });
  });

  describe('Performance Characteristics', () => {
    it('should respect rate limiting', async () => {
      const config = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET' as const,
            rps: 20,
          },
        ],
        options: {
          durationSec: 5,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            monitoringWindowMs: 1000,
            stopMode: 'endpoint' as const,
          },
        },
      };

      const results = await runLoadTest(config);

      expect(results.global.actualRps).toBeGreaterThanOrEqual(15);
      expect(results.global.actualRps).toBeLessThanOrEqual(25);
    });

    it('should handle high RPS load', async () => {
      const config = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET' as const,
            rps: 50,
          },
        ],
        options: {
          durationSec: 3,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            monitoringWindowMs: 1000,
            stopMode: 'endpoint' as const,
          },
        },
      };

      const results = await runLoadTest(config);

      expect(results.global.actualRps).toBeGreaterThanOrEqual(35);
      expect(results.global.actualRps).toBeLessThanOrEqual(65);
    });
  });
});
