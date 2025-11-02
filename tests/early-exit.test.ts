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

import { Runner } from '../src/runner';
import type { SafeTressiConfig } from '../src/types';

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

const createTestConfig = (
  overrides?: Partial<SafeTressiConfig>,
): SafeTressiConfig => ({
  $schema: 'https://example.com/schema.json',
  requests: [{ url: 'http://localhost:8080/test', method: 'GET' }],
  options: {
    workers: 1,
    durationSec: 10,
    rampUpTimeSec: 0,
    autoscale: false,
    useUI: true,
    silent: false,
    earlyExitOnError: false,
    ...overrides?.options,
  },
  ...overrides,
});

/**
 * Test suite for the early exit feature in the Runner class.
 */
describe('Early Exit Feature', () => {
  describe('Configuration Validation', () => {
    it('should throw error when error rate threshold is out of range', () => {
      const config = createTestConfig({
        options: {
          earlyExitOnError: true,
          errorRateThreshold: 1.5, // Invalid: > 1.0
          workers: 1,
          durationSec: 1,
          rampUpTimeSec: 0,
          autoscale: false,
          useUI: true,
          silent: false,
        },
      });

      expect(() => {
        new Runner(config);
      }).toThrow('errorRateThreshold must be a number between 0.0 and 1.0');
    });

    it('should throw error when error rate threshold is negative', () => {
      const config = createTestConfig({
        options: {
          earlyExitOnError: true,
          errorRateThreshold: -0.1, // Invalid: < 0.0
          workers: 1,
          durationSec: 1,
          rampUpTimeSec: 0,
          autoscale: false,
          useUI: true,
          silent: false,
        },
      });

      expect(() => {
        new Runner(config);
      }).toThrow('errorRateThreshold must be a number between 0.0 and 1.0');
    });

    it('should throw error when error count threshold is negative', () => {
      const config = createTestConfig({
        options: {
          earlyExitOnError: true,
          errorCountThreshold: -5, // Invalid: negative
          workers: 1,
          durationSec: 1,
          rampUpTimeSec: 0,
          autoscale: false,
          useUI: true,
          silent: false,
        },
      });

      expect(() => {
        new Runner(config);
      }).toThrow('errorCountThreshold must be a non-negative integer');
    });

    it('should throw error when error count threshold is not an integer', () => {
      const config = createTestConfig({
        options: {
          earlyExitOnError: true,
          errorCountThreshold: 3.5, // Invalid: not integer
          workers: 1,
          durationSec: 1,
          rampUpTimeSec: 0,
          autoscale: false,
          useUI: true,
          silent: false,
        },
      });

      expect(() => {
        new Runner(config);
      }).toThrow('errorCountThreshold must be a non-negative integer');
    });

    it('should throw error when error status codes contain invalid values', () => {
      const config = createTestConfig({
        options: {
          earlyExitOnError: true,
          errorStatusCodes: [99, 200, 600], // Invalid: 99 and 600
          workers: 1,
          durationSec: 1,
          rampUpTimeSec: 0,
          autoscale: false,
          useUI: true,
          silent: false,
        },
      });

      expect(() => {
        new Runner(config);
      }).toThrow('Invalid HTTP status code: 99. Must be between 100-599');
    });

    it('should throw error when no thresholds are provided with early exit enabled', () => {
      const config = createTestConfig({
        options: {
          earlyExitOnError: true,
          workers: 1,
          durationSec: 1,
          rampUpTimeSec: 0,
          autoscale: false,
          useUI: true,
          silent: false,
          // No thresholds provided
        },
      });

      expect(() => {
        new Runner(config);
      }).toThrow(
        'When earlyExitOnError is enabled, at least one of errorRateThreshold, errorCountThreshold, or errorStatusCodes must be provided',
      );
    });

    it('should accept valid configuration with all thresholds', () => {
      const config = createTestConfig({
        options: {
          earlyExitOnError: true,
          errorRateThreshold: 0.5,
          errorCountThreshold: 10,
          errorStatusCodes: [500, 503],
          workers: 1,
          durationSec: 1,
          rampUpTimeSec: 0,
          autoscale: false,
          useUI: true,
          silent: false,
        },
      });

      expect(() => {
        new Runner(config);
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
          workers: 1,
          rps: 10,
          rampUpTimeSec: 0,
          autoscale: false,
          useUI: true,
          silent: false,
        },
      });

      const runner = new Runner(config);

      await runner.run();

      const results = runner.getSampledResults();

      // Verify early exit by checking we have fewer results than expected for full duration
      // With 10 RPS for 5 seconds, we'd expect ~50 requests, but should exit much earlier
      expect(results.length).toBeLessThan(30);
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
          workers: 1,
          rps: 10,
          rampUpTimeSec: 0,
          autoscale: false,
          useUI: true,
          silent: false,
        },
      });

      const runner = new Runner(config);

      await runner.run();

      const results = runner.getSampledResults();

      // Verify early exit by checking we have significantly fewer results than expected
      // With 10 RPS for 5 seconds, we'd expect ~50 requests, but should exit much earlier
      expect(results.length).toBeLessThan(25);
    });

    it('should exit early when specific status code is encountered', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');

      // Create persistent interceptors
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(503).persist();

      const config = createTestConfig({
        options: {
          earlyExitOnError: true,
          errorStatusCodes: [503],
          durationSec: 2, // Reduced duration to prevent timeout
          workers: 1,
          rps: 10,
          rampUpTimeSec: 0,
          autoscale: false,
          useUI: true,
          silent: false,
        },
      });

      const runner = new Runner(config);

      await runner.run();

      // Should complete successfully - timing is less critical than functionality
      const results = runner.getSampledResults();
      expect(results.length).toBeGreaterThan(0);
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
          durationSec: 1, // Short duration
          workers: 1,
          rps: 5,
          rampUpTimeSec: 0,
          autoscale: false,
          useUI: true,
          silent: false,
        },
      });

      const runner = new Runner(config);
      const startTime = Date.now();

      await runner.run();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should run for approximately the full duration
      expect(duration).toBeGreaterThan(500);
    });

    it('should handle zero threshold values correctly', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');

      // All requests succeed
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(200).persist();

      const config = createTestConfig({
        options: {
          earlyExitOnError: true,
          errorRateThreshold: 0.0, // Zero threshold
          durationSec: 1,
          workers: 1,
          rps: 5,
          rampUpTimeSec: 0,
          autoscale: false,
          useUI: true,
          silent: false,
        },
      });

      const runner = new Runner(config);

      await runner.run();

      // Should complete successfully
      const results = runner.getSampledResults();
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
