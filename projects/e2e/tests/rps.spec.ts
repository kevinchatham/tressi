import { expect, test } from '@playwright/test';
import { runLoadTest, TressiConfig } from '@tressi/cli';

import { ServerManager } from '../setup/server-manager';

test.describe('Per-endpoint RPS Configuration Tests', () => {
  let serverManager: ServerManager;
  let baseUrl: string;

  test.beforeAll(async () => {
    serverManager = new ServerManager();
    baseUrl = await serverManager.start();
  });

  test.afterAll(async () => {
    await serverManager.stop();
  });

  test.describe('Endpoint specific rate limiting', () => {
    test('should apply different RPS limits to different endpoints', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 50,
            rampUpDurationSec: 0,
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
            rampUpDurationSec: 0,
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
            rampUpDurationSec: 0,
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
          rampUpDurationSec: 0,
          headers: {},
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
        results.summary.global.totalRequests /
        results.summary.global.finalDurationSec;
      expect(actualRps).toBeGreaterThanOrEqual(75);
      expect(actualRps).toBeLessThanOrEqual(95);

      const successEndpoint = results.summary.endpoints.find((e: any) =>
        e.url.endsWith('/success'),
      );
      const delayEndpoint = results.summary.endpoints.find((e: any) =>
        e.url.endsWith('/delay/100'),
      );
      const payloadEndpoint = results.summary.endpoints.find((e: any) =>
        e.url.endsWith('/payload/1'),
      );

      expect(successEndpoint?.successfulRequests).toBeGreaterThan(200);
      expect(delayEndpoint?.successfulRequests).toBeGreaterThan(100);
      expect(payloadEndpoint?.successfulRequests).toBeGreaterThan(40);
    });

    test('should handle minimum RPS for specific endpoints', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 1,
            rampUpDurationSec: 0,
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
            rampUpDurationSec: 0,
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
            rampUpDurationSec: 0,
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
          rampUpDurationSec: 0,
          headers: {},
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

      const successEndpoint = results.summary.endpoints.find((e: any) =>
        e.url.endsWith('/success'),
      );
      const delayEndpoint = results.summary.endpoints.find((e: any) =>
        e.url.endsWith('/delay/50'),
      );
      const payloadEndpoint = results.summary.endpoints.find((e: any) =>
        e.url.endsWith('/payload/1'),
      );

      expect(successEndpoint?.successfulRequests).toBeGreaterThan(4);
      expect(delayEndpoint?.successfulRequests).toBeGreaterThan(140);
      expect(payloadEndpoint?.successfulRequests).toBeGreaterThan(90);
    });

    test('should support very high per-endpoint RPS', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 100,
            rampUpDurationSec: 0,
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
            rampUpDurationSec: 0,
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
          rampUpDurationSec: 0,
          headers: {},
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
        results.summary.global.totalRequests /
        results.summary.global.finalDurationSec;
      expect(actualRps).toBeGreaterThanOrEqual(250);
      expect(actualRps).toBeLessThanOrEqual(320);
    });

    test('should support very low per-endpoint RPS', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 2,
            rampUpDurationSec: 0,
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
            rampUpDurationSec: 0,
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
          rampUpDurationSec: 0,
          headers: {},
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
        results.summary.global.totalRequests /
        results.summary.global.finalDurationSec;
      expect(actualRps).toBeGreaterThanOrEqual(3);
      expect(actualRps).toBeLessThanOrEqual(5);
    });
  });

  test.describe('Mixed configuration scenarios', () => {
    test('should combine per-endpoint and global RPS correctly', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/delay/50`,
            method: 'GET',
            rps: 40,
            rampUpDurationSec: 0,
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
            rampUpDurationSec: 0,
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
            rampUpDurationSec: 0,
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
          rampUpDurationSec: 0,
          headers: {},
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
        results.summary.global.totalRequests /
        results.summary.global.finalDurationSec;
      expect(actualRps).toBeGreaterThanOrEqual(65);
      expect(actualRps).toBeLessThanOrEqual(85);
    });

    test('should handle all endpoints using global RPS', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 20,
            rampUpDurationSec: 0,
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
            rampUpDurationSec: 0,
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
            rampUpDurationSec: 0,
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
          rampUpDurationSec: 0,
          headers: {},
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
        results.summary.global.totalRequests /
        results.summary.global.finalDurationSec;
      expect(actualRps).toBeGreaterThanOrEqual(55);
      expect(actualRps).toBeLessThanOrEqual(65);
    });
  });

  test.describe('Edge cases', () => {
    test('should handle single endpoint with per-endpoint RPS', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 100,
            rampUpDurationSec: 0,
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
          rampUpDurationSec: 0,
          headers: {},
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
        results.summary.global.totalRequests /
        results.summary.global.finalDurationSec;
      expect(actualRps).toBeGreaterThanOrEqual(90);
      expect(actualRps).toBeLessThanOrEqual(110);
    });

    test('should handle low RPS values', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 5,
            rampUpDurationSec: 0,
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
          rampUpDurationSec: 0,
          headers: {},
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
        results.summary.global.totalRequests /
        results.summary.global.finalDurationSec;
      expect(actualRps).toBeGreaterThanOrEqual(4.5);
      expect(actualRps).toBeLessThanOrEqual(5.5);
    });
  });

  test.describe('Accuracy validation', () => {
    test('should maintain reasonable accuracy for single endpoint', async () => {
      const targetRps = 75;

      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: targetRps,
            rampUpDurationSec: 0,
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
          rampUpDurationSec: 0,
          headers: {},
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
        results.summary.global.totalRequests /
        results.summary.global.finalDurationSec;
      const tolerance = targetRps * 0.1;
      expect(actualRps).toBeGreaterThanOrEqual(targetRps - tolerance);
      expect(actualRps).toBeLessThanOrEqual(targetRps + tolerance);
    });

    test('should maintain reasonable accuracy for multiple endpoints', async () => {
      const expectedTotal = 30 + 20 + 10;

      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 30,
            rampUpDurationSec: 0,
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
            rampUpDurationSec: 0,
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
            rampUpDurationSec: 0,
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
          rampUpDurationSec: 0,
          headers: {},
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
        results.summary.global.totalRequests /
        results.summary.global.finalDurationSec;
      const tolerance = expectedTotal * 0.15;
      expect(actualRps).toBeGreaterThanOrEqual(expectedTotal - tolerance);
      expect(actualRps).toBeLessThanOrEqual(expectedTotal + tolerance);
    });
  });
});
