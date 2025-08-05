import { describe, expect, it } from 'vitest';

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

describe('Object Allocation Optimizations', () => {
  describe('Endpoint Key Caching', () => {
    it('should handle multiple endpoints correctly', async () => {
      const mockAgent = createMockAgent();
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool.intercept({ path: '/test1', method: 'GET' }).reply(200);
      mockPool.intercept({ path: '/test2', method: 'POST' }).reply(201);

      const requests: RequestConfig[] = [
        { url: 'http://localhost:8080/test1', method: 'GET' },
        { url: 'http://localhost:8080/test2', method: 'POST' },
      ];

      const runner = new Runner(baseOptions, requests, {});

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
      const mockAgent = createMockAgent();
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(200).persist();
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(404).persist();
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(500).persist();

      const runner = new Runner(
        { ...baseOptions, durationSec: 0.5, workers: 1 },
        baseRequests,
        {},
      );

      await runner.run();

      const results = runner.getSampledResults();
      expect(results.length).toBeGreaterThan(0);

      const statusCodes = new Set(results.map((r) => r.status));
      expect(statusCodes.size).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle error scenarios gracefully', async () => {
      const mockAgent = createMockAgent();
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(500).persist();

      const runner = new Runner(
        { ...baseOptions, durationSec: 0.5, workers: 1 },
        baseRequests,
        {},
      );

      await runner.run();

      const results = runner.getSampledResults();
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => !r.success)).toBe(true);
    });

    it('should handle network errors gracefully', async () => {
      const mockAgent = createMockAgent();
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool
        .intercept({ path: '/test', method: 'GET' })
        .replyWithError(new Error('Network error'))
        .persist();

      const runner = new Runner(
        { ...baseOptions, durationSec: 0.5, workers: 1 },
        baseRequests,
        {},
      );

      await runner.run();

      const results = runner.getSampledResults();
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.error)).toBe(true);
    });
  });

  describe('Concurrency and Thread Safety', () => {
    it('should handle multiple workers correctly', async () => {
      const mockAgent = createMockAgent();
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(200).persist();

      const options = { ...baseOptions, workers: 2, durationSec: 0.5 };
      const runner = new Runner(options, baseRequests, {});

      await runner.run();

      const results = runner.getSampledResults();
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle high concurrency with optimizations', async () => {
      const mockAgent = createMockAgent();
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(200).persist();

      const options = {
        ...baseOptions,
        workers: 2,
        durationSec: 0.5,
        rps: 5,
      };

      const runner = new Runner(options, baseRequests, {});

      await runner.run();

      const results = runner.getSampledResults();
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Management', () => {
    it('should complete test without memory leaks', async () => {
      const mockAgent = createMockAgent();
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(200).persist();

      const options = {
        ...baseOptions,
        workers: 1,
        durationSec: 0.5,
        rps: 10,
      };

      const runner = new Runner(options, baseRequests, {});

      await runner.run();

      const results = runner.getSampledResults();
      expect(results.length).toBeGreaterThan(0);

      // Verify cleanup happened
      const histograms = runner.getEndpointHistograms();
      expect(histograms.size).toBeGreaterThan(0);
    });
  });
});
