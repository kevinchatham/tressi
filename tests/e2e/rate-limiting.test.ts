import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runLoadTest } from '../../src/index';
import type { TressiConfig } from '../../src/types';
import { ServerManager } from '../utils/server-manager';

describe('Rate Limiting E2E Tests with server.ts', () => {
  let serverManager: ServerManager;
  let baseUrl: string;

  beforeAll(async () => {
    serverManager = new ServerManager();
    baseUrl = await serverManager.start();
  });

  afterAll(async () => {
    await serverManager.stop();
  });

  describe('Per-endpoint RPS validation', () => {
    it('should enforce rate limits across server.ts endpoints', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [],
        options: {
          durationSec: 30,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
        },
      };

      const results = await runLoadTest(config);

      // Expected total RPS: 10 + 5 + 8 = 23
      expect(results.global.actualRps).toBeGreaterThanOrEqual(22);
      expect(results.global.actualRps).toBeLessThanOrEqual(24);
    });

    it('should handle zero RPS configuration gracefully', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [],
        options: {
          durationSec: 10,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
        },
      };

      const results = await runLoadTest(config);

      // Should only make requests to the endpoint with RPS > 0
      const successEndpoint = results.endpoints.find((e) =>
        e.url.endsWith('/success'),
      );
      const delayEndpoint = results.endpoints.find((e) =>
        e.url.endsWith('/delay/100'),
      );

      expect(successEndpoint?.successfulRequests).toBe(0);
      expect(delayEndpoint?.successfulRequests).toBeGreaterThan(0);
    });

    it('should handle very high RPS configuration', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        options: {
          durationSec: 5,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
        },
      };

      const results = await runLoadTest(config);

      // Should achieve close to 100 RPS
      expect(results.global.actualRps).toBeGreaterThanOrEqual(95);
      expect(results.global.actualRps).toBeLessThanOrEqual(105);
    });
  });

  describe('Mixed global/per-endpoint configurations', () => {
    it('should use global RPS when per-endpoint not specified', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [
          { url: `${baseUrl}/success`, method: 'GET' },
          { url: `${baseUrl}/delay/100`, method: 'GET' },
        ],
        options: {
          durationSec: 10,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
        },
      };

      const results = await runLoadTest(config);

      // Should distribute 15 RPS across both endpoints
      expect(results.global.actualRps).toBeGreaterThanOrEqual(14);
      expect(results.global.actualRps).toBeLessThanOrEqual(16);
    });

    it('should prioritize per-endpoint RPS over global', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [{ url: `${baseUrl}/delay/100`, method: 'GET' }],
        options: {
          durationSec: 10,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
        },
      };

      const results = await runLoadTest(config);

      // Expected: 20 + 5 (global for middle endpoint) + 10 = 35
      expect(results.global.actualRps).toBeGreaterThanOrEqual(33);
      expect(results.global.actualRps).toBeLessThanOrEqual(37);
    });
  });

  describe('Rate limiting accuracy', () => {
    it('should maintain ±1% tolerance for single endpoint', async () => {
      const targetRps = 50;

      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [],
        options: {
          durationSec: 10,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
        },
      };

      const results = await runLoadTest(config);

      // Should maintain accuracy within 1%
      const tolerance = targetRps * 0.01;
      expect(results.global.actualRps).toBeGreaterThanOrEqual(
        targetRps - tolerance,
      );
      expect(results.global.actualRps).toBeLessThanOrEqual(
        targetRps + tolerance,
      );
    });

    it('should maintain ±2% tolerance for multiple endpoints', async () => {
      const expectedTotal = 25 + 15 + 10; // 50 RPS

      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [],
        options: {
          durationSec: 15,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
        },
      };

      const results = await runLoadTest(config);

      // Should maintain accuracy within 2%
      const tolerance = expectedTotal * 0.02;
      expect(results.global.actualRps).toBeGreaterThanOrEqual(
        expectedTotal - tolerance,
      );
      expect(results.global.actualRps).toBeLessThanOrEqual(
        expectedTotal + tolerance,
      );
    });
  });

  describe('Error handling with real HTTP scenarios', () => {
    it('should handle 429 responses gracefully', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [],
        options: {
          durationSec: 10,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
        },
      };

      const results = await runLoadTest(config);

      // Should still achieve target RPS despite 429s
      expect(results.global.actualRps).toBeGreaterThanOrEqual(14);
      expect(results.global.actualRps).toBeLessThanOrEqual(16);

      // Should have some 429 responses
      const rateLimitedEndpoint = results.endpoints.find((e) =>
        e.url.endsWith('/status/429'),
      );
      expect(rateLimitedEndpoint?.failedRequests).toBeGreaterThan(0);
    });

    it('should handle timeout scenarios', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [],
        options: {
          durationSec: 8,
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
        },
      };

      const results = await runLoadTest(config);

      // Should still achieve close to target RPS for successful endpoints
      expect(results.global.actualRps).toBeGreaterThanOrEqual(7);

      // Should have timeout errors
      const timeoutEndpoint = results.endpoints.find((e) =>
        e.url.endsWith('/timeout'),
      );
      expect(timeoutEndpoint?.failedRequests).toBeGreaterThan(0);
    });
  });

  describe('Long-running stability', () => {
    it('should maintain rate limiting accuracy over extended periods', async () => {
      const config: TressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        requests: [],
        options: {
          durationSec: 30, // Reduced for faster tests
          rampUpTimeSec: 0,
          useUI: false,
          silent: true,
          earlyExitOnError: false,
        },
      };

      const results = await runLoadTest(config);

      // Should maintain accuracy over long duration
      expect(results.global.actualRps).toBeGreaterThanOrEqual(58);
      expect(results.global.actualRps).toBeLessThanOrEqual(62);

      // Should have made a significant number of requests
      expect(results.global.totalRequests).toBeGreaterThan(1000);
    });
  });
});
