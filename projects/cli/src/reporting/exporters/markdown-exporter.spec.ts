import { writeFile } from 'node:fs/promises';
import type {
  EndpointSummary,
  LatencyHistogram,
  LatencyHistogramBucket,
  TestSummary,
  TressiConfig,
} from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportingUtils } from '../../utils/reporting-utils';
import * as statusCodeAggregator from '../utils/status-code-aggregator';
import { validateMarkdownPath } from '../utils/validation';
import { MarkdownExporter } from './markdown-exporter';

vi.mock('node:fs/promises');
vi.mock('../utils/validation');
vi.mock('../utils/status-code-aggregator');
vi.mock('../../utils/reporting-utils');

describe('MarkdownExporter', () => {
  let exporter: MarkdownExporter;

  beforeEach(() => {
    exporter = new MarkdownExporter();
    vi.clearAllMocks();
    vi.mocked(statusCodeAggregator.aggregateStatusCodesFromEndpoints).mockReturnValue({});
    vi.mocked(ReportingUtils.getStatusCodeDistributionByCategory).mockReturnValue({
      '2xx': 0,
      '3xx': 0,
      '4xx': 0,
      '5xx': 0,
      other: 0,
    });
  });

  const createHistogram = (overrides: Partial<LatencyHistogram> = {}): LatencyHistogram => ({
    buckets: [] as LatencyHistogramBucket[],
    max: 100,
    mean: 50,
    min: 10,
    percentiles: {
      1: 12,
      5: 15,
      10: 20,
      25: 30,
      50: 50,
      75: 70,
      90: 85,
      95: 90,
      99: 98,
    },
    stdDev: 20,
    totalCount: 100,
    ...overrides,
  });

  const createEndpoint = (overrides: Partial<EndpointSummary> = {}): EndpointSummary => ({
    averageRequestsPerSecond: 10,
    earlyExitTriggered: false,
    errorRate: 0,
    failedRequests: 0,
    histogram: createHistogram(),
    maxLatencyMs: 100,
    method: 'GET',
    minLatencyMs: 10,
    p50LatencyMs: 50,
    p95LatencyMs: 80,
    p99LatencyMs: 95,
    peakRequestsPerSecond: 15,
    responseSamples: [] as { statusCode: number; headers: Record<string, string>; body: string }[],
    statusCodeDistribution: { 200: 100 },
    successfulRequests: 100,
    targetAchieved: 1,
    theoreticalMaxRps: 100,
    totalRequests: 100,
    url: 'https://api.example.com/test',
    ...overrides,
  });

  const createBaseSummary = (overrides: Partial<TestSummary> = {}): TestSummary =>
    ({
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
      global: {
        averageRequestsPerSecond: 1,
        avgProcessMemoryUsageMB: 1,
        avgSystemCpuUsagePercent: 1,
        earlyExitTriggered: false,
        epochEndedAt: 1700000010000,
        epochStartedAt: 1700000000000,
        errorRate: 0,
        failedRequests: 0,
        finalDurationSec: 10,
        maxLatencyMs: 1,
        minLatencyMs: 1,
        networkBytesPerSec: 10,
        networkBytesReceived: 100,
        networkBytesSent: 100,
        p50LatencyMs: 1,
        p95LatencyMs: 1,
        p99LatencyMs: 1,
        peakRequestsPerSecond: 1,
        successfulRequests: 1,
        targetAchieved: 1,
        totalRequests: 1,
      },
      tressiVersion: '0.0.1',
      ...overrides,
    }) as unknown as TestSummary;

  it('should return markdown string when no path is provided', async () => {
    const result = await exporter.export(createBaseSummary());
    expect(typeof result).toBe('string');
    expect(result).toContain('# Tressi Load Test Report');
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('should write to file when path is provided', async () => {
    const path = 'test.md';
    await exporter.export(createBaseSummary(), path);
    expect(validateMarkdownPath).toHaveBeenCalledWith(path);
    expect(writeFile).toHaveBeenCalledWith(path, expect.any(String), 'utf-8');
  });

  it('should throw error if writing fails', async () => {
    const path = 'test.md';
    vi.mocked(writeFile).mockRejectedValue(new Error('Write failed'));
    await expect(exporter.export(createBaseSummary(), path)).rejects.toThrow(
      'Failed to export test summary to Markdown: Write failed',
    );
  });

  it('should throw error if export fails', async () => {
    vi.mocked(statusCodeAggregator.aggregateStatusCodesFromEndpoints).mockImplementation(() => {
      throw new Error('Aggregation failed');
    });
    await expect(exporter.export(createBaseSummary())).rejects.toThrow(
      'Failed to export test summary to Markdown: Aggregation failed',
    );
  });

  describe('Warnings', () => {
    it('should generate warnings for high failure rate endpoints', async () => {
      const summary = createBaseSummary({
        endpoints: [
          createEndpoint({
            errorRate: 0.2, // 20% failure rate
            failedRequests: 20,
            statusCodeDistribution: { 500: 20 },
            successfulRequests: 80,
            totalRequests: 100,
            url: 'https://api.example.com/test',
          }),
        ],
      });

      const result = await exporter.export(summary);
      expect(result).toContain('Analysis & Warnings');
      expect(result).toContain('High Failure Rate');
      expect(result).toContain('api.example.com/test');
      expect(result).toContain('20.0%');
    });

    it('should not generate warnings for low failure rate endpoints', async () => {
      const summary = createBaseSummary({
        endpoints: [
          createEndpoint({
            errorRate: 0.01, // 1% failure rate - below threshold
            failedRequests: 1,
            statusCodeDistribution: { 200: 99 },
            successfulRequests: 99,
            totalRequests: 100,
          }),
        ],
      });

      const result = await exporter.export(summary);
      expect(result).not.toContain('High Failure Rate');
    });
  });

  describe('Configuration', () => {
    it('should format configuration with all options', async () => {
      const config: TressiConfig = {
        $schema: 'test',
        options: {
          durationSec: 60,
          headers: {},
          rampUpDurationSec: 10,
          threads: 4,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 5,
            exitStatusCodes: [],
            monitoringWindowSeconds: 5,
          },
          workerMemoryLimit: 512,
        },
        requests: [
          {
            earlyExit: {
              enabled: false,
              errorRateThreshold: 5,
              exitStatusCodes: [],
              monitoringWindowSeconds: 5,
            },
            headers: {},
            method: 'GET',
            payload: {},
            rampUpDurationSec: 10,
            rps: 100,
            url: 'https://api.example.com',
          },
          {
            earlyExit: {
              enabled: false,
              errorRateThreshold: 5,
              exitStatusCodes: [],
              monitoringWindowSeconds: 5,
            },
            headers: {},
            method: 'POST',
            payload: {},
            rampUpDurationSec: 5,
            rps: 50,
            url: 'https://api.example.com/data',
          },
        ],
      };

      const summary = createBaseSummary({ configSnapshot: config });
      const result = await exporter.export(summary);

      expect(result).toContain('Test Configuration');
      expect(result).toContain('60s'); // duration
      expect(result).toContain('4'); // threads
      expect(result).toContain('512'); // workerMemoryLimit
      expect(result).toContain('10s'); // rampUpDurationSec
      expect(result).toContain('GET');
      expect(result).toContain('POST');
      expect(result).toContain('api.example.com');
    });

    it('should format configuration with early exit enabled', async () => {
      const config: TressiConfig = {
        $schema: 'test',
        options: {
          durationSec: 60,
          headers: {},
          rampUpDurationSec: 10,
          threads: 4,
          workerEarlyExit: {
            enabled: true,
            errorRateThreshold: 5,
            exitStatusCodes: [500, 502, 503],
            monitoringWindowSeconds: 5,
          },
          workerMemoryLimit: 512,
        },
        requests: [
          {
            earlyExit: {
              enabled: false,
              errorRateThreshold: 5,
              exitStatusCodes: [],
              monitoringWindowSeconds: 5,
            },
            headers: {},
            method: 'GET',
            payload: {},
            rampUpDurationSec: 0,
            rps: 100,
            url: 'https://api.example.com',
          },
        ],
      };

      const summary = createBaseSummary({ configSnapshot: config });
      const result = await exporter.export(summary);

      expect(result).toContain('Early Exit');
      expect(result).toContain('Enabled');
      expect(result).toContain('5%'); // threshold displayed without decimal
    });

    it('should format configuration with early exit disabled', async () => {
      const config: TressiConfig = {
        $schema: 'test',
        options: {
          durationSec: 60,
          headers: {},
          rampUpDurationSec: 10,
          threads: 4,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 5,
            exitStatusCodes: [500, 502, 503],
            monitoringWindowSeconds: 5,
          },
          workerMemoryLimit: 512,
        },
        requests: [
          {
            earlyExit: {
              enabled: false,
              errorRateThreshold: 5,
              exitStatusCodes: [],
              monitoringWindowSeconds: 5,
            },
            headers: {},
            method: 'GET',
            payload: {},
            rampUpDurationSec: 0,
            rps: 100,
            url: 'https://api.example.com',
          },
        ],
      };

      const summary = createBaseSummary({ configSnapshot: config });
      const result = await exporter.export(summary);

      expect(result).toContain('Early Exit');
      expect(result).toContain('Disabled');
    });
  });

  describe('Global Summary', () => {
    it('should format global summary with histogram data', async () => {
      const summary = createBaseSummary({
        global: {
          ...createBaseSummary().global,
          errorRate: 0.1,
          failedRequests: 100,
          histogram: createHistogram({
            max: 1000,
            min: 5,
            percentiles: {
              1: 10,
              5: 15,
              10: 20,
              25: 30,
              50: 50,
              75: 100,
              90: 300,
              95: 500,
              99: 800,
            },
            totalCount: 1000,
          }),
          maxLatencyMs: 1000,
          minLatencyMs: 5,
          p50LatencyMs: 50,
          p95LatencyMs: 200,
          p99LatencyMs: 500,
          successfulRequests: 900,
          totalRequests: 1000,
        },
      });

      const result = await exporter.export(summary);

      expect(result).toContain('Global Summary');
      expect(result).toContain('1,000'); // totalRequests formatted
      expect(result).toContain('10.00%'); // error rate
      expect(result).toContain('5.00ms'); // min latency from histogram
      expect(result).toContain('50.00ms'); // p50 from histogram
      expect(result).toContain('500.00ms'); // p95 from histogram
      expect(result).toContain('1000.00ms'); // max from histogram
    });

    it('should format global summary without histogram (fallback)', async () => {
      const summary = createBaseSummary({
        global: {
          ...createBaseSummary().global,
          maxLatencyMs: 500,
          minLatencyMs: 10,
          p50LatencyMs: 50,
          p95LatencyMs: 200,
          p99LatencyMs: 400,
        },
      });

      const result = await exporter.export(summary);

      expect(result).toContain('Global Summary');
      expect(result).toContain('10.00ms'); // min latency
      expect(result).toContain('50.00ms'); // p50 latency
    });

    it('should format network bytes correctly', async () => {
      const summary = createBaseSummary({
        global: {
          ...createBaseSummary().global,
          networkBytesPerSec: 1024 * 100, // 100 KB/s
          networkBytesReceived: 1024 * 1024 * 5, // 5 MB
          networkBytesSent: 1024 * 1024, // 1 MB
        },
      });

      const result = await exporter.export(summary);

      expect(result).toContain('Network Sent');
      expect(result).toContain('1 MB');
      expect(result).toContain('Network Received');
      expect(result).toContain('5 MB');
      expect(result).toContain('Network Throughput');
      expect(result).toContain('100 KB/s');
    });
  });

  describe('Latency Distribution', () => {
    it('should format latency distribution with histogram buckets', async () => {
      const buckets: LatencyHistogramBucket[] = [
        { count: 500, lowerBound: 0, upperBound: 50 },
        { count: 300, lowerBound: 50, upperBound: 100 },
        { count: 150, lowerBound: 100, upperBound: 200 },
        { count: 50, lowerBound: 200, upperBound: 500 },
      ];

      const summary = createBaseSummary({
        global: {
          ...createBaseSummary().global,
          histogram: createHistogram({
            buckets,
            max: 400,
            min: 5,
            percentiles: {
              1: 10,
              5: 15,
              10: 20,
              25: 30,
              50: 50,
              75: 100,
              90: 200,
              95: 300,
              99: 400,
            },
            totalCount: 1000,
          }),
          totalRequests: 1000,
        },
      });

      const result = await exporter.export(summary);

      expect(result).toContain('Latency Distribution');
      expect(result).toContain('Latency Histogram');
      expect(result).toContain('Global Latency Percentiles');
      expect(result).toContain('Min');
      expect(result).toContain('99th');
      expect(result).toContain('Max');
      expect(result).toContain('Total Requests');
      expect(result).toContain('Latency Bucket Distribution');
      expect(result).toContain('0.0 - 50.0'); // bucket range
      expect(result).toContain('500'); // count
      expect(result).toContain('50.0%'); // percentage
    });

    it('should handle empty histogram buckets', async () => {
      const summary = createBaseSummary({
        global: {
          ...createBaseSummary().global,
          histogram: createHistogram({
            buckets: [],
            max: 0,
            min: 0,
            percentiles: {},
            totalCount: 0,
          }),
          totalRequests: 0,
        },
      });

      const result = await exporter.export(summary);

      // When totalRequests is 0, the latency distribution section is not added
      // because of the check at line 54: if (g.totalRequests > 0)
      expect(result).not.toContain('Latency Distribution');
    });

    it('should generate ASCII histogram correctly', async () => {
      const buckets: LatencyHistogramBucket[] = [
        { count: 500, lowerBound: 0, upperBound: 50 },
        { count: 300, lowerBound: 50, upperBound: 100 },
        { count: 200, lowerBound: 100, upperBound: 200 },
      ];

      const summary = createBaseSummary({
        global: {
          ...createBaseSummary().global,
          histogram: createHistogram({
            buckets,
            max: 150,
            min: 10,
            percentiles: {
              1: 15,
              5: 20,
              10: 25,
              25: 35,
              50: 50,
              75: 80,
              90: 120,
              95: 140,
              99: 150,
            },
            totalCount: 1000,
          }),
          totalRequests: 1000,
        },
      });

      const result = await exporter.export(summary);

      expect(result).toContain('Latency Distribution:');
      expect(result).toContain('0-50ms'); // ASCII histogram labels
      expect(result).toContain('50-100ms');
      expect(result).toContain('100-200ms');
      expect(result).toContain('50.0%'); // percentages
    });
  });

  describe('Error Summary', () => {
    it('should include error summary when failed requests exist', async () => {
      const summary = createBaseSummary({
        global: {
          ...createBaseSummary().global,
          failedRequests: 50,
        },
      });

      const result = await exporter.export(summary);

      expect(result).toContain('Error Summary');
      expect(result).toContain('50 requests failed');
    });

    it('should not include error summary when no failed requests', async () => {
      const summary = createBaseSummary({
        global: {
          ...createBaseSummary().global,
          failedRequests: 0,
        },
      });

      const result = await exporter.export(summary);

      expect(result).not.toContain('Error Summary');
    });
  });

  describe('Status Code Summary', () => {
    it('should format status code summary with aggregated codes', async () => {
      vi.mocked(statusCodeAggregator.aggregateStatusCodesFromEndpoints).mockReturnValue({
        200: 500,
        201: 200,
        400: 50,
        500: 10,
      });
      vi.mocked(ReportingUtils.getStatusCodeDistributionByCategory).mockReturnValue({
        '2xx': 700,
        '3xx': 0,
        '4xx': 50,
        '5xx': 10,
        other: 0,
      });

      const summary = createBaseSummary({
        global: {
          ...createBaseSummary().global,
          totalRequests: 760,
        },
      });

      const result = await exporter.export(summary);

      expect(result).toContain('Responses by Status Code');
      expect(result).toContain('2xx');
      expect(result).toContain('4xx');
      expect(result).toContain('5xx');
      expect(result).toContain('Individual Status Codes');
      expect(result).toContain('200');
      expect(result).toContain('201');
      expect(result).toContain('400');
      expect(result).toContain('500');
    });

    it('should not include individual status codes section when no codes', async () => {
      vi.mocked(statusCodeAggregator.aggregateStatusCodesFromEndpoints).mockReturnValue({});
      vi.mocked(ReportingUtils.getStatusCodeDistributionByCategory).mockReturnValue({
        '2xx': 0,
        '3xx': 0,
        '4xx': 0,
        '5xx': 0,
        other: 0,
      });

      const summary = createBaseSummary();
      const result = await exporter.export(summary);

      expect(result).not.toContain('Individual Status Codes');
    });

    it('should aggregate status codes from endpoints', async () => {
      vi.mocked(statusCodeAggregator.aggregateStatusCodesFromEndpoints).mockReturnValue({
        200: 100,
        404: 5,
      });

      const summary = createBaseSummary();
      await exporter.export(summary);

      expect(statusCodeAggregator.aggregateStatusCodesFromEndpoints).toHaveBeenCalledWith([]);
    });
  });

  describe('Endpoint Summary', () => {
    it('should format endpoint summary with basic data', async () => {
      const endpoint = createEndpoint({
        errorRate: 0.05,
        failedRequests: 50,
        statusCodeDistribution: { 200: 950 },
        successfulRequests: 950,
        totalRequests: 1000,
      });

      const summary = createBaseSummary({ endpoints: [endpoint] });
      const result = await exporter.export(summary);

      expect(result).toContain('Endpoint Summary');
      expect(result).toContain('Request Counts and Rates');
      expect(result).toContain('https://api.example.com/test');
      expect(result).toContain('1000'); // total requests (not formatted with commas)
      expect(result).toContain('950'); // successful
      expect(result).toContain('50'); // failed
      expect(result).toContain('5.00%'); // error rate
      expect(result).toContain('Endpoint Latency Details');
    });

    it('should format endpoint summary with histogram data', async () => {
      const endpoint = createEndpoint({
        histogram: createHistogram({
          buckets: [
            { count: 400, lowerBound: 0, upperBound: 50 },
            { count: 300, lowerBound: 50, upperBound: 100 },
            { count: 200, lowerBound: 100, upperBound: 200 },
            { count: 100, lowerBound: 200, upperBound: 500 },
          ],
          max: 500,
          min: 10,
          percentiles: {
            1: 12,
            5: 15,
            10: 20,
            25: 30,
            50: 50,
            75: 100,
            90: 200,
            95: 300,
            99: 450,
          },
          totalCount: 1000,
        }),
      });

      const summary = createBaseSummary({ endpoints: [endpoint] });
      const result = await exporter.export(summary);

      expect(result).toContain('Per-Endpoint Details');
      expect(result).toContain('View Latency Histogram');
      // Response Samples section only appears when there are samples
      expect(result).not.toContain('View Response Samples');
    });

    it('should format endpoint status code distribution', async () => {
      const endpoint = createEndpoint({
        errorRate: 0.1,
        failedRequests: 100,
        statusCodeDistribution: {
          200: 850,
          201: 50,
          400: 80,
          500: 20,
        },
        successfulRequests: 900,
        totalRequests: 1000,
      });

      const summary = createBaseSummary({ endpoints: [endpoint] });
      const result = await exporter.export(summary);

      expect(result).toContain('Status Code Distribution');
      expect(result).toContain('200');
      expect(result).toContain('201');
      expect(result).toContain('400');
      expect(result).toContain('500');
      expect(result).toContain('85.0%'); // percentage for 200
      expect(result).toContain('5.0%'); // percentage for 201
    });

    it('should include endpoint response samples with headers', async () => {
      const endpoint = createEndpoint({
        responseSamples: [
          {
            body: '{"success": true, "data": "test"}',
            headers: { 'content-type': 'application/json', 'x-request-id': 'abc123' },
            statusCode: 200,
          },
          {
            body: '{"success": true, "data": "test2"}',
            headers: { 'content-type': 'application/json' },
            statusCode: 200,
          },
        ],
      });

      const summary = createBaseSummary({ endpoints: [endpoint] });
      const result = await exporter.export(summary);

      expect(result).toContain('View Response Samples');
      expect(result).toContain('Status 200');
      expect(result).toContain('Headers');
      expect(result).toContain('content-type');
      expect(result).toContain('application/json');
      expect(result).toContain('success'); // from body
    });

    it('should include endpoint response samples without headers', async () => {
      const endpoint = createEndpoint({
        responseSamples: [
          {
            body: '{"success": true}',
            headers: {},
            statusCode: 200,
          },
        ],
      });

      const summary = createBaseSummary({ endpoints: [endpoint] });
      const result = await exporter.export(summary);

      expect(result).toContain('View Response Samples');
      // Should not have Headers section when no headers
      expect(result).not.toContain('<summary>Headers</summary>');
    });

    it('should handle endpoint with no response samples', async () => {
      const endpoint = createEndpoint({
        responseSamples: [],
      });

      const summary = createBaseSummary({ endpoints: [endpoint] });
      const result = await exporter.export(summary);

      expect(result).toContain('Per-Endpoint Details');
      // Response Samples section should not appear when empty
      expect(result).not.toContain('View Response Samples');
    });

    it('should format endpoint latency details with fallback (no histogram)', async () => {
      const endpoint = createEndpoint({
        histogram: createHistogram({
          buckets: [],
          max: 100,
          min: 10,
          percentiles: {},
          totalCount: 0,
        }),
        method: 'POST',
      });

      const summary = createBaseSummary({ endpoints: [endpoint] });
      const result = await exporter.export(summary);

      expect(result).toContain('Endpoint Latency Details');
      expect(result).toContain('10.00ms'); // min
      expect(result).toContain('50.00ms'); // p50
      expect(result).toContain('80.00ms'); // p95
      expect(result).toContain('95.00ms'); // p99
      expect(result).toContain('100.00ms'); // max
    });

    it('should sort status codes numerically', async () => {
      const endpoint = createEndpoint({
        statusCodeDistribution: {
          200: 900,
          201: 20,
          400: 30,
          500: 50,
        },
      });

      const summary = createBaseSummary({ endpoints: [endpoint] });
      const result = await exporter.export(summary);

      expect(result).toBeDefined();

      // Check that 200 comes before 201, 400, 500 in the output
      const status200Index = result!.indexOf('| 200 |');
      const status201Index = result!.indexOf('| 201 |');
      const status400Index = result!.indexOf('| 400 |');
      const status500Index = result!.indexOf('| 500 |');

      expect(status200Index).toBeLessThan(status201Index);
      expect(status201Index).toBeLessThan(status400Index);
      expect(status400Index).toBeLessThan(status500Index);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero total requests (no latency distribution)', async () => {
      const summary = createBaseSummary({
        global: {
          ...createBaseSummary().global,
          failedRequests: 0,
          successfulRequests: 0,
          totalRequests: 0,
        },
      });

      const result = await exporter.export(summary);

      // When totalRequests is 0, the latency distribution section is not added
      expect(result).not.toContain('Latency Distribution');
    });

    it('should handle empty config requests', async () => {
      const config: TressiConfig = {
        $schema: 'test',
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
      };

      const summary = createBaseSummary({ configSnapshot: config });
      const result = await exporter.export(summary);

      expect(result).toContain('Test Configuration');
      expect(result).toContain('Configured Endpoints');
    });

    it('should handle large numbers formatting', async () => {
      const summary = createBaseSummary({
        global: {
          ...createBaseSummary().global,
          failedRequests: 1000,
          networkBytesReceived: 1024 * 1024 * 1024 * 5, // 5 GB
          networkBytesSent: 1024 * 1024 * 1024 * 2, // 2 GB
          successfulRequests: 999000,
          totalRequests: 1000000,
        },
      });

      const result = await exporter.export(summary);

      expect(result).toContain('1,000,000'); // formatted with commas
      expect(result).toContain('2 GB');
      expect(result).toContain('5 GB');
    });
  });
});
