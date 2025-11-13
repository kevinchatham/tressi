import { MockAgent, setGlobalDispatcher } from 'undici';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { CoreRunner } from '../../src/core/core-runner';
import type { TressiConfig } from '../../src/types';
import { ConfigValidator } from '../../src/validation/config-validator';

let mockAgent: MockAgent;

beforeAll(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect(); // prevent actual network requests
  setGlobalDispatcher(mockAgent);
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(() => {
  mockAgent.close();
});

const createTestConfig = (overrides?: Partial<TressiConfig>): TressiConfig => ({
  $schema: 'https://example.com/schema.json',
  requests: [{ url: 'http://localhost:8080/test', method: 'GET', rps: 10 }],
  options: {
    durationSec: 10,
    rampUpTimeSec: 0,
    useUI: true,
    silent: false,
    earlyExitOnError: false,
    workerMemoryLimit: 128,
    workerEarlyExit: {
      enabled: false,
      monitoringWindowMs: 1000,
      stopMode: 'endpoint',
    },
    ...overrides?.options,
  },
  ...overrides,
});

/**
 * Test suite for the early exit feature in the CoreRunner class.
 */
describe('Early Exit Feature', () => {
  describe('Configuration Validation', () => {
    it('should throw error when error rate threshold is out of range', () => {
      const config = createTestConfig({
        options: {
          earlyExitOnError: true,
          errorRateThreshold: 1.5, // Invalid: > 1.0
          durationSec: 1,
          rampUpTimeSec: 0,
          useUI: true,
          silent: false,
        },
      });

      expect(() => {
        ConfigValidator.validateForProgrammatic(config);
      }).toThrow();
    });

    it('should throw error when error rate threshold is negative', () => {
      const config = createTestConfig({
        options: {
          earlyExitOnError: true,
          errorRateThreshold: -0.1, // Invalid: < 0.0
          durationSec: 1,
          rampUpTimeSec: 0,
          useUI: true,
          silent: false,
        },
      });

      expect(() => {
        ConfigValidator.validateForProgrammatic(config);
      }).toThrow();
    });

    it('should throw error when error count threshold is negative', () => {
      const config = createTestConfig({
        options: {
          earlyExitOnError: true,
          errorCountThreshold: -5, // Invalid: negative
          durationSec: 1,
          rampUpTimeSec: 0,
          useUI: true,
          silent: false,
        },
      });

      expect(() => {
        ConfigValidator.validateForProgrammatic(config);
      }).toThrow();
    });

    it('should throw error when error count threshold is not an integer', () => {
      const config = createTestConfig({
        options: {
          earlyExitOnError: true,
          errorCountThreshold: 3.5, // Invalid: not integer
          durationSec: 1,
          rampUpTimeSec: 0,
          useUI: true,
          silent: false,
        },
      });

      expect(() => {
        ConfigValidator.validateForProgrammatic(config);
      }).toThrow();
    });

    it('should throw error when error status codes contain invalid values', () => {
      const config = createTestConfig({
        options: {
          earlyExitOnError: true,
          errorStatusCodes: [-1, 0, 3.5], // Invalid: negative and non-integer
          durationSec: 1,
          rampUpTimeSec: 0,
          useUI: true,
          silent: false,
        },
      });

      expect(() => {
        ConfigValidator.validateForProgrammatic(config);
      }).toThrow();
    });

    it('should throw error when no thresholds are provided with early exit enabled', () => {
      const config = createTestConfig({
        options: {
          earlyExitOnError: true,
          durationSec: 1,
          rampUpTimeSec: 0,
          useUI: true,
          silent: false,
          // No thresholds provided
        },
      });

      expect(() => {
        ConfigValidator.validateForProgrammatic(config);
      }).toThrow();
    });

    it('should accept valid configuration with all thresholds', () => {
      const config = createTestConfig({
        options: {
          earlyExitOnError: true,
          errorRateThreshold: 0.5,
          errorCountThreshold: 10,
          errorStatusCodes: [500, 503],
          durationSec: 1,
          rampUpTimeSec: 0,
          useUI: true,
          silent: false,
        },
      });

      expect(() => {
        ConfigValidator.validateForProgrammatic(config);
      }).not.toThrow();
    });
  });

  describe('Basic Early Exit Functionality', () => {
    it('should exit early when error rate threshold is exceeded', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');

      // Create persistent interceptors
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(500).persist();

      const config = createTestConfig({
        options: {
          earlyExitOnError: true,
          errorRateThreshold: 0.1, // Very low threshold
          durationSec: 5,
          rampUpTimeSec: 0,
          useUI: true,
          silent: false,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            monitoringWindowMs: 1000,
            stopMode: 'endpoint',
          },
        },
      });

      const runner = new CoreRunner(config);

      await runner.run();

      const results = runner.getResults();

      // Verify early exit by checking we have fewer results than expected for full duration
      // With 10 RPS for 5 seconds, we'd expect ~50 requests, but should exit much earlier
      expect(results.global.totalRequests).toBeLessThan(30);
    });

    it('should exit early when error count threshold is reached', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');

      // Create persistent interceptors
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(500).persist();

      const config = createTestConfig({
        options: {
          earlyExitOnError: true,
          errorCountThreshold: 1, // Exit after 1 error
          durationSec: 5,
          rampUpTimeSec: 0,
          useUI: true,
          silent: false,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            monitoringWindowMs: 1000,
            stopMode: 'endpoint',
          },
        },
      });

      const runner = new CoreRunner(config);

      await runner.run();

      const results = runner.getResults();

      // Verify early exit by checking we have significantly fewer results than expected
      // With 10 RPS for 5 seconds, we'd expect ~50 requests, but should exit much earlier
      expect(results.global.totalRequests).toBeLessThan(25);
    });

    it('should handle specific status code early exit configuration', async () => {
      // Create a fresh mock agent for this test to avoid interference
      const testMockAgent = new MockAgent();
      testMockAgent.disableNetConnect();
      setGlobalDispatcher(testMockAgent);

      const mockPool = testMockAgent.get('http://localhost:8080');

      // Create interceptors - all requests return 503
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(503).times(20);

      const config = createTestConfig({
        options: {
          earlyExitOnError: true,
          errorStatusCodes: [503],
          durationSec: 2, // Shorter duration for this test
          rampUpTimeSec: 0,
          useUI: true,
          silent: false,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            monitoringWindowMs: 1000,
            stopMode: 'endpoint',
          },
        },
      });

      const runner = new CoreRunner(config);

      try {
        // Should complete without throwing errors
        await expect(runner.run()).resolves.toBeUndefined();

        // Should have made some requests
        const results = runner.getResults();
        expect(results.global.totalRequests).toBeGreaterThan(0);

        // Should have 503 status codes
        const status503Results = results.endpoints.filter(
          (e) => e.failedRequests > 0,
        );
        expect(status503Results.length).toBeGreaterThan(0);
      } finally {
        // Clean up the test-specific mock agent
        testMockAgent.close();
        // Restore the original mock agent
        setGlobalDispatcher(mockAgent);
      }
    }, 10000); // Increase timeout to 10 seconds
  });

  describe('Edge Cases', () => {
    it('should not exit early when early exit is disabled', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');

      // All requests fail
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(500).persist();

      const config = createTestConfig({
        options: {
          earlyExitOnError: false, // Disabled
          errorRateThreshold: 0.1, // Would trigger if enabled
          durationSec: 2, // Short duration
          rampUpTimeSec: 0,
          useUI: true,
          silent: false,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            monitoringWindowMs: 1000,
            stopMode: 'endpoint',
          },
        },
      });

      const runner = new CoreRunner(config);
      const startTime = Date.now();

      await runner.run();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should run for approximately the full duration
      expect(duration).toBeGreaterThan(1000);
    }, 15000); // Increase timeout to 15 seconds to prevent test framework timeout

    it('should handle zero threshold values correctly', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');

      // All requests succeed
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(200).persist();

      const config = createTestConfig({
        options: {
          earlyExitOnError: true,
          errorRateThreshold: 0.0, // Zero threshold
          durationSec: 1,
          rampUpTimeSec: 0,
          useUI: true,
          silent: false,
          workerMemoryLimit: 128,
          workerEarlyExit: {
            enabled: false,
            monitoringWindowMs: 1000,
            stopMode: 'endpoint',
          },
        },
      });

      const runner = new CoreRunner(config);

      await runner.run();

      // Should complete successfully
      const results = runner.getResults();
      expect(results.global.totalRequests).toBeGreaterThan(0);
    });
  });
});
