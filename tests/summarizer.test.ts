import { build, Histogram } from 'hdr-histogram-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { RunOptions } from '../src';
import { TressiConfig } from '../src/config';
import { Distribution } from '../src/distribution';
import { Runner } from '../src/runner';
import { generateMarkdownReport, generateSummary } from '../src/summarizer';

const createHistogram = (latencies: number[]): Histogram => {
  const histogram = build();
  for (const l of latencies) {
    histogram.recordValue(l);
  }
  return histogram;
};

const mockRunner = {
  getSampledResults: () => [
    {
      method: 'GET',
      url: 'http://a.com',
      latencyMs: 100,
      status: 200,
      success: true,
      timestamp: 1,
    },
    {
      method: 'GET',
      url: 'http://a.com',
      latencyMs: 150,
      status: 200,
      success: true,
      timestamp: 2,
    },
    {
      method: 'GET',
      url: 'http://b.com',
      latencyMs: 200,
      status: 200,
      success: true,
      timestamp: 3,
    },
    {
      method: 'GET',
      url: 'http://b.com',
      latencyMs: 500,
      status: 500,
      success: false,
      error: 'Error',
      timestamp: 4,
    },
  ],
  getHistogram: () => createHistogram([100, 150, 200, 500]),
  getEndpointHistograms: () => {
    const map = new Map<string, Histogram>();
    map.set('GET http://a.com', createHistogram([100, 150]));
    map.set('GET http://b.com', createHistogram([200, 500]));
    return map;
  },
  getStatusCodeMap: () => ({ 200: 3, 500: 1 }),
  getSuccessfulRequestsCount: () => 3,
  getFailedRequestsCount: () => 1,
  getAverageLatency: () => 237.5,
  getDistribution: () => {
    const distribution = new Distribution();
    [100, 150, 200, 500].forEach((l) => distribution.add(l));
    return distribution;
  },
  getSuccessfulRequestsByEndpoint: () => {
    const map = new Map<string, number>();
    map.set('GET http://a.com', 2);
    map.set('GET http://b.com', 1);
    return map;
  },
  getFailedRequestsByEndpoint: () => {
    const map = new Map<string, number>();
    map.set('GET http://a.com', 0);
    map.set('GET http://b.com', 1);
    return map;
  },
} as unknown as Runner;

const mockOptions: RunOptions = {
  config: { requests: [] },
  durationSec: 10,
};

const mockConfig: TressiConfig = {
  requests: [{ url: 'http://a.com', method: 'GET' }],
};

/**
 * Test suite for the summary generation logic.
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
    const summary = generateSummary(mockRunner, mockOptions, 10);
    const { global: g } = summary;

    expect(g.totalRequests).toBe(4);
    expect(g.successfulRequests).toBe(3);
    expect(g.failedRequests).toBe(1);
    expect(g.avgLatencyMs).toBeCloseTo(237.5);
    expect(g.minLatencyMs).toBe(100);
    expect(g.maxLatencyMs).toBe(500);
    expect(g.p95LatencyMs).toBe(500);
    expect(g.actualRps).toBe(0.4);
    expect(g.theoreticalMaxRps).toBe(0);
    expect(g.achievedPercentage).toBe(0);
  });

  /**
   * It should correctly aggregate results by URL and calculate statistics for each endpoint.
   */
  it('should generate an accurate summary for each endpoint', () => {
    const summary = generateSummary(mockRunner, mockOptions);
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
    const summary = generateSummary(mockRunner, mockOptions, 10);
    const metadata = {
      exportName: 'my-test-report',
      runDate: new Date('2022-12-31T21:00:00.000Z'),
    };
    const markdown = generateMarkdownReport(
      summary,
      mockOptions,
      mockRunner,
      mockConfig,
      metadata,
    );

    // Check that the report contains expected sections and data
    expect(markdown).toContain('# Tressi Load Test Report');
    expect(markdown).toContain('| Metric | Value |');
    expect(markdown).toContain('Version |');
    expect(markdown).toContain('Export Name | my-test-report');
    expect(markdown).toContain('Test Time |');
    expect(markdown).toContain('## Analysis & Warnings');
    expect(markdown).toContain('## Global Summary');
    expect(markdown).toContain('## Endpoint Summary');
    expect(markdown).toContain('GET http://a.com');
    expect(markdown).toContain('GET http://b.com');
  });
});
