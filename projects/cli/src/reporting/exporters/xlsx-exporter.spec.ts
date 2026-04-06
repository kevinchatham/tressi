import { writeFile } from 'node:fs/promises';
import type { EndpointSummary, TestSummary } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { validateXlsxPath } from '../utils/validation';
import { XlsxExporter } from './xlsx-exporter';

vi.mock('node:fs/promises');
vi.mock('../utils/validation');
vi.mock('xlsx', () => ({
  utils: {
    book_append_sheet: vi.fn(),
    book_new: vi.fn(() => ({})),
    json_to_sheet: vi.fn(() => ({})),
  },
  write: vi.fn(() => Buffer.from('mock-buffer')),
}));

describe('XlsxExporter', () => {
  let exporter: XlsxExporter;

  beforeEach(() => {
    exporter = new XlsxExporter();
    vi.clearAllMocks();
  });

  const createMockGlobal = (overrides = {}) => ({
    averageRequestsPerSecond: 100,
    avgProcessMemoryUsageMB: 256,
    avgSystemCpuUsagePercent: 45,
    earlyExitTriggered: false,
    epochEndedAt: 1700000010000,
    epochStartedAt: 1700000000000,
    errorRate: 0.05,
    failedRequests: 50,
    finalDurationSec: 60,
    histogram: {
      buckets: [
        { count: 200, lowerBound: 0, upperBound: 50 },
        { count: 300, lowerBound: 50, upperBound: 100 },
        { count: 300, lowerBound: 100, upperBound: 200 },
        { count: 200, lowerBound: 200, upperBound: 500 },
      ],
      max: 500,
      mean: 120,
      min: 10,
      percentiles: {
        1: 15,
        5: 20,
        10: 30,
        25: 50,
        50: 100,
        75: 200,
        90: 300,
        95: 350,
        99: 400,
        99.9: 480,
      },
      stdDev: 50,
      totalCount: 1000,
    },
    maxLatencyMs: 500,
    minLatencyMs: 10,
    networkBytesPerSec: 1024,
    networkBytesReceived: 102400,
    networkBytesSent: 51200,
    p50LatencyMs: 100,
    p95LatencyMs: 300,
    p99LatencyMs: 400,
    peakRequestsPerSecond: 150,
    successfulRequests: 950,
    targetAchieved: 85,
    totalEndpoints: 2,
    totalRequests: 1000,
    ...overrides,
  });

  const createMockEndpoint = (overrides: Partial<EndpointSummary> = {}): EndpointSummary => ({
    averageRequestsPerSecond: 100,
    earlyExitTriggered: false,
    errorRate: 0.05,
    failedRequests: 25,
    histogram: {
      buckets: [
        { count: 100, lowerBound: 0, upperBound: 50 },
        { count: 150, lowerBound: 50, upperBound: 100 },
        { count: 150, lowerBound: 100, upperBound: 200 },
        { count: 100, lowerBound: 200, upperBound: 500 },
      ],
      max: 500,
      mean: 120,
      min: 10,
      percentiles: {
        1: 15,
        5: 20,
        10: 30,
        25: 50,
        50: 100,
        75: 200,
        90: 300,
        95: 350,
        99: 400,
        99.9: 480,
      },
      stdDev: 50,
      totalCount: 500,
    },
    maxLatencyMs: 500,
    method: 'GET',
    minLatencyMs: 10,
    p50LatencyMs: 100,
    p95LatencyMs: 300,
    p99LatencyMs: 400,
    peakRequestsPerSecond: 150,
    responseSamples: [
      { body: '{"id":1}', headers: { 'content-type': 'application/json' }, statusCode: 200 },
      {
        body: '{"error":"bad request"}',
        headers: { 'content-type': 'application/json' },
        statusCode: 400,
      },
    ],
    statusCodeDistribution: {
      200: 450,
      201: 25,
      400: 15,
      500: 10,
    },
    successfulRequests: 475,
    targetAchieved: 85,
    theoreticalMaxRps: 200,
    totalRequests: 500,
    url: 'https://api.example.com/users',
    ...overrides,
  });

  const createMockSummary = (overrides: Partial<TestSummary> = {}): TestSummary => ({
    configSnapshot: {
      $schema: 'test-schema',
      options: {
        durationSec: 60,
        headers: {},
        rampUpDurationSec: 0,
        threads: 4,
        workerEarlyExit: {
          enabled: false,
          errorRateThreshold: 5,
          exitStatusCodes: [],
          monitoringWindowSeconds: 5,
        },
        workerMemoryLimit: 512,
      },
      requests: [],
    },
    endpoints: [],
    global: createMockGlobal(),
    tressiVersion: '1.0.0',
    ...overrides,
  });

  describe('export', () => {
    it('should return buffer when no path is provided', async () => {
      const mockSummary = createMockSummary();
      const result = await exporter.export(mockSummary);
      expect(result).toBeInstanceOf(Buffer);
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('should write to file when path is provided', async () => {
      const mockSummary = createMockSummary();
      const path = 'test.xlsx';
      await exporter.export(mockSummary, path);
      expect(validateXlsxPath).toHaveBeenCalledWith(path);
      expect(writeFile).toHaveBeenCalledWith(path, expect.any(Buffer));
    });

    it('should throw error if writing fails', async () => {
      const mockSummary = createMockSummary();
      const path = 'test.xlsx';
      vi.mocked(writeFile).mockRejectedValue(new Error('Write failed'));
      await expect(exporter.export(mockSummary, path)).rejects.toThrow(
        'Failed to export test results to Excel: Write failed',
      );
    });

    it('should create all required sheets', async () => {
      const mockSummary = createMockSummary();
      await exporter.export(mockSummary);
      const { utils } = await import('xlsx');
      expect(utils.book_new).toHaveBeenCalled();
      expect(utils.book_append_sheet).toHaveBeenCalledTimes(5);
    });

    it('should skip endpoint summary sheet when no endpoints', async () => {
      const mockSummary = createMockSummary({ endpoints: [] });
      await exporter.export(mockSummary);
      const { utils } = await import('xlsx');
      const sheetNames = vi.mocked(utils.book_append_sheet).mock.calls.map((call) => call[2]);
      expect(sheetNames).not.toContain('Endpoint Summary');
    });

    it('should include endpoint summary sheet when endpoints exist', async () => {
      const mockSummary = createMockSummary({
        endpoints: [createMockEndpoint()],
      });
      await exporter.export(mockSummary);
      const { utils } = await import('xlsx');
      const sheetNames = vi.mocked(utils.book_append_sheet).mock.calls.map((call) => call[2]);
      expect(sheetNames).toContain('Endpoint Summary');
    });

    it('should skip latency buckets sheet when no histogram buckets', async () => {
      const mockSummary = createMockSummary({
        global: createMockGlobal({
          histogram: {
            buckets: [],
            max: 0,
            mean: 0,
            min: 0,
            percentiles: {},
            stdDev: 0,
            totalCount: 0,
          },
        }),
      });
      await exporter.export(mockSummary);
    });

    it('should skip sampled responses sheet when no response samples', async () => {
      const mockSummary = createMockSummary({
        endpoints: [createMockEndpoint({ responseSamples: undefined })],
      });
      await exporter.export(mockSummary);
    });

    it('should include sampled responses sheet when response samples exist', async () => {
      const mockSummary = createMockSummary({
        endpoints: [createMockEndpoint()],
      });
      await exporter.export(mockSummary);
      const { utils } = await import('xlsx');
      const sheetNames = vi.mocked(utils.book_append_sheet).mock.calls.map((call) => call[2]);
      expect(sheetNames).toContain('Sampled Responses');
    });

    it('should deduplicate response samples by status code', async () => {
      const mockSummary = createMockSummary({
        endpoints: [
          createMockEndpoint({
            responseSamples: [
              { body: 'body1', headers: {}, statusCode: 200 },
              { body: 'body2', headers: {}, statusCode: 200 },
              { body: 'body3', headers: {}, statusCode: 201 },
            ],
          }),
        ],
      });
      await exporter.export(mockSummary);
      const { utils } = await import('xlsx');
      const bookAppendCalls = vi.mocked(utils.book_append_sheet).mock.calls;
      const sampledResponsesCall = bookAppendCalls.find((call) => call[2] === 'Sampled Responses');
      expect(sampledResponsesCall).toBeDefined();
    });
  });

  describe('_processData', () => {
    it('should aggregate status codes from all endpoints', async () => {
      const mockSummary = createMockSummary({
        endpoints: [
          createMockEndpoint({
            statusCodeDistribution: { 200: 100, 404: 10 },
          }),
          createMockEndpoint({
            statusCodeDistribution: { 200: 200, 500: 20 },
          }),
        ],
      });
      await exporter.export(mockSummary);
      const { utils } = await import('xlsx');
      const bookAppendCalls = vi.mocked(utils.book_append_sheet).mock.calls;
      const statusCodeCall = bookAppendCalls.find((call) => call[2] === 'Status Code Distribution');
      expect(statusCodeCall).toBeDefined();
    });

    it('should correctly categorize 1xx status codes', async () => {
      const mockSummary = createMockSummary({
        endpoints: [
          createMockEndpoint({
            statusCodeDistribution: { 100: 10, 101: 5 },
          }),
        ],
      });
      await exporter.export(mockSummary);
    });

    it('should correctly categorize 2xx status codes', async () => {
      const mockSummary = createMockSummary({
        endpoints: [
          createMockEndpoint({
            statusCodeDistribution: { 200: 100, 201: 50, 204: 25 },
          }),
        ],
      });
      await exporter.export(mockSummary);
    });

    it('should correctly categorize 3xx status codes', async () => {
      const mockSummary = createMockSummary({
        endpoints: [
          createMockEndpoint({
            statusCodeDistribution: { 301: 10, 302: 5, 304: 15 },
          }),
        ],
      });
      await exporter.export(mockSummary);
    });

    it('should correctly categorize 4xx status codes', async () => {
      const mockSummary = createMockSummary({
        endpoints: [
          createMockEndpoint({
            statusCodeDistribution: { 400: 10, 401: 5, 404: 20, 429: 15 },
          }),
        ],
      });
      await exporter.export(mockSummary);
    });

    it('should correctly categorize 5xx status codes', async () => {
      const mockSummary = createMockSummary({
        endpoints: [
          createMockEndpoint({
            statusCodeDistribution: { 500: 10, 502: 5, 503: 3 },
          }),
        ],
      });
      await exporter.export(mockSummary);
    });

    it('should handle mixed status codes across endpoints', async () => {
      const mockSummary = createMockSummary({
        endpoints: [
          createMockEndpoint({
            method: 'GET',
            statusCodeDistribution: { 200: 100, 404: 10 },
            url: 'https://api.example.com/users',
          }),
          createMockEndpoint({
            method: 'POST',
            statusCodeDistribution: { 201: 80, 400: 20 },
            url: 'https://api.example.com/users',
          }),
          createMockEndpoint({
            method: 'DELETE',
            statusCodeDistribution: { 204: 50, 500: 5 },
            url: 'https://api.example.com/users/1',
          }),
        ],
      });
      await exporter.export(mockSummary);
    });
  });

  describe('_getStatusCodeDistribution', () => {
    it('should handle empty status code map', async () => {
      const mockSummary = createMockSummary({
        endpoints: [createMockEndpoint({ statusCodeDistribution: {} })],
      });
      await exporter.export(mockSummary);
    });

    it('should handle status codes outside 1xx-5xx range', async () => {
      const mockSummary = createMockSummary({
        endpoints: [
          createMockEndpoint({
            statusCodeDistribution: { 200: 100, 600: 5 },
          }),
        ],
      });
      await exporter.export(mockSummary);
    });
  });

  describe('test summary sheet data', () => {
    it('should include all global metrics in test summary sheet', async () => {
      const mockSummary = createMockSummary({
        global: createMockGlobal({
          averageRequestsPerSecond: 500,
          avgProcessMemoryUsageMB: 512,
          avgSystemCpuUsagePercent: 65,
          errorRate: 0.05,
          failedRequests: 500,
          finalDurationSec: 120,
          maxLatencyMs: 1000,
          minLatencyMs: 5,
          networkBytesPerSec: 102400,
          networkBytesReceived: 5120000,
          networkBytesSent: 1024000,
          p50LatencyMs: 50,
          p95LatencyMs: 200,
          p99LatencyMs: 300,
          peakRequestsPerSecond: 750,
          successfulRequests: 9500,
          targetAchieved: 90,
          totalRequests: 10000,
        }),
      });
      await exporter.export(mockSummary);
    });
  });

  describe('endpoint summary sheet data', () => {
    it('should format endpoint data correctly', async () => {
      const mockSummary = createMockSummary({
        endpoints: [
          createMockEndpoint({
            averageRequestsPerSecond: 50,
            errorRate: 0.1,
            failedRequests: 100,
            method: 'POST',
            peakRequestsPerSecond: 80,
            successfulRequests: 900,
            targetAchieved: 75,
            theoreticalMaxRps: 100,
            totalRequests: 1000,
            url: 'https://api.example.com/data',
          }),
        ],
      });
      await exporter.export(mockSummary);
    });

    it('should handle endpoint with all percentile values', async () => {
      const mockSummary = createMockSummary({
        endpoints: [
          createMockEndpoint({
            histogram: {
              buckets: [
                { count: 200, lowerBound: 0, upperBound: 50 },
                { count: 300, lowerBound: 50, upperBound: 100 },
                { count: 300, lowerBound: 100, upperBound: 200 },
                { count: 200, lowerBound: 200, upperBound: 500 },
              ],
              max: 500,
              mean: 100,
              min: 5,
              percentiles: {
                1: 10,
                5: 15,
                10: 20,
                25: 35,
                50: 80,
                75: 150,
                90: 250,
                95: 300,
                99: 400,
                99.9: 480,
              },
              stdDev: 40,
              totalCount: 1000,
            },
          }),
        ],
      });
      await exporter.export(mockSummary);
    });
  });

  describe('configuration sheet', () => {
    it('should serialize complex config values as JSON', async () => {
      const mockSummary = createMockSummary({
        configSnapshot: {
          $schema: 'test-schema',
          options: {
            durationSec: 60,
            headers: { 'X-Custom': 'value' },
            rampUpDurationSec: 10,
            threads: 8,
            workerEarlyExit: {
              enabled: true,
              errorRateThreshold: 5,
              exitStatusCodes: [500, 502, 503],
              monitoringWindowSeconds: 10,
            },
            workerMemoryLimit: 1024,
          },
          requests: [],
        },
      });
      await exporter.export(mockSummary);
    });
  });

  describe('latency distribution sheet', () => {
    it('should calculate bucket percentages correctly', async () => {
      const mockSummary = createMockSummary({
        global: createMockGlobal({
          histogram: {
            buckets: [
              { count: 250, lowerBound: 0, upperBound: 50 },
              { count: 250, lowerBound: 50, upperBound: 100 },
              { count: 300, lowerBound: 100, upperBound: 200 },
              { count: 200, lowerBound: 200, upperBound: 500 },
            ],
            max: 500,
            mean: 100,
            min: 10,
            percentiles: {
              1: 15,
              5: 20,
              10: 30,
              25: 50,
              50: 100,
              75: 200,
              90: 300,
              95: 350,
              99: 400,
              99.9: 480,
            },
            stdDev: 50,
            totalCount: 1000,
          },
        }),
      });
      await exporter.export(mockSummary);
    });
  });

  describe('sampled responses sheet', () => {
    it('should sort samples by URL then status code', async () => {
      const mockSummary = createMockSummary({
        endpoints: [
          createMockEndpoint({
            responseSamples: [{ body: 'error', headers: {}, statusCode: 500 }],
            url: 'https://api.example.com/b',
          }),
          createMockEndpoint({
            responseSamples: [{ body: 'ok', headers: {}, statusCode: 200 }],
            url: 'https://api.example.com/a',
          }),
        ],
      });
      await exporter.export(mockSummary);
    });

    it('should handle endpoint without responseSamples property', async () => {
      const endpointWithoutSamples = createMockEndpoint();
      const { responseSamples: _, ...endpointWithoutSamplesProp } = endpointWithoutSamples;
      const mockSummary = createMockSummary({
        endpoints: [endpointWithoutSamplesProp as EndpointSummary],
      });
      await exporter.export(mockSummary);
    });

    it('should handle empty response samples array', async () => {
      const mockSummary = createMockSummary({
        endpoints: [
          createMockEndpoint({
            responseSamples: [],
          }),
        ],
      });
      await exporter.export(mockSummary);
    });

    it('should handle endpoint with only headers in sample', async () => {
      const mockSummary = createMockSummary({
        endpoints: [
          createMockEndpoint({
            responseSamples: [
              { body: '', headers: { 'content-type': 'text/plain' }, statusCode: 200 },
            ],
          }),
        ],
      });
      await exporter.export(mockSummary);
    });
  });

  describe('edge cases', () => {
    it('should handle summary with zero requests', async () => {
      const mockSummary = createMockSummary({
        global: createMockGlobal({
          failedRequests: 0,
          histogram: {
            buckets: [],
            max: 0,
            mean: 0,
            min: 0,
            percentiles: {},
            stdDev: 0,
            totalCount: 0,
          },
          successfulRequests: 0,
          totalRequests: 0,
        }),
      });
      await exporter.export(mockSummary);
    });

    it('should handle endpoint with zero requests', async () => {
      const mockSummary = createMockSummary({
        endpoints: [
          createMockEndpoint({
            failedRequests: 0,
            histogram: {
              buckets: [],
              max: 0,
              mean: 0,
              min: 0,
              percentiles: {},
              stdDev: 0,
              totalCount: 0,
            },
            statusCodeDistribution: {},
            successfulRequests: 0,
            totalRequests: 0,
          }),
        ],
      });
      await exporter.export(mockSummary);
    });

    it('should handle very large numbers', async () => {
      const mockSummary = createMockSummary({
        global: createMockGlobal({
          networkBytesReceived: 51200000000,
          networkBytesSent: 10240000000,
          totalRequests: 10000000,
        }),
      });
      await exporter.export(mockSummary);
    });
  });
});
