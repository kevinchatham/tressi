import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TressiConfig } from '../../src/common/config/types';
import { runLoadTest } from '../../src/index';
import { ServerManager } from '../setup/server-manager';

describe('Per-endpoint RPS Configuration Tests', () => {
  let serverManager: ServerManager;
  let baseUrl: string;

  beforeAll(async () => {
    serverManager = new ServerManager();
    baseUrl = await serverManager.start();
  });

  afterAll(async () => {
    await serverManager.stop();
  });

  describe('Endpoint-specific rate limiting', () => {
    it('should apply different RPS limits to different endpoints', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 50,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
          {
            url: `${baseUrl}/delay/100`,
            method: 'GET',
            rps: 25,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
          {
            url: `${baseUrl}/payload/1`,
            method: 'GET',
            rps: 10,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
        ],
        options: {
          durationSec: 5, // Reduced duration for faster tests
          silent: true,
          headers: {},
          exportPath: '',
          threads: 4,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
            monitoringWindowMs: 5000,
          },
        },
      };

      const results = await runLoadTest(config);

      // Total should be close to 50 + 25 + 10 = 85 RPS
      const actualRps =
        results.global.totalRequests / results.global.finalDurationSec;
      expect(actualRps).toBeGreaterThanOrEqual(75);
      expect(actualRps).toBeLessThanOrEqual(95);

      // Each endpoint should have appropriate request counts
      const successEndpoint = results.endpoints.find((e) =>
        e.url.endsWith('/success'),
      );
      const delayEndpoint = results.endpoints.find((e) =>
        e.url.endsWith('/delay/100'),
      );
      const payloadEndpoint = results.endpoints.find((e) =>
        e.url.endsWith('/payload/1'),
      );

      expect(successEndpoint?.successfulRequests).toBeGreaterThan(200);
      expect(delayEndpoint?.successfulRequests).toBeGreaterThan(100);
      expect(payloadEndpoint?.successfulRequests).toBeGreaterThan(40);
    });

    it('should handle minimum RPS for specific endpoints', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 1,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
          {
            url: `${baseUrl}/delay/50`,
            method: 'GET',
            rps: 30,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
          {
            url: `${baseUrl}/payload/1`,
            method: 'GET',
            rps: 20,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
        ],
        options: {
          durationSec: 5,
          silent: true,
          headers: {},
          exportPath: '',
          threads: 4,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
            monitoringWindowMs: 5000,
          },
        },
      };

      const results = await runLoadTest(config);

      // Should hit all endpoints with their specified RPS
      const successEndpoint = results.endpoints.find((e) =>
        e.url.endsWith('/success'),
      );
      const delayEndpoint = results.endpoints.find((e) =>
        e.url.endsWith('/delay/50'),
      );
      const payloadEndpoint = results.endpoints.find((e) =>
        e.url.endsWith('/payload/1'),
      );

      expect(successEndpoint?.successfulRequests).toBeGreaterThan(4);
      expect(delayEndpoint?.successfulRequests).toBeGreaterThan(140);
      expect(payloadEndpoint?.successfulRequests).toBeGreaterThan(90);
    });

    it('should support very high per-endpoint RPS', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 100,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
          {
            url: `${baseUrl}/delay/50`,
            method: 'GET',
            rps: 200,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
        ],
        options: {
          durationSec: 3,
          silent: true,
          headers: {},
          exportPath: '',
          threads: 4,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
            monitoringWindowMs: 5000,
          },
        },
      };

      const results = await runLoadTest(config);

      // Should achieve close to 300 RPS total
      const actualRps =
        results.global.totalRequests / results.global.finalDurationSec;
      expect(actualRps).toBeGreaterThanOrEqual(250);
      expect(actualRps).toBeLessThanOrEqual(320);
    });

    it('should support very low per-endpoint RPS', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 2,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
          {
            url: `${baseUrl}/delay/100`,
            method: 'GET',
            rps: 3,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
        ],
        options: {
          durationSec: 10,
          silent: true,
          headers: {},
          exportPath: '',
          threads: 4,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
            monitoringWindowMs: 5000,
          },
        },
      };

      const results = await runLoadTest(config);

      // Should achieve close to 4 RPS total
      const actualRps =
        results.global.totalRequests / results.global.finalDurationSec;
      expect(actualRps).toBeGreaterThanOrEqual(3);
      expect(actualRps).toBeLessThanOrEqual(5);
    });
  });

  describe('Mixed configuration scenarios', () => {
    it('should combine per-endpoint and global RPS correctly', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/delay/50`,
            method: 'GET',
            rps: 40,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 15,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
          {
            url: `${baseUrl}/payload/10`,
            method: 'GET',
            rps: 20,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
        ],
        options: {
          durationSec: 5,
          silent: true,
          headers: {},
          exportPath: '',
          threads: 4,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
            monitoringWindowMs: 5000,
          },
        },
      };

      const results = await runLoadTest(config);

      // Expected: 40 + 15 + 20 = 75 RPS
      const actualRps =
        results.global.totalRequests / results.global.finalDurationSec;
      expect(actualRps).toBeGreaterThanOrEqual(65);
      expect(actualRps).toBeLessThanOrEqual(85);
    });

    it('should handle all endpoints using global RPS', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 20,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
          {
            url: `${baseUrl}/delay/100`,
            method: 'GET',
            rps: 20,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
          {
            url: `${baseUrl}/payload/10`,
            method: 'GET',
            rps: 20,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
        ],
        options: {
          durationSec: 5,
          silent: true,
          headers: {},
          exportPath: '',
          threads: 4,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
            monitoringWindowMs: 5000,
          },
        },
      };

      const results = await runLoadTest(config);

      // Should distribute 60 RPS across all endpoints
      const actualRps =
        results.global.totalRequests / results.global.finalDurationSec;
      expect(actualRps).toBeGreaterThanOrEqual(55);
      expect(actualRps).toBeLessThanOrEqual(65);
    });
  });

  describe('Edge cases', () => {
    it('should handle single endpoint with per-endpoint RPS', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 100,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
        ],
        options: {
          durationSec: 3,
          silent: true,
          headers: {},
          exportPath: '',
          threads: 4,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
            monitoringWindowMs: 5000,
          },
        },
      };

      const results = await runLoadTest(config);

      const actualRps =
        results.global.totalRequests / results.global.finalDurationSec;
      expect(actualRps).toBeGreaterThanOrEqual(90);
      expect(actualRps).toBeLessThanOrEqual(110);
    });

    it('should handle low RPS values', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 5,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
        ],
        options: {
          durationSec: 10,
          silent: true,
          headers: {},
          exportPath: '',
          threads: 4,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
            monitoringWindowMs: 5000,
          },
        },
      };

      const results = await runLoadTest(config);

      // Should achieve close to 5 RPS total
      const actualRps =
        results.global.totalRequests / results.global.finalDurationSec;
      expect(actualRps).toBeGreaterThanOrEqual(4.5);
      expect(actualRps).toBeLessThanOrEqual(5.5);
    });
  });

  describe('Accuracy validation', () => {
    it('should maintain reasonable accuracy for single endpoint', async () => {
      const targetRps = 75;

      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: targetRps,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
        ],
        options: {
          durationSec: 5,
          silent: true,
          headers: {},
          exportPath: '',
          threads: 4,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
            monitoringWindowMs: 5000,
          },
        },
      };

      const results = await runLoadTest(config);

      const actualRps =
        results.global.totalRequests / results.global.finalDurationSec;
      const tolerance = targetRps * 0.1; // 10% tolerance for real-world conditions
      expect(actualRps).toBeGreaterThanOrEqual(targetRps - tolerance);
      expect(actualRps).toBeLessThanOrEqual(targetRps + tolerance);
    });

    it('should maintain reasonable accuracy for multiple endpoints', async () => {
      const expectedTotal = 30 + 20 + 10; // 60 RPS

      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 30,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
          {
            url: `${baseUrl}/delay/100`,
            method: 'GET',
            rps: 20,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
          {
            url: `${baseUrl}/payload/10`,
            method: 'GET',
            rps: 10,
            payload: {},
            headers: {},
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
              monitoringWindowMs: 5000,
            },
          },
        ],
        options: {
          durationSec: 5,
          silent: true,
          headers: {},
          exportPath: '',
          threads: 4,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
            monitoringWindowMs: 5000,
          },
        },
      };

      const results = await runLoadTest(config);

      const actualRps =
        results.global.totalRequests / results.global.finalDurationSec;
      const tolerance = expectedTotal * 0.15; // 15% tolerance for real-world conditions
      expect(actualRps).toBeGreaterThanOrEqual(expectedTotal - tolerance);
      expect(actualRps).toBeLessThanOrEqual(expectedTotal + tolerance);
    });
  });
});
