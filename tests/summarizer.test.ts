import { describe, expect, it } from 'vitest';

import { RunOptions } from '../src';
import { TressiConfig } from '../src/config';
import { RequestResult } from '../src/stats';
import { generateMarkdownReport, generateSummary } from '../src/summarizer';

const mockResults: RequestResult[] = [
  {
    url: 'http://a.com',
    latencyMs: 100,
    status: 200,
    success: true,
    timestamp: 1,
  },
  {
    url: 'http://a.com',
    latencyMs: 150,
    status: 200,
    success: true,
    timestamp: 2,
  },
  {
    url: 'http://b.com',
    latencyMs: 200,
    status: 200,
    success: true,
    timestamp: 3,
  },
  {
    url: 'http://b.com',
    latencyMs: 500,
    status: 500,
    success: false,
    error: 'Error',
    timestamp: 4,
  },
];

const mockOptions: RunOptions = {
  config: { requests: [] },
  durationSec: 10,
  rps: 1, // 10 requests total theoretical
};

const mockConfig: TressiConfig = {
  requests: [{ url: 'http://a.com', method: 'GET' }],
};

/**
 * Test suite for the summary generation logic.
 */
describe('summarizer', () => {
  /**
   * It should correctly calculate all global statistics for a given set of results.
   */
  it('should generate an accurate global summary', () => {
    const summary = generateSummary(mockResults, mockOptions);
    const { global: g } = summary;

    expect(g.totalRequests).toBe(4);
    expect(g.successfulRequests).toBe(3);
    expect(g.failedRequests).toBe(1);
    expect(g.avgLatencyMs).toBeCloseTo(237.5);
    expect(g.minLatencyMs).toBe(100);
    expect(g.maxLatencyMs).toBe(500);
    expect(g.p95LatencyMs).toBe(500);
    expect(g.actualRps).toBe(0.4);
    expect(g.theoreticalMaxRps).toBe(1);
    expect(g.achievedPercentage).toBe(40);
  });

  /**
   * It should correctly aggregate results by URL and calculate statistics for each endpoint.
   */
  it('should generate an accurate summary for each endpoint', () => {
    const summary = generateSummary(mockResults, mockOptions);
    const { endpoints: e } = summary;

    expect(e).toHaveLength(2);

    const summaryA = e.find((s) => s.url === 'http://a.com');
    expect(summaryA).toBeDefined();
    expect(summaryA?.totalRequests).toBe(2);
    expect(summaryA?.successfulRequests).toBe(2);
    expect(summaryA?.failedRequests).toBe(0);
    expect(summaryA?.avgLatencyMs).toBe(125);
    expect(summaryA?.p95LatencyMs).toBe(150);

    const summaryB = e.find((s) => s.url === 'http://b.com');
    expect(summaryB).toBeDefined();
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
    const summary = generateSummary(mockResults, mockOptions);
    const metadata = {
      exportName: 'my-test-report',
      runDate: new Date(),
    };
    const markdown = generateMarkdownReport(
      summary,
      mockOptions,
      mockResults,
      mockConfig,
      metadata,
    );

    expect(markdown).toContain(`# Tressi Load Test Report`);
    expect(markdown).toContain(`**Export Name:** ${metadata.exportName}`);
    expect(markdown).toContain(
      `**Test Time:** ${metadata.runDate.toLocaleString()}`,
    );
    expect(markdown).toContain('## Analysis & Warnings ⚠️');
    expect(markdown).toContain(
      '<summary>View Full Test Configuration</summary>',
    );
    expect(markdown).toContain('## Run Configuration');
    expect(markdown).toContain('## Global Summary');
    expect(markdown).toContain('| Req/s (Actual/Target)');
    expect(markdown).toContain('| Achieved %');
    expect(markdown).toContain('## Latency Distribution');
    expect(markdown).toContain('| Range | Count | Chart |');
    expect(markdown).toContain('## Error Summary');
    expect(markdown).toContain('## Responses by Status Code');
    expect(markdown).toContain('## Endpoint Summary');
    expect(markdown).toContain('| 200 | 3 |');
    expect(markdown).toContain('| 500 | 1 |');
    expect(markdown).toContain('| http://a.com | 2 |');
    expect(markdown).toContain('| http://b.com | 2 |');
  });
});
