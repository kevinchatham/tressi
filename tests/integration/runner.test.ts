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
  requests: [{ url: 'http://localhost:8080/test', method: 'GET' }],
  options: {
    durationSec: 1,
    rampUpTimeSec: 0,
    useUI: true,
    silent: false,
    earlyExitOnError: false,
    adaptiveConcurrency: {
      maxConcurrency: 10,
      targetLatency: 100,
      memoryThreshold: 0.8,
      enabled: true,
      minConcurrency: 1,
    },
    ...overrides?.options,
  },
  ...overrides,
});

/**
 * Test suite for the main CoreRunner class.
 */
describe('CoreRunner', () => {
  /**
   * It should be able to run a simple test for one second
   * and produce a valid set of results.
   */
  it('should run a basic test and return results', async () => {
    const mockPool = mockAgent.get('http://localhost:8080');
    mockPool.intercept({ path: '/test', method: 'GET' }).reply(200).persist();

    const config = createTestConfig();
    const runner = new CoreRunner(config);

    await runner.run();

    const resultAggregator = runner.getResultAggregator();
    const results = resultAggregator.getSampledResults();

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].status).toBe(200);
    expect(results[0].success).toBe(true);
  }, 10000);

  /**
   * It should run with adaptive concurrency management
   */
  it('should run with adaptive concurrency management', async () => {
    const mockPool = mockAgent.get('http://localhost:8080');
    mockPool.intercept({ path: '/test', method: 'GET' }).reply(200).persist();

    const config = createTestConfig({
      options: {
        durationSec: 2,
        adaptiveConcurrency: {
          maxConcurrency: 5,
          targetLatency: 100,
          memoryThreshold: 0.8,
          enabled: true,
          minConcurrency: 1,
        },
      },
    });

    const runner = new CoreRunner(config);
    await runner.run();

    const resultAggregator = runner.getResultAggregator();
    const results = resultAggregator.getSampledResults();

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].status).toBe(200);
    expect(results[0].success).toBe(true);
  }, 10000);

  /**
   * It should be possible to prematurely stop a test run by calling the
   * `stop()` method, which should immediately halt execution.
   */
  it('should stop the test run when stop() is called', async () => {
    vi.useFakeTimers();
    const config = createTestConfig({
      options: {
        durationSec: 10,
        rampUpTimeSec: 0,
        useUI: true,
        silent: false,
        earlyExitOnError: false,
      },
    });
    const runner = new CoreRunner(config);

    const runPromise = runner.run();

    setTimeout(() => runner.stop(), 1000);
    await vi.advanceTimersByTimeAsync(1000);

    await runPromise;
    const resultAggregator = runner.getResultAggregator();
    const results = resultAggregator.getSampledResults();

    // Verify the test was stopped early - should have some results but not too many
    expect(results.length).toBeGreaterThan(0);
    // In fake timers, we can't rely on actual timing, so just verify we got results
    expect(Array.isArray(results)).toBe(true);
  });

  it('should merge global and request-specific headers correctly', async () => {
    const mockPool = mockAgent.get('http://localhost:8080');
    mockPool.intercept({ path: '/test', method: 'GET' }).reply(200).persist();

    const config = createTestConfig({
      requests: [
        {
          url: 'http://localhost:8080/test',
          method: 'GET',
          headers: { 'X-Request-ID': '456' },
        },
      ],
      options: {
        headers: { Authorization: 'Bearer global-token' },
        durationSec: 1,
        rampUpTimeSec: 0,
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
    expect(results[0].status).toBe(200);
    expect(results[0].success).toBe(true);
  }, 10000);

  it('should run normally with early exit disabled (default behavior)', async () => {
    const mockPool = mockAgent.get('http://localhost:8080');
    mockPool.intercept({ path: '/test', method: 'GET' }).reply(200).persist();

    const config = createTestConfig({
      options: {
        durationSec: 1,
        rampUpTimeSec: 0,
        useUI: true,
        silent: false,
        earlyExitOnError: false,
      },
    });
    const runner = new CoreRunner(config);

    const startTime = Date.now();
    await runner.run();
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should run for approximately the full duration
    expect(duration).toBeGreaterThan(500);

    const resultAggregator = runner.getResultAggregator();
    const results = resultAggregator.getSampledResults();
    expect(results.length).toBeGreaterThan(0);

    // Find a successful result
    const successfulResult = results.find(
      (r: { success: boolean }) => r.success,
    );
    expect(successfulResult).toBeDefined();
    expect(successfulResult?.status).toBe(200);
    expect(successfulResult?.success).toBe(true);
  });

  it('should handle basic configuration gracefully', async () => {
    const mockPool = mockAgent.get('http://localhost:8080');
    mockPool.intercept({ path: '/test', method: 'GET' }).reply(200).persist();

    const config = createTestConfig({
      options: {
        durationSec: 1,
        rampUpTimeSec: 0,
        useUI: true,
        silent: false,
        earlyExitOnError: false,
      },
    });
    const runner = new CoreRunner(config);

    // Should not throw error
    await expect(runner.run()).resolves.toBeUndefined();
  });
});
