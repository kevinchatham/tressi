import { build, Histogram } from 'hdr-histogram-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { generateTestSummary } from '../../../src';
import { MarkdownGenerator } from '../../../src/reporting/generators/markdown-generator';
import { Distribution } from '../../../src/stats';
import { TressiConfig, TressiOptionsConfig } from '../../../src/types';

const createHistogram = (latencies: number[]): Histogram => {
  const histogram = build();
  for (const l of latencies) {
    histogram.recordValue(l);
  }
  return histogram;
};

const mockResultAggregator: {
  getSampledResults: () => Array<{
    method: string;
    url: string;
    latencyMs: number;
    status: number;
    success: boolean;
    timestamp: number;
    body: string;
    error?: string;
  }>;
  getGlobalHistogram: () => Histogram;
  getEndpointHistograms: () => Map<string, Histogram>;
  getStatusCodeMap: () => Record<number, number>;
  getSuccessfulRequestsCount: () => number;
  getFailedRequestsCount: () => number;
  getSuccessfulRequestsByEndpoint: () => Map<string, number>;
  getFailedRequestsByEndpoint: () => Map<string, number>;
  getDistribution: () => Distribution;
} = {
  getSampledResults: () => [
    {
      method: 'GET',
      url: 'http://a.com',
      latencyMs: 100,
      status: 200,
      success: true,
      timestamp: 1,
      body: '{"ok":true}',
    },
    {
      method: 'GET',
      url: 'http://a.com',
      latencyMs: 150,
      status: 200,
      success: true,
      timestamp: 2,
      body: '{"ok":true}',
    },
    {
      method: 'GET',
      url: 'http://b.com',
      latencyMs: 200,
      status: 200,
      success: true,
      timestamp: 3,
      body: '{"ok":true}',
    },
    {
      method: 'GET',
      url: 'http://b.com',
      latencyMs: 500,
      status: 500,
      success: false,
      error: 'Error',
      timestamp: 4,
      body: '{"error":"Internal Server Error"}',
    },
  ],
  getGlobalHistogram: (): Histogram => createHistogram([100, 150, 200, 500]),
  getEndpointHistograms: (): Map<string, Histogram> => {
    const map = new Map<string, Histogram>();
    map.set('GET http://a.com', createHistogram([100, 150]));
    map.set('GET http://b.com', createHistogram([200, 500]));
    return map;
  },
  getStatusCodeMap: (): Record<number, number> => ({ 200: 3, 500: 1 }),
  getSuccessfulRequestsCount: (): number => 3,
  getFailedRequestsCount: (): number => 1,
  getSuccessfulRequestsByEndpoint: (): Map<string, number> => {
    const map = new Map<string, number>();
    map.set('GET http://a.com', 2);
    map.set('GET http://b.com', 1);
    return map;
  },
  getFailedRequestsByEndpoint: (): Map<string, number> => {
    const map = new Map<string, number>();
    map.set('GET http://a.com', 0);
    map.set('GET http://b.com', 1);
    return map;
  },
  getDistribution: (): Distribution => {
    const distribution = new Distribution();
    [100, 150, 200, 500].forEach((l) => distribution.add(l));
    return distribution;
  },
};

const mockOptions: TressiOptionsConfig = {
  durationSec: 10,
  rampUpTimeSec: 0,
  useUI: true,
  silent: false,
  earlyExitOnError: false,
};

const mockConfig: TressiConfig = {
  $schema: 'https://example.com/schema.json',
  requests: [{ url: 'http://a.com', method: 'GET' }],
  options: mockOptions,
};

/**
 * Test suite for the summary generation logic using the new architecture.
 */
describe('summarizer', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T03:00:00.000Z'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  /**
   * It should correctly calculate all global statistics for a given set of results.
   */
  it('should generate an accurate global summary', () => {
    const summary = generateTestSummary(mockResultAggregator, mockOptions, 10);
    const { global: g } = summary;

    expect(g.totalRequests).toBe(4);
    expect(g.successfulRequests).toBe(3);
    expect(g.failedRequests).toBe(1);
    expect(g.avgLatencyMs).toBeCloseTo(237.5);
    expect(g.minLatencyMs).toBe(100);
    expect(g.maxLatencyMs).toBe(500);
    expect(g.p95LatencyMs).toBe(500);
    expect(g.actualRps).toBe(0.4);
    expect(g.theoreticalMaxRps).toBeCloseTo(10);
    expect(g.achievedPercentage).toBeCloseTo(4);
  });

  /**
   * It should correctly aggregate results by URL and calculate statistics for each endpoint.
   */
  it('should generate an accurate summary for each endpoint', () => {
    const summary = generateTestSummary(mockResultAggregator, mockOptions, 10);
    const { endpoints: e } = summary;

    expect(e).toHaveLength(2);

    const summaryA = e.find((s) => s.url === 'http://a.com');
    expect(summaryA).toBeDefined();
    expect(summaryA?.method).toBe('GET');
    expect(summaryA?.totalRequests).toBe(2);
    expect(summaryA?.successfulRequests).toBe(2);
    expect(summaryA?.failedRequests).toBe(0);
    expect(summaryA?.avgLatencyMs).toBe(125);
    expect(summaryA?.p95LatencyMs).toBe(150);

    const summaryB = e.find((s) => s.url === 'http://b.com');
    expect(summaryB).toBeDefined();
    expect(summaryB?.method).toBe('GET');
    expect(summaryB?.totalRequests).toBe(2);
    expect(summaryB?.successfulRequests).toBe(1);
    expect(summaryB?.failedRequests).toBe(1);
    expect(summaryB?.avgLatencyMs).toBe(350);
    expect(summaryB?.p95LatencyMs).toBe(500);
  });

  /**
   * It should generate a Markdown report containing all summary sections.
   */
  it('should generate a comprehensive Markdown report', () => {
    const summary = generateTestSummary(mockResultAggregator, mockOptions, 10);
    const metadata = {
      exportName: 'my-test-report',
      runDate: new Date('2023-01-01T03:00:00.000Z'),
    };

    // Create a mock runner interface for the markdown generator
    const mockRunnerInterface: {
      getDistribution: () => Distribution;
      getStatusCodeMap: () => Record<number, number>;
      getSampledResults: () => Array<{
        method: string;
        url: string;
        latencyMs: number;
        status: number;
        success: boolean;
        timestamp: number;
        body: string;
        error?: string;
      }>;
    } = {
      getDistribution: (): Distribution =>
        mockResultAggregator.getDistribution(),
      getStatusCodeMap: (): Record<number, number> =>
        mockResultAggregator.getStatusCodeMap(),
      getSampledResults: (): Array<{
        method: string;
        url: string;
        latencyMs: number;
        status: number;
        success: boolean;
        timestamp: number;
        body: string;
        error?: string;
      }> => mockResultAggregator.getSampledResults(),
    };

    const markdownGenerator = new MarkdownGenerator();
    const markdown = markdownGenerator.generate(
      summary,
      mockRunnerInterface,
      mockConfig,
      metadata,
    );

    // Test key structural elements instead of full snapshot
    expect(markdown).toContain('# Tressi Load Test Report');
    expect(markdown).toContain('## Global Summary');
    expect(markdown).toContain('## Endpoint Summary');
    expect(markdown).toContain('## Latency Distribution');
    expect(markdown).toContain('| Total Requests | 4 |');
    expect(markdown).toContain('| Successful | 3 |');
    expect(markdown).toContain('| Failed | 1 |');
    expect(markdown).toContain('GET http://a.com');
    expect(markdown).toContain('GET http://b.com');
  });
});
