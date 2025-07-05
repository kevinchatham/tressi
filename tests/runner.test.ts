import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll,afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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

describe('Runner', () => {
  it('should run a basic test and return results', async () => {
    const options: RunOptions = { ...baseOptions };
    const runner = new Runner(options, baseRequests, {});

    const results = await runner.run();

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].status).toBe(200);
    expect(results[0].success).toBe(true);
  });

  it('should respect the RPS limit', async () => {
    vi.useFakeTimers();
    const options: RunOptions = { ...baseOptions, rps: 10, durationSec: 2 };
    const runner = new Runner(options, baseRequests, {});

    const runPromise = runner.run();
    await vi.advanceTimersByTimeAsync(2000);
    await runPromise;

    const results = runner.getResults();
    expect(results.length).toBeCloseTo(20, -1);
  });

  it('should ramp up the request rate', async () => {
    vi.useFakeTimers();
    const options: RunOptions = {
      ...baseOptions,
      rps: 100,
      durationSec: 4,
      rampUpTimeSec: 2,
    };
    const runner = new Runner(options, baseRequests, {});

    const runPromise = runner.run();
    await vi.advanceTimersByTimeAsync(1000);
    expect(runner.getCurrentRpm()).toBeCloseTo(50, -1); // Halfway through ramp-up

    await vi.advanceTimersByTimeAsync(1000);
    expect(runner.getCurrentRpm()).toBeCloseTo(100, -1); // Fully ramped up

    await vi.advanceTimersByTimeAsync(2000);
    await runPromise;
  });

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

      const timeout = setTimeout(() => {
        clearInterval(interval);
        reject(new Error('Autoscaler did not increase worker count in time'));
      }, 4000); // Fail after 4s
    });

    runner.stop();
    await runPromise;
  }, 7000);

  it('should stop the test run when stop() is called', async () => {
    vi.useFakeTimers();
    const options: RunOptions = { ...baseOptions, durationSec: 10 };
    const runner = new Runner(options, baseRequests, {});

    const runPromise = runner.run();

    setTimeout(() => runner.stop(), 1000);
    await vi.advanceTimersByTimeAsync(1000);

    const results = await runPromise;
    const duration = results[results.length - 1].timestamp - results[0].timestamp;

    expect(duration).toBeLessThan(2000);
  });
}); 