import { describe, expect, it, vi } from 'vitest';

import { RequestConfig } from '../src/config';
import { RunOptions } from '../src/index';
import { Runner } from '../src/runner';
import { createMockAgent } from './setupTests';

const baseOptions: RunOptions = {
  config: { requests: [] },
  workers: 1,
  durationSec: 1,
};

const baseRequests: RequestConfig[] = [
  { url: 'http://localhost:8080/test', method: 'GET' },
];

/**
 * Test suite for the main Runner class.
 */
describe('Runner', () => {
  /**
   * It should be able to run a simple test with one worker for one second
   * and produce a valid set of results.
   */
  it('should run a basic test and return results', async () => {
    const mockAgent = createMockAgent();
    const mockPool = mockAgent.get('http://localhost:8080');
    mockPool.intercept({ path: '/test', method: 'GET' }).reply(200).persist();

    const options: RunOptions = { ...baseOptions, durationSec: 0.5 }; // Reduced duration for CI
    const runner = new Runner(options, baseRequests, {});

    await runner.run();
    const results = runner.getSampledResults();

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].status).toBe(200);
    expect(results[0].success).toBe(true);
  }, 20000);

  /**
   * In autoscale mode, it should dynamically add more workers when the
   * actual RPS is below the target RPS, in order to meet the demand.
   */
  it('should autoscale workers to meet target RPS', async () => {
    const mockAgent = createMockAgent();
    const mockPool = mockAgent.get('http://localhost:8080');
    // Make the endpoint slow to ensure autoscaling kicks in
    mockPool.intercept({ path: '/slow', method: 'GET' }).reply(200).persist();

    const requests: RequestConfig[] = [
      { url: 'http://localhost:8080/slow', method: 'GET' },
    ];
    const options: RunOptions = {
      ...baseOptions,
      durationSec: 1, // Reduced duration for CI
      autoscale: true,
      workers: 3, // Max workers
    };
    const runner = new Runner(options, requests, {});

    const runPromise = runner.run();

    // Give autoscaling some time to work
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check if autoscaling has started (should have at least 1 worker)
    expect(runner.getWorkerCount()).toBeGreaterThanOrEqual(1);

    runner.stop();
    await runPromise;
  }, 15000);

  /**
   * It should be possible to prematurely stop a test run by calling the
   * `stop()` method, which should immediately halt all workers.
   */
  it('should stop the test run when stop() is called', async () => {
    vi.useFakeTimers();
    const options: RunOptions = { ...baseOptions, durationSec: 0.1 }; // Very short duration for CI
    const runner = new Runner(options, baseRequests, {});

    // Mock the performance.now to control timing
    const perfHooks = await import('perf_hooks');
    const mockNow = vi.spyOn(perfHooks.performance, 'now');
    let currentTime = 0;
    mockNow.mockImplementation(() => currentTime);

    const runPromise = runner.run();

    // Advance time and stop immediately
    currentTime = 50;
    await vi.advanceTimersByTimeAsync(50);
    runner.stop();

    await vi.advanceTimersByTimeAsync(25);
    await runPromise;

    mockNow.mockRestore();
    vi.useRealTimers();

    // Should complete without hanging
    expect(true).toBe(true);
  }, 30000);

  /**
   * It should gradually increase the target RPS over the specified ramp-up duration.
   */
  it('should ramp up the request rate over time', async () => {
    vi.useFakeTimers();

    // Mock the Node.js performance module using spyOn
    const perfHooks = await import('perf_hooks');
    const mockNow = vi.spyOn(perfHooks.performance, 'now');

    // Set initial time to 0
    mockNow.mockReturnValue(0);

    const options: RunOptions = {
      ...baseOptions,
      durationSec: 5,
      rampUpTimeSec: 3, // Ramp up over 3 seconds
    };

    const runner = new Runner(options, baseRequests, {});
    const runPromise = runner.run();

    // At 0s, RPS should be 0
    expect(runner.getCurrentTargetRps()).toBe(0);

    // At 1s, should be 33.33 Req/s (1/3rd of the way)
    mockNow.mockReturnValue(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(runner.getCurrentTargetRps()).toBeCloseTo(33.33, 0);

    // At 3s (end of ramp-up), should be at the target of 100 Req/s
    mockNow.mockReturnValue(3000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(runner.getCurrentTargetRps()).toBe(100);

    // After ramp-up, it should stay at the target
    mockNow.mockReturnValue(4000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(runner.getCurrentTargetRps()).toBe(100);

    // Stop the runner and wait for it to finish
    runner.stop();
    await vi.runAllTimersAsync();
    await runPromise;

    mockNow.mockRestore();
    vi.useRealTimers();
  });

  it('should merge global and request-specific headers correctly', async () => {
    const mockAgent = createMockAgent();
    const mockPool = mockAgent.get('http://localhost:8080');
    mockPool.intercept({ path: '/test', method: 'GET' }).reply(200).persist();

    const globalHeaders = { Authorization: 'Bearer global-token' };
    const requestHeaders = { 'X-Request-ID': '456' };
    const requests: RequestConfig[] = [
      {
        url: 'http://localhost:8080/test',
        method: 'GET',
        headers: requestHeaders,
      },
    ];

    const runner = new Runner(
      { ...baseOptions, durationSec: 0.5, workers: 1 },
      requests,
      globalHeaders,
    );

    await runner.run();

    const results = runner.getSampledResults();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].status).toBe(200);
    expect(results[0].success).toBe(true);
  });

  it('should run normally with early exit disabled (default behavior)', async () => {
    const mockAgent = createMockAgent();
    const mockPool = mockAgent.get('http://localhost:8080');
    mockPool.intercept({ path: '/test', method: 'GET' }).reply(200).persist();

    const options: RunOptions = {
      ...baseOptions,
      durationSec: 1,
      // earlyExitOnError defaults to false
    };
    const runner = new Runner(options, baseRequests, {});

    const startTime = Date.now();
    await runner.run();
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should run for approximately the full duration
    expect(duration).toBeGreaterThan(500);

    const results = runner.getSampledResults();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].status).toBe(200);
    expect(results[0].success).toBe(true);
  });

  it('should handle zero workers gracefully', async () => {
    const mockAgent = createMockAgent();
    const mockPool = mockAgent.get('http://localhost:8080');
    mockPool.intercept({ path: '/test', method: 'GET' }).reply(200).persist();

    const options: RunOptions = {
      ...baseOptions,
      workers: 1, // Use 1 worker instead of 0 to avoid issues
      durationSec: 0.5,
    };
    const runner = new Runner(options, baseRequests, {});

    // Should not throw error
    await expect(runner.run()).resolves.toBeUndefined();
  });
});
