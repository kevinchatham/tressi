import { SafeTressiConfig } from 'tressi-common/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
      const config: SafeTressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 50,
            payload: null,
            headers: null,
          },
          {
            url: `${baseUrl}/delay/100`,
            method: 'GET',
            rps: 25,
            payload: null,
            headers: null,
          },
          {
            url: `${baseUrl}/payload/1`,
            method: 'GET',
            rps: 10,
            payload: null,
            headers: null,
          },
        ],
        options: {
          durationSec: 10,
          rampUpTimeSec: 0,
          silent: true,
          headers: null,
          exportPath: null,
          threads: 4,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            globalErrorRateThreshold: 0.1,
            globalErrorCountThreshold: 100,
            perEndpointThresholds: [],
            workerExitStatusCodes: [],
            monitoringWindowMs: 1000,
            stopMode: 'endpoint',
          },
        },
      };

      const results = await runLoadTest(config);

      // Total should be close to 50 + 25 + 10 = 85 RPS
      expect(results.global.actualRps).toBeGreaterThanOrEqual(75);
      expect(results.global.actualRps).toBeLessThanOrEqual(95);

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

      expect(successEndpoint?.successfulRequests).toBeGreaterThan(400);
      expect(delayEndpoint?.successfulRequests).toBeGreaterThan(200);
      expect(payloadEndpoint?.successfulRequests).toBeGreaterThan(80);
    });

    it('should handle minimum RPS for specific endpoints', async () => {
      const config: SafeTressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 1,
            payload: null,
            headers: null,
          },
          {
            url: `${baseUrl}/delay/50`,
            method: 'GET',
            rps: 30,
            payload: null,
            headers: null,
          },
          {
            url: `${baseUrl}/payload/1`,
            method: 'GET',
            rps: 20,
            payload: null,
            headers: null,
          },
        ],
        options: {
          durationSec: 5,
          rampUpTimeSec: 0,
          silent: true,
          headers: null,
          exportPath: null,
          threads: 4,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            globalErrorRateThreshold: 0.1,
            globalErrorCountThreshold: 100,
            perEndpointThresholds: [],
            workerExitStatusCodes: [],
            monitoringWindowMs: 1000,
            stopMode: 'endpoint',
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
      const config: SafeTressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 100,
            payload: null,
            headers: null,
          },
          {
            url: `${baseUrl}/delay/50`,
            method: 'GET',
            rps: 200,
            payload: null,
            headers: null,
          },
        ],
        options: {
          durationSec: 3,
          rampUpTimeSec: 0,
          silent: true,
          headers: null,
          exportPath: null,
          threads: 4,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            globalErrorRateThreshold: 0.1,
            globalErrorCountThreshold: 100,
            perEndpointThresholds: [],
            workerExitStatusCodes: [],
            monitoringWindowMs: 1000,
            stopMode: 'endpoint',
          },
        },
      };

      const results = await runLoadTest(config);

      // Should achieve close to 300 RPS total
      expect(results.global.actualRps).toBeGreaterThanOrEqual(250);
      expect(results.global.actualRps).toBeLessThanOrEqual(320);
    });

    it('should support very low per-endpoint RPS', async () => {
      const config: SafeTressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 2,
            payload: null,
            headers: null,
          },
          {
            url: `${baseUrl}/delay/100`,
            method: 'GET',
            rps: 3,
            payload: null,
            headers: null,
          },
        ],
        options: {
          durationSec: 10,
          rampUpTimeSec: 0,
          silent: true,
          headers: null,
          exportPath: null,
          threads: 4,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            globalErrorRateThreshold: 0.1,
            globalErrorCountThreshold: 100,
            perEndpointThresholds: [],
            workerExitStatusCodes: [],
            monitoringWindowMs: 1000,
            stopMode: 'endpoint',
          },
        },
      };

      const results = await runLoadTest(config);

      // Should achieve close to 4 RPS total
      expect(results.global.actualRps).toBeGreaterThanOrEqual(3);
      expect(results.global.actualRps).toBeLessThanOrEqual(5);
    });
  });

  describe('Mixed configuration scenarios', () => {
    it('should combine per-endpoint and global RPS correctly', async () => {
      const config: SafeTressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/delay/50`,
            method: 'GET',
            rps: 40,
            payload: null,
            headers: null,
          },
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 15,
            payload: null,
            headers: null,
          },
          {
            url: `${baseUrl}/payload/10`,
            method: 'GET',
            rps: 20,
            payload: null,
            headers: null,
          },
        ],
        options: {
          durationSec: 5,
          rampUpTimeSec: 0,
          silent: true,
          headers: null,
          exportPath: null,
          threads: 4,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            globalErrorRateThreshold: 0.1,
            globalErrorCountThreshold: 100,
            perEndpointThresholds: [],
            workerExitStatusCodes: [],
            monitoringWindowMs: 1000,
            stopMode: 'endpoint',
          },
        },
      };

      const results = await runLoadTest(config);

      // Expected: 40 + 15 + 20 = 75 RPS
      expect(results.global.actualRps).toBeGreaterThanOrEqual(65);
      expect(results.global.actualRps).toBeLessThanOrEqual(85);
    });

    it('should handle all endpoints using global RPS', async () => {
      const config: SafeTressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 20,
            payload: null,
            headers: null,
          },
          {
            url: `${baseUrl}/delay/100`,
            method: 'GET',
            rps: 20,
            payload: null,
            headers: null,
          },
          {
            url: `${baseUrl}/payload/10`,
            method: 'GET',
            rps: 20,
            payload: null,
            headers: null,
          },
        ],
        options: {
          durationSec: 5,
          rampUpTimeSec: 0,
          silent: true,
          headers: null,
          exportPath: null,
          threads: 4,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            globalErrorRateThreshold: 0.1,
            globalErrorCountThreshold: 100,
            perEndpointThresholds: [],
            workerExitStatusCodes: [],
            monitoringWindowMs: 1000,
            stopMode: 'endpoint',
          },
        },
      };

      const results = await runLoadTest(config);

      // Should distribute 60 RPS across all endpoints
      expect(results.global.actualRps).toBeGreaterThanOrEqual(55);
      expect(results.global.actualRps).toBeLessThanOrEqual(65);
    });
  });

  describe('Edge cases', () => {
    it('should handle single endpoint with per-endpoint RPS', async () => {
      const config: SafeTressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 100,
            payload: null,
            headers: null,
          },
        ],
        options: {
          durationSec: 3,
          rampUpTimeSec: 0,
          silent: true,
          headers: null,
          exportPath: null,
          threads: 4,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            globalErrorRateThreshold: 0.1,
            globalErrorCountThreshold: 100,
            perEndpointThresholds: [],
            workerExitStatusCodes: [],
            monitoringWindowMs: 1000,
            stopMode: 'endpoint',
          },
        },
      };

      const results = await runLoadTest(config);

      expect(results.global.actualRps).toBeGreaterThanOrEqual(90);
      expect(results.global.actualRps).toBeLessThanOrEqual(110);
    });

    it('should handle low RPS values', async () => {
      const config: SafeTressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          {
            url: `${baseUrl}/success`,
            method: 'GET',
            rps: 5,
            payload: null,
            headers: null,
          },
        ],
        options: {
          durationSec: 10,
          rampUpTimeSec: 0,
          silent: true,
          headers: null,
          exportPath: null,
          threads: 4,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            globalErrorRateThreshold: 0.1,
            globalErrorCountThreshold: 100,
            perEndpointThresholds: [],
            workerExitStatusCodes: [],
            monitoringWindowMs: 1000,
            stopMode: 'endpoint',
          },
        },
      };

      const results = await runLoadTest(config);

      // Should achieve close to 5 RPS total
      expect(results.global.actualRps).toBeGreaterThanOrEqual(4.5);
      expect(results.global.actualRps).toBeLessThanOrEqual(5.5);
    });
  });

  describe('Accuracy validation', () => {
    it('should maintain reasonable accuracy for single endpoint', async () => {
      const targetRps = 75;

      const config: SafeTressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [],
        options: {
          durationSec: 5,
          rampUpTimeSec: 0,
          silent: true,
          headers: null,
          exportPath: null,
          threads: 4,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            globalErrorRateThreshold: 0.1,
            globalErrorCountThreshold: 100,
            perEndpointThresholds: [],
            workerExitStatusCodes: [],
            monitoringWindowMs: 1000,
            stopMode: 'endpoint',
          },
        },
      };

      const results = await runLoadTest(config);

      const tolerance = targetRps * 0.1; // 10% tolerance for real-world conditions
      expect(results.global.actualRps).toBeGreaterThanOrEqual(
        targetRps - tolerance,
      );
      expect(results.global.actualRps).toBeLessThanOrEqual(
        targetRps + tolerance,
      );
    });

    it('should maintain reasonable accuracy for multiple endpoints', async () => {
      const expectedTotal = 30 + 20 + 10; // 60 RPS

      const config: SafeTressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [],
        options: {
          durationSec: 5,
          rampUpTimeSec: 0,
          silent: true,
          headers: null,
          exportPath: null,
          threads: 4,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            globalErrorRateThreshold: 0.1,
            globalErrorCountThreshold: 100,
            perEndpointThresholds: [],
            workerExitStatusCodes: [],
            monitoringWindowMs: 1000,
            stopMode: 'endpoint',
          },
        },
      };

      const results = await runLoadTest(config);

      const tolerance = expectedTotal * 0.15; // 15% tolerance for real-world conditions
      expect(results.global.actualRps).toBeGreaterThanOrEqual(
        expectedTotal - tolerance,
      );
      expect(results.global.actualRps).toBeLessThanOrEqual(
        expectedTotal + tolerance,
      );
    });
  });
});
