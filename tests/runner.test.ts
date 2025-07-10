import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { RequestConfig } from '../src/config';
import { RunOptions } from '../src/index';
import { Runner } from '../src/runner';

const server = setupServer(
  http.get('http://localhost:8080/test', () => {
    return new HttpResponse(null, { status: 200 });
  }),
  http.get('http://localhost:8080/slow', async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return new HttpResponse(null, { status: 200 });
  }),
);

beforeAll(() => server.listen());
afterEach(() => {
  vi.useRealTimers();
});
afterAll(() => server.close());

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
    const options: RunOptions = { ...baseOptions };
    const runner = new Runner(options, baseRequests, {});

    await runner.run();
    const results = runner.getSampledResults();

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].status).toBe(200);
    expect(results[0].success).toBe(true);
  }, 10000);

  /**
   * In autoscale mode, it should dynamically add more workers when the
   * actual RPS is below the target RPS, in order to meet the demand.
   */
  it('should autoscale workers to meet target RPS', async () => {
    const requests: RequestConfig[] = [
      { url: 'http://localhost:8080/slow', method: 'GET' },
    ];
    const options: RunOptions = {
      ...baseOptions,
      rps: 50,
      durationSec: 5,
      autoscale: true,
      workers: 10, // Max workers
    };
    const runner = new Runner(options, requests, {});

    const runPromise = runner.run();

    // Poll for the worker count to increase, with a timeout
    await new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (runner.getWorkerCount() > 1) {
          clearInterval(interval);
          resolve(true);
        }
      }, 100); // Check every 100ms

      setTimeout(() => {
        clearInterval(interval);
        reject(new Error('Autoscaler did not increase worker count in time'));
      }, 4000); // Fail after 4s
    });

    runner.stop();
    await runPromise;
  }, 7000);

  /**
   * It should be possible to prematurely stop a test run by calling the
   * `stop()` method, which should immediately halt all workers.
   */
  it('should stop the test run when stop() is called', async () => {
    vi.useFakeTimers();
    const options: RunOptions = { ...baseOptions, durationSec: 10 };
    const runner = new Runner(options, baseRequests, {});

    const runPromise = runner.run();

    setTimeout(() => runner.stop(), 1000);
    await vi.advanceTimersByTimeAsync(1000);

    await runPromise;
    const results = runner.getSampledResults();
    const duration =
      results[results.length - 1].timestamp - results[0].timestamp;

    expect(duration).toBeLessThan(2000);
  });

  /**
   * It should gradually increase the target RPS over the specified ramp-up duration.
   */
  it('should ramp up the request rate over time', async () => {
    vi.useFakeTimers();

    const options: RunOptions = {
      ...baseOptions,
      durationSec: 10,
      rps: 100,
      rampUpTimeSec: 5, // Ramp up to 100 Req/s over 5 seconds
    };
    const runner = new Runner(options, baseRequests, {});

    const runPromise = runner.run();

    // At 0s, RPS should be 0
    expect(runner.getCurrentTargetRps()).toBe(0);

    // At 1s, should be 20 Req/s (1/5th of the way)
    await vi.advanceTimersByTimeAsync(1000);
    expect(runner.getCurrentTargetRps()).toBe(20);

    // At 3s, should be 60 Req/s (3/5th of the way)
    await vi.advanceTimersByTimeAsync(2000);
    expect(runner.getCurrentTargetRps()).toBe(60);

    // At 5s (end of ramp-up), should be at the target of 100 Req/s
    await vi.advanceTimersByTimeAsync(2000);
    expect(runner.getCurrentTargetRps()).toBe(100);

    // After ramp-up, it should stay at the target
    await vi.advanceTimersByTimeAsync(2000);
    expect(runner.getCurrentTargetRps()).toBe(100);

    // Stop the runner and wait for it to finish
    runner.stop();
    await vi.runAllTimersAsync();
    await runPromise;

    vi.useRealTimers();
  });

  it('should merge global and request-specific headers correctly', async () => {
    const globalHeaders = { Authorization: 'Bearer global-token' };
    const requestHeaders = { 'X-Request-ID': '456' };
    const requests: RequestConfig[] = [
      {
        url: 'http://localhost:8080/test',
        method: 'GET',
        headers: requestHeaders,
      },
    ];

    const runner = new Runner(baseOptions, requests, globalHeaders);

    // Mock fetch to inspect headers
    const fetchSpy = vi.spyOn(global, 'fetch');

    await runner.run();

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:8080/test',
      expect.objectContaining({
        headers: {
          ...globalHeaders,
          ...requestHeaders,
        },
      }),
    );

    fetchSpy.mockRestore();
  });

  it('should sample one response body per endpoint and status code', async () => {
    const requests: RequestConfig[] = [
      { url: 'http://localhost:8080/test', method: 'GET' },
      { url: 'http://localhost:8080/test', method: 'POST' },
    ];

    server.use(
      http.get('http://localhost:8080/test', () => {
        return new HttpResponse('GET_OK', { status: 200 });
      }),
      http.post('http://localhost:8080/test', () => {
        return new HttpResponse('POST_OK', { status: 201 });
      }),
    );

    const runner = new Runner({ ...baseOptions, durationSec: 2 }, requests, {});
    await runner.run();
    const results = runner.getSampledResults();

    const getSample = results.find((r) => r.body === 'GET_OK');
    const postSample = results.find((r) => r.body === 'POST_OK');

    // Check that we have exactly one sample for each endpoint
    expect(getSample).toBeDefined();
    expect(postSample).toBeDefined();

    // Check that other requests for the same endpoint didn't get sampled
    const sampledBodies = results.filter((r) => r.body).map((r) => r.body);
    expect(sampledBodies).toHaveLength(2);
    expect(sampledBodies).toContain('GET_OK');
    expect(sampledBodies).toContain('POST_OK');
  });
});
