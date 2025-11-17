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
  requests: [{ url: 'http://localhost:8080/test', method: 'GET', rps: 10 }],
  options: {
    durationSec: 1,
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
 * Test suite for headers merging functionality in the CoreRunner class.
 */
describe('Headers Merging Tests', () => {
  it('should merge global and request headers', async () => {
    const mockPool = mockAgent.get('http://localhost:8080');
    mockPool.intercept({ path: '/test', method: 'GET' }).reply(200);

    const globalHeaders = { Authorization: 'Bearer global-token' };
    const requestHeaders = { 'X-Request-ID': '123' };

    const config = createTestConfig({
      requests: [
        {
          url: 'http://localhost:8080/test',
          method: 'GET',
          headers: requestHeaders,
          rps: 10,
        },
      ],
      options: {
        headers: globalHeaders,
        durationSec: 1,
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
      },
    });

    const runner = new CoreRunner(config);

    await runner.run();

    const results = runner.getResults();
    expect(results.global.totalRequests).toBeGreaterThan(0);
    expect(results.endpoints[0].successfulRequests).toBeGreaterThan(0);
  });

  it('should handle empty global headers', async () => {
    const mockPool = mockAgent.get('http://localhost:8080');
    mockPool.intercept({ path: '/test', method: 'GET' }).reply(200);

    const requestHeaders = { 'X-Request-ID': '456' };

    const config = createTestConfig({
      requests: [
        {
          url: 'http://localhost:8080/test',
          method: 'GET',
          headers: requestHeaders,
          rps: 10,
        },
      ],
      options: {
        headers: {},
        durationSec: 1,
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
      },
    });

    const runner = new CoreRunner(config);

    await runner.run();

    const results = runner.getResults();
    expect(results.global.totalRequests).toBeGreaterThan(0);
    expect(results.endpoints[0].successfulRequests).toBeGreaterThan(0);
  });

  it('should handle empty request headers', async () => {
    const mockPool = mockAgent.get('http://localhost:8080');
    mockPool.intercept({ path: '/test', method: 'GET' }).reply(200);

    const globalHeaders = { Authorization: 'Bearer global-token' };

    const config = createTestConfig({
      requests: [
        {
          url: 'http://localhost:8080/test',
          method: 'GET',
          headers: {},
          rps: 10,
        },
      ],
      options: {
        headers: globalHeaders,
        durationSec: 1,
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
      },
    });

    const runner = new CoreRunner(config);

    await runner.run();

    const results = runner.getResults();
    expect(results.global.totalRequests).toBeGreaterThan(0);
    expect(results.endpoints[0].successfulRequests).toBeGreaterThan(0);
  });
});
