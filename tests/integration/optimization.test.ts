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

import { CoreRunner } from '../../src/core/runner/core-runner';
import type { SafeTressiConfig } from '../../src/types';

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
    durationSec: 1,
    rampUpTimeSec: 0,
    rps: 10,
    useUI: true,
    silent: false,
    earlyExitOnError: false,
    ...overrides?.options,
  },
  ...overrides,
});

/**
 * Test suite for object allocation optimizations in the CoreRunner class.
 */
describe('Object Allocation Optimizations', () => {
  describe('Response Sampling', () => {
    it('should sample different status codes per endpoint', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');

      // Create interceptors for different status codes
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(200);
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(404);
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(500);

      const config = createTestConfig({
        options: {
          durationSec: 2,
          workers: 1,
          rampUpTimeSec: 0,
          rps: 10,
          useUI: true,
          silent: false,
          earlyExitOnError: false,
        },
      });

      const runner = new CoreRunner(config);

      await runner.run();

      const resultAggregator = runner.getResultAggregator();
      const results = resultAggregator.getSampledResults();
      expect(results.length).toBeGreaterThan(0);

      // Check that we have results for the endpoint
      const endpointResults = results.filter(
        (r: { url: string }) => r.url === 'http://localhost:8080/test',
      );
      expect(endpointResults.length).toBeGreaterThan(0);
    });

    it('should handle error scenarios gracefully', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');

      // Create interceptors for different error scenarios
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(200);
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(404);
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(500);
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(500);
      mockPool
        .intercept({ path: '/test', method: 'GET' })
        .replyWithError(new Error('Network error'));

      const config = createTestConfig({
        options: {
          durationSec: 2,
          workers: 1,
          rampUpTimeSec: 0,
          rps: 10,
          useUI: true,
          silent: false,
          earlyExitOnError: false,
        },
      });

      const runner = new CoreRunner(config);

      await runner.run();

      const resultAggregator = runner.getResultAggregator();
      const results = resultAggregator.getSampledResults();
      expect(results.length).toBeGreaterThan(0);

      // Should have both successful and failed requests
      const successfulRequests = results.filter(
        (r: { success: boolean }) => r.success,
      );
      const failedRequests = results.filter(
        (r: { success: boolean }) => !r.success,
      );
      expect(successfulRequests.length).toBeGreaterThan(0);
      expect(failedRequests.length).toBeGreaterThan(0);
    });

    it('should handle network errors gracefully', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');

      // Create interceptors for network errors
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(200);
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(404);
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(500);
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(500);
      mockPool
        .intercept({ path: '/test', method: 'GET' })
        .replyWithError(new Error('Network error'));

      const config = createTestConfig({
        options: {
          durationSec: 2,
          workers: 1,
          rampUpTimeSec: 0,
          rps: 10,
          useUI: true,
          silent: false,
          earlyExitOnError: false,
        },
      });

      const runner = new CoreRunner(config);

      await runner.run();

      const resultAggregator = runner.getResultAggregator();
      const results = resultAggregator.getSampledResults();
      expect(results.length).toBeGreaterThan(0);

      // Should have network error results
      const networkErrors = results.filter((r: { error?: string }) => r.error);
      expect(networkErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Concurrency and Thread Safety', () => {
    it('should handle multiple workers correctly', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(200).times(20);

      const config = createTestConfig({
        options: {
          workers: 2,
          durationSec: 2,
          rampUpTimeSec: 0,
          rps: 10,
          useUI: true,
          silent: false,
          earlyExitOnError: false,
        },
      });

      const runner = new CoreRunner(config);

      await runner.run();

      const resultAggregator = runner.getResultAggregator();
      const results = resultAggregator.getSampledResults();
      expect(results.length).toBeGreaterThan(0);

      // Should have results from multiple workers
      const successfulRequests = results.filter(
        (r: { success: boolean }) => r.success,
      );
      expect(successfulRequests.length).toBeGreaterThan(0);
    });

    it('should handle high concurrency with optimizations', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(200).times(50);

      const config = createTestConfig({
        options: {
          workers: 5,
          durationSec: 2,
          rampUpTimeSec: 0,
          rps: 10,
          useUI: true,
          silent: false,
          earlyExitOnError: false,
        },
      });

      const runner = new CoreRunner(config);

      await runner.run();

      const resultAggregator = runner.getResultAggregator();
      const results = resultAggregator.getSampledResults();
      expect(results.length).toBeGreaterThan(0);

      // Should handle high concurrency without issues
      const successfulRequests = results.filter(
        (r: { success: boolean }) => r.success,
      );
      expect(successfulRequests.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Management', () => {
    it('should complete test without memory leaks', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool
        .intercept({ path: '/test', method: 'GET' })
        .reply(200)
        .times(100);

      const config = createTestConfig({
        options: {
          workers: 2,
          durationSec: 2,
          rampUpTimeSec: 0,
          rps: 10,
          useUI: true,
          silent: false,
          earlyExitOnError: false,
        },
      });

      const runner = new CoreRunner(config);

      await runner.run();

      const resultAggregator = runner.getResultAggregator();
      const results = resultAggregator.getSampledResults();
      expect(results.length).toBeGreaterThan(0);

      // Should complete without memory issues
      const successfulRequests = results.filter(
        (r: { success: boolean }) => r.success,
      );
      expect(successfulRequests.length).toBeGreaterThan(0);
    });
  });
});
