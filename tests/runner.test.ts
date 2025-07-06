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

    const results = await runner.run();

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

    const results = await runPromise;
    const duration =
      results[results.length - 1].timestamp - results[0].timestamp;

    expect(duration).toBeLessThan(2000);
  });
});
