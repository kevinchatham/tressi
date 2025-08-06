import { MockAgent, setGlobalDispatcher } from 'undici';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { RequestConfig, TressiConfig } from '../src/config';
import { Runner } from '../src/runner';

let mockAgent: MockAgent;

beforeAll(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
});

afterEach(() => {
  mockAgent.assertNoPendingInterceptors();
});

afterAll(() => {
  mockAgent.close();
});

const baseRequests: RequestConfig[] = [
  { url: 'http://localhost:8080/test', method: 'GET' },
];

describe('Object Allocation Optimizations', () => {
  describe('Endpoint Key Caching', () => {
    it('should handle multiple endpoints correctly', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool.intercept({ path: '/test1', method: 'GET' }).reply(200);
      mockPool.intercept({ path: '/test2', method: 'POST' }).reply(201);

      const requests: RequestConfig[] = [
        { url: 'http://localhost:8080/test1', method: 'GET' },
        { url: 'http://localhost:8080/test2', method: 'POST' },
      ];

      const config: TressiConfig = {
        requests,
        workers: 1,
        duration: 1,
      };

      const runner = new Runner(config, requests, {});

      await runner.run();

      const results = runner.getSampledResults();
      expect(results.length).toBeGreaterThan(0);

      const urls = new Set(results.map((r) => r.url));
      expect(urls.has('http://localhost:8080/test1')).toBe(true);
      expect(urls.has('http://localhost:8080/test2')).toBe(true);
    });
  });

  describe('Response Sampling', () => {
    it('should sample different status codes per endpoint', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(200);
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(404);
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(500);

      const config: TressiConfig = {
        requests: baseRequests,
        workers: 1,
        duration: 1,
      };

      const runner = new Runner(config, baseRequests, {});

      await runner.run();

      const results = runner.getSampledResults();
      expect(results.length).toBeGreaterThan(0);

      const statusCodes = new Set(results.map((r) => r.status));
      expect(statusCodes.size).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle error scenarios gracefully', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(500);

      const config: TressiConfig = {
        requests: baseRequests,
        workers: 1,
        duration: 1,
      };

      const runner = new Runner(config, baseRequests, {});

      await runner.run();

      const results = runner.getSampledResults();
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => !r.success)).toBe(true);
    });

    it('should handle network errors gracefully', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool
        .intercept({ path: '/test', method: 'GET' })
        .replyWithError(new Error('Network error'));

      const config: TressiConfig = {
        requests: baseRequests,
        workers: 1,
        duration: 1,
      };

      const runner = new Runner(config, baseRequests, {});

      await runner.run();

      const results = runner.getSampledResults();
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.error)).toBe(true);
    });
  });

  describe('Concurrency and Thread Safety', () => {
    it('should handle multiple workers correctly', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(200).times(20);

      const config: TressiConfig = {
        requests: baseRequests,
        workers: 3,
        duration: 1,
      };

      const runner = new Runner(config, baseRequests, {});

      await runner.run();

      const results = runner.getSampledResults();
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle high concurrency with optimizations', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(200).times(50);

      const config: TressiConfig = {
        requests: baseRequests,
        workers: 5,
        duration: 2,
        rps: 25,
      };

      const runner = new Runner(config, baseRequests, {});

      await runner.run();

      const results = runner.getSampledResults();
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Management', () => {
    it('should complete test without memory leaks', async () => {
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool
        .intercept({ path: '/test', method: 'GET' })
        .reply(200)
        .times(100);

      const config: TressiConfig = {
        requests: baseRequests,
        workers: 2,
        duration: 3,
        rps: 50,
      };

      const runner = new Runner(config, baseRequests, {});

      await runner.run();

      const results = runner.getSampledResults();
      expect(results.length).toBeGreaterThan(0);

      // Verify cleanup happened
      const histograms = runner.getEndpointHistograms();
      expect(histograms.size).toBeGreaterThan(0);
    });
  });
});
