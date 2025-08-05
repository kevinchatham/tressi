import { describe, expect, it } from 'vitest';

import { RequestConfig } from '../src/config';
import { RunOptions } from '../src/index';
import { Runner } from '../src/runner';
import { createMockAgent } from './setupTests';

const baseOptions: RunOptions = {
  config: { requests: [] },
  workers: 1,
  durationSec: 0.5,
};

describe('Headers Merging Tests', () => {
  it('should merge global and request headers', async () => {
    const mockAgent = createMockAgent();
    const mockPool = mockAgent.get('http://localhost:8080');

    let actualHeaders: Record<string, string> = {};
    mockPool.intercept({ path: '/test', method: 'GET' }).reply(200, (req) => {
      actualHeaders = { ...req.headers } as Record<string, string>;
      return { message: 'ok' };
    });

    const globalHeaders = {
      Authorization: 'Bearer global123',
      'X-Global': 'global-value',
    };

    const requestHeaders = {
      'X-Request-ID': 'req123',
      'X-Global': 'request-override', // Should override global
    };

    const requests: RequestConfig[] = [
      {
        url: 'http://localhost:8080/test',
        method: 'GET',
        headers: requestHeaders,
      },
    ];

    const runner = new Runner(baseOptions, requests, globalHeaders);
    await runner.run();

    // Convert to lowercase for comparison
    const lowerHeaders = Object.fromEntries(
      Object.entries(actualHeaders).map(([k, v]) => [k.toLowerCase(), v]),
    );

    expect(lowerHeaders['authorization']).toBe('Bearer global123');
    expect(lowerHeaders['x-global']).toBe('request-override');
    expect(lowerHeaders['x-request-id']).toBe('req123');
  });

  it('should handle empty global headers', async () => {
    const mockAgent = createMockAgent();
    const mockPool = mockAgent.get('http://localhost:8080');

    let actualHeaders: Record<string, string> = {};
    mockPool.intercept({ path: '/test', method: 'GET' }).reply(200, (req) => {
      actualHeaders = { ...req.headers } as Record<string, string>;
      return { message: 'ok' };
    });

    const requests: RequestConfig[] = [
      {
        url: 'http://localhost:8080/test',
        method: 'GET',
        headers: { 'X-Custom': 'value' },
      },
    ];

    const runner = new Runner(baseOptions, requests, {});
    await runner.run();

    const lowerHeaders = Object.fromEntries(
      Object.entries(actualHeaders).map(([k, v]) => [k.toLowerCase(), v]),
    );

    expect(lowerHeaders['x-custom']).toBe('value');
  });

  it('should handle empty request headers', async () => {
    const mockAgent = createMockAgent();
    const mockPool = mockAgent.get('http://localhost:8080');

    let actualHeaders: Record<string, string> = {};
    mockPool.intercept({ path: '/test', method: 'GET' }).reply(200, (req) => {
      actualHeaders = { ...req.headers } as Record<string, string>;
      return { message: 'ok' };
    });

    const requests: RequestConfig[] = [
      {
        url: 'http://localhost:8080/test',
        method: 'GET',
      },
    ];

    const runner = new Runner(baseOptions, requests, {
      'X-Global': 'global-value',
    });
    await runner.run();

    const lowerHeaders = Object.fromEntries(
      Object.entries(actualHeaders).map(([k, v]) => [k.toLowerCase(), v]),
    );

    expect(lowerHeaders['x-global']).toBe('global-value');
  });
});
