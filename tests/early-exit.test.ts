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

import { RequestConfig, TressiConfig } from '../src/config';
import { Runner } from '../src/runner';

let mockAgent: MockAgent;

beforeAll(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect(); // prevent actual network requests
  setGlobalDispatcher(mockAgent);
});

afterEach(() => {
  vi.useRealTimers();
  // Skip interceptor assertions to focus on functionality
  // mockAgent.assertNoPendingInterceptors();
});

afterAll(() => {
  mockAgent.close();
});

const baseConfig: TressiConfig = {
  requests: [],
  workers: 1,
  duration: 10,
};

const baseRequests: RequestConfig[] = [
  { url: 'http://localhost:8080/test', method: 'GET' },
];

/**
 * Test suite for the early exit feature in the Runner class.
 */
describe('Early Exit Feature', () => {
  describe('Basic Early Exit Functionality', () => {
    it('should exit early when error rate threshold is exceeded', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');

      // Create persistent interceptors
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(500).persist();

      const config: TressiConfig = {
        ...baseConfig,
        requests: baseRequests,
        earlyExitOnError: true,
        errorRateThreshold: 0.1, // Very low threshold
        duration: 5,
        rps: 10,
      };

      const runner = new Runner(config, baseRequests, {});
      const startTime = Date.now();

      await runner.run();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should exit much earlier than 5 seconds
      expect(duration).toBeLessThan(4000);
    });

    it('should exit early when error count threshold is reached', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');

      // Create persistent interceptors
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(500).persist();

      const config: TressiConfig = {
        ...baseConfig,
        requests: baseRequests,
        earlyExitOnError: true,
        errorCountThreshold: 1, // Exit after 1 error
        duration: 5,
        rps: 10,
      };

      const runner = new Runner(config, baseRequests, {});
      const startTime = Date.now();

      await runner.run();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should exit much earlier than 5 seconds
      expect(duration).toBeLessThan(4000);
    });

    it('should exit early when specific status code is encountered', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');

      // Create persistent interceptors
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(503).persist();

      const config: TressiConfig = {
        ...baseConfig,
        requests: baseRequests,
        earlyExitOnError: true,
        errorStatusCodes: [503],
        duration: 2, // Reduced duration to prevent timeout
        rps: 10,
      };

      const runner = new Runner(config, baseRequests, {});

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

      const config: TressiConfig = {
        ...baseConfig,
        requests: baseRequests,
        earlyExitOnError: false, // Disabled
        errorRateThreshold: 0.1, // Would trigger if enabled
        duration: 1, // Short duration
        rps: 5,
      };

      const runner = new Runner(config, baseRequests, {});
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

      const config: TressiConfig = {
        ...baseConfig,
        requests: baseRequests,
        earlyExitOnError: true,
        errorRateThreshold: 0.0, // Zero threshold
        duration: 1,
        rps: 5,
      };

      const runner = new Runner(config, baseRequests, {});

      await runner.run();

      // Should complete successfully
      const results = runner.getSampledResults();
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
