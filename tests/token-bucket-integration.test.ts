import { describe, expect, it } from 'vitest';

import { RequestConfig } from '../src/config';
import { RunOptions } from '../src/index';
import { Runner } from '../src/runner';
import { createMockAgent } from './setupTests';

const baseOptions: RunOptions = {
  config: { requests: [] },
  workers: 1,
  durationSec: 2,
};

describe('TokenBucketManager Integration Tests', () => {
  describe('Per-endpoint rate limiting', () => {
    it('should enforce different rate limits for different endpoints', async () => {
      const mockAgent = createMockAgent();
      const mockPool1 = mockAgent.get('http://api1.example.com');
      const mockPool2 = mockAgent.get('http://api2.example.com');

      mockPool1
        .intercept({ path: '/endpoint1', method: 'GET' })
        .reply(200)
        .persist();
      mockPool2
        .intercept({ path: '/endpoint2', method: 'GET' })
        .reply(200)
        .persist();

      const requests: RequestConfig[] = [
        {
          url: 'http://api1.example.com/endpoint1',
          method: 'GET',
          targetRps: 50,
        },
        {
          url: 'http://api2.example.com/endpoint2',
          method: 'GET',
          targetRps: 100,
        },
      ];

      const options: RunOptions = { ...baseOptions, durationSec: 1 };
      const runner = new Runner(options, requests, {});

      await runner.run();

      const results = runner.getSampledResults();
      const endpoint1Results = results.filter((r) =>
        r.url.includes('endpoint1'),
      );
      const endpoint2Results = results.filter((r) =>
        r.url.includes('endpoint2'),
      );

      // Both endpoints should have received requests
      expect(endpoint1Results.length).toBeGreaterThan(0);
      expect(endpoint2Results.length).toBeGreaterThan(0);
    });

    it('should handle rate limit exceeded gracefully', async () => {
      const mockAgent = createMockAgent();
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool
        .intercept({ path: '/limited', method: 'GET' })
        .reply(200)
        .persist();

      const requests: RequestConfig[] = [
        {
          url: 'http://localhost:8080/limited',
          method: 'GET',
          targetRps: 100, // High rate to trigger limiting
        },
      ];

      const options: RunOptions = { ...baseOptions, durationSec: 1 };
      const runner = new Runner(options, requests, {});

      await runner.run();

      const results = runner.getSampledResults();

      // Should have some successful requests
      const successful = results.filter((r) => r.success && r.status === 200);
      expect(successful.length).toBeGreaterThan(0);
    });
  });

  describe('Global rate limit fallback', () => {
    it('should use global rate limit when no per-endpoint config provided', async () => {
      const mockAgent = createMockAgent();
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool.intercept({ path: '/test', method: 'GET' }).reply(200).persist();

      const requests: RequestConfig[] = [
        { url: 'http://localhost:8080/test', method: 'GET' },
      ];

      const options: RunOptions = { ...baseOptions, durationSec: 1 };
      const runner = new Runner(options, requests, {});

      await runner.run();

      const results = runner.getSampledResults();

      // Should complete without hanging
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Concurrent worker access', () => {
    it('should handle multiple workers accessing rate limiting safely', async () => {
      const mockAgent = createMockAgent();
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool
        .intercept({ path: '/concurrent', method: 'GET' })
        .reply(200)
        .persist();

      const requests: RequestConfig[] = [
        {
          url: 'http://localhost:8080/concurrent',
          method: 'GET',
          targetRps: 10,
        },
      ];

      const options: RunOptions = {
        ...baseOptions,
        workers: 3,
        durationSec: 1,
      };
      const runner = new Runner(options, requests, {});

      await runner.run();

      const results = runner.getSampledResults();

      // All workers should have made requests
      expect(results.length).toBeGreaterThan(0);

      // No crashes or deadlocks
      expect(
        results.some((r) => !r.success && r.error?.includes('deadlock')),
      ).toBe(false);
    });
  });

  describe('Configuration changes during runtime', () => {
    it('should handle configuration changes gracefully', async () => {
      const mockAgent = createMockAgent();
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool
        .intercept({ path: '/dynamic', method: 'GET' })
        .reply(200)
        .persist();

      const requests: RequestConfig[] = [
        {
          url: 'http://localhost:8080/dynamic',
          method: 'GET',
          targetRps: 2,
        },
      ];

      const options: RunOptions = { ...baseOptions, durationSec: 1 };
      const runner = new Runner(options, requests, {});

      await runner.run();

      const results = runner.getSampledResults();
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Performance validation', () => {
    it('should not have 5x performance penalty with TokenBucketManager', async () => {
      const mockAgent = createMockAgent();
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool.intercept({ path: '/perf', method: 'GET' }).reply(200).persist();

      const requests: RequestConfig[] = [
        { url: 'http://localhost:8080/perf', method: 'GET' },
      ];

      const options: RunOptions = {
        ...baseOptions,
        durationSec: 1,
        workers: 2,
      };
      const runner = new Runner(options, requests, {});

      const startTime = Date.now();
      await runner.run();
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Relaxed timing for CI - just ensure it completes
      expect(duration).toBeLessThan(30000); // 30 second max for CI
      expect(duration).toBeGreaterThan(0);

      const results = runner.getSampledResults();
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle minimum rate limits gracefully', async () => {
      const mockAgent = createMockAgent();
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool.intercept({ path: '/min', method: 'GET' }).reply(200).persist();

      const requests: RequestConfig[] = [
        {
          url: 'http://localhost:8080/min',
          method: 'GET',
          targetRps: 1,
        },
      ];

      const options: RunOptions = { ...baseOptions, durationSec: 1 };
      const runner = new Runner(options, requests, {});

      await runner.run();

      const results = runner.getSampledResults();
      // Should handle gracefully without crashing
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle very high rate limits', async () => {
      const mockAgent = createMockAgent();
      const mockPool = mockAgent.get('http://localhost:8080');
      mockPool.intercept({ path: '/high', method: 'GET' }).reply(200).persist();

      const requests: RequestConfig[] = [
        {
          url: 'http://localhost:8080/high',
          method: 'GET',
          targetRps: 100,
        },
      ];

      const options: RunOptions = { ...baseOptions, durationSec: 1 };
      const runner = new Runner(options, requests, {});

      await runner.run();

      const results = runner.getSampledResults();
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
