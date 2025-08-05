import pkg from '../package.json';
import { TressiConfig } from './config';
import { RunOptions } from './index';
import { Runner } from './runner';
import { RequestResult } from './stats';
import { getStatusCodeDistributionByCategory } from './stats';

export interface ReportMetadata {
  exportName?: string;
  runDate?: Date;
}

export interface EndpointSummary {
  method: string;
  url: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
}

export interface GlobalSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  actualRps: number;
  theoreticalMaxRps: number;
  achievedPercentage: number;
  duration: number;
}

export interface TestSummary {
  tressiVersion: string;
  global: GlobalSummary;
  endpoints: EndpointSummary[];
}

/**
 * Analyzes the results of a load test and generates a comprehensive summary.
 * @param runner The `Runner` instance from the test run.
 * @param options The original `RunOptions` used for the test.
 * @returns A `TestSummary` object containing the global and endpoint-specific summaries.
 */
export function generateSummary(
  runner: Runner,
  options: RunOptions,
  actualDurationSec?: number,
): TestSummary {
  const histogram = runner.getHistogram();
  const endpointHistograms = runner.getEndpointHistograms();

  if (histogram.totalCount === 0) {
    // Return a default summary if no results are available.
    return {
      global: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgLatencyMs: 0,
        minLatencyMs: 0,
        maxLatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        actualRps: 0,
        theoreticalMaxRps: 0,
        achievedPercentage: 0,
        duration: 0,
      },
      endpoints: [],
      tressiVersion: pkg.version || 'unknown',
    };
  }

  const { durationSec = 10 } = options;
  const totalRequests = histogram.totalCount;
  const effectiveDuration = actualDurationSec ?? durationSec;
  const actualRps =
    effectiveDuration > 0 ? totalRequests / effectiveDuration : 0;
  const avgLatency = histogram.mean;
  const theoreticalMaxRps = 0; // No longer calculated with global RPS
  const achievedPercentage = 0; // No longer calculated with global RPS

  const endpointSummaries = Array.from(endpointHistograms.entries()).map(
    ([endpointKey, endpointHistogram]): EndpointSummary => {
      const [method, url] = endpointKey.split(' ');
      const successfulRequests =
        runner.getSuccessfulRequestsByEndpoint().get(endpointKey) || 0;
      const failedRequests =
        runner.getFailedRequestsByEndpoint().get(endpointKey) || 0;

      return {
        method,
        url,
        totalRequests: successfulRequests + failedRequests,
        successfulRequests,
        failedRequests,
        avgLatencyMs: endpointHistogram?.mean || 0,
        minLatencyMs: endpointHistogram?.minNonZeroValue || 0,
        maxLatencyMs: endpointHistogram?.maxValue || 0,
        p95LatencyMs: endpointHistogram?.getValueAtPercentile(95) || 0,
        p99LatencyMs: endpointHistogram?.getValueAtPercentile(99) || 0,
      };
    },
  );

  return {
    global: {
      totalRequests,
      successfulRequests: runner.getSuccessfulRequestsCount(),
      failedRequests: runner.getFailedRequestsCount(),
      avgLatencyMs: avgLatency,
      minLatencyMs: histogram.minNonZeroValue,
      maxLatencyMs: histogram.maxValue,
      p95LatencyMs: histogram.getValueAtPercentile(95),
      p99LatencyMs: histogram.getValueAtPercentile(99),
      actualRps,
      theoreticalMaxRps,
      achievedPercentage,
      duration: effectiveDuration,
    },
    endpoints: endpointSummaries,
    tressiVersion: pkg.version || 'unknown',
  };
}

/**
 * Generates a Markdown report from a summary object.
 * @param summary The `TestSummary` object.
 * @param options The original `RunOptions` used for the test.
 * @param runner The `Runner` instance from the test run.
 * @param config The `TressiConfig` used for the run.
 * @param metadata Additional metadata for the report.
 * @returns A Markdown string representing the report.
 */
export function generateMarkdownReport(
  summary: TestSummary,
  options: RunOptions,
  runner: Runner,
  config: TressiConfig,
  metadata?: ReportMetadata,
): string {
  const { global: g, endpoints: e } = summary;

  const distribution = runner.getDistribution();
  const { workers = 10, durationSec = 10, autoscale } = options;

  let md = `# Tressi Load Test Report\n\n`;

  md += `| Metric | Value |\n`;
  md += `|---|---|\n`;
  md += `| Version | ${summary.tressiVersion} |\n`;
  if (metadata?.exportName) {
    md += `| Export Name | ${metadata.exportName} |\n`;
  }
  if (metadata?.runDate) {
    md += `| Test Time | ${metadata.runDate.toLocaleString()} |\n`;
  }
  md += `\n`;
  const warnings: string[] = [];
  // RPS warnings are now handled per-endpoint via targetRps configuration
  for (const endpoint of e) {
    const failureRate =
      (endpoint.failedRequests / endpoint.totalRequests) * 100;
    if (failureRate > 10) {
      warnings.push(
        `**High Failure Rate**: The endpoint \`${endpoint.url}\` had a failure rate of ${failureRate.toFixed(
          1,
        )}%. This may indicate a problem under load.`,
      );
    }
  }

  if (warnings.length > 0) {
    md += `## Analysis & Warnings ⚠️\n\n`;
    md += `> *This section highlights potential performance issues or configuration problems detected during the test.*\n\n`;
    for (const warning of warnings) {
      md += `* ${warning}\n`;
    }
    md += `\n`;
  }

  md += `<details>\n`;
  md += `<summary>View Full Test Configuration</summary>\n\n`;
  md += '```json\n';
  md += `${JSON.stringify(config, null, 2)}\n`;
  md += '```\n\n';
  md += `</details>\n\n`;

  // Run Configuration
  md += `## Run Configuration\n\n`;
  md += `> *This table shows the main parameters used for the load test run.*\n\n`;
  md += `| Option | Setting | Argument |\n`;
  md += `|---|---|---|\n`;
  md += `| Workers | ${autoscale ? `Up to ${workers}` : workers} | \`--workers\` |\n`;
  md += `| Duration | ${durationSec}s | \`--duration\` |\n`;
  if (autoscale) md += `| Autoscale | Enabled | \`--autoscale\` |\n\n`;

  // Global Summary
  md += `## Global Summary\n\n`;
  md += `> *A high-level overview of the entire test performance across all endpoints.*\n\n`;
  md += `| Stat | Value |\n| --- | --- |\n`;
  md += `| Duration | ${g.duration.toFixed(0)}s |\n`;
  md += `| Total Requests | ${g.totalRequests} |\n`;
  md += `| Successful | ${g.successfulRequests} |\n`;
  md += `| Failed | ${g.failedRequests} |\n`;
  md += `| Req/s | ${g.actualRps.toFixed(0)} |\n`;
  md += `| Req/m | ${(g.actualRps * 60).toFixed(0)} |\n`;

  md += `| Avg Latency | ${g.avgLatencyMs.toFixed(0)}ms |\n`;
  md += `| Min Latency | ${g.minLatencyMs.toFixed(0)}ms |\n`;
  md += `| Max Latency | ${g.maxLatencyMs.toFixed(0)}ms |\n`;
  md += `| p95 Latency | ${g.p95LatencyMs.toFixed(0)}ms |\n`;
  md += `| p99 Latency | ${g.p99LatencyMs.toFixed(0)}ms |\n\n`;

  // Latency Distribution
  if (distribution.getTotalCount() > 0) {
    const distributionResult = distribution.getLatencyDistribution({
      count: 8,
      chartWidth: 20,
    });
    md += `## Latency Distribution\n\n`;
    md += `> *This table shows how request latencies were distributed. **% of Total** is the percentage of requests that fell into that specific time range. **Cumulative %** is the running total, showing the percentage of requests at or below that latency.*\n\n`;
    md += `| Range (ms) | Count | % of Total | Cumulative % | Chart |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const bucket of distributionResult) {
      if (bucket.count === '0') continue;
      md += `| ${bucket.latency}ms | ${bucket.count} | ${bucket.percent} | ${bucket.cumulative} | ${bucket.chart} |\n`;
    }
    md += `\n`;
  }

  // Error Summary
  if (g.failedRequests > 0) {
    md += `## Error Summary\n\n`;
    md += `> *A total of ${g.failedRequests} requests failed. Detailed error messages are available in the raw log (if exported).*\n\n`;
  }

  // Status Code Summary
  const statusCodeMap: Record<number, number> = runner.getStatusCodeMap();

  if (Object.keys(statusCodeMap).length > 0) {
    const statusCodeDistribution =
      getStatusCodeDistributionByCategory(statusCodeMap);
    md += `## Responses by Status Code\n\n`;
    md += `> *A breakdown of all responses by their HTTP status code categories.\n\n`;
    md += `| Status Code Category | Count |\n`;
    md += `|---|---|\n`;
    for (const [category, count] of Object.entries(statusCodeDistribution)) {
      md += `| ${category} | ${count} |\n`;
    }
    md += `\n`;
  }

  const sampledResults = runner.getSampledResults();
  const sampledResponses = sampledResults.filter((r) => r.body);
  if (sampledResponses.length > 0) {
    md += `## Sampled Responses by Endpoint\n\n`;
    md += `> *A sample response body for each unique status code received per endpoint. This is useful for debugging unexpected responses.*\n\n`;

    const samplesByEndpoint = sampledResponses.reduce(
      (acc, r) => {
        const key = `${r.method} ${r.url}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(r);
        return acc;
      },
      {} as Record<string, RequestResult[]>,
    );

    for (const [endpoint, samples] of Object.entries(samplesByEndpoint)) {
      md += `#### \`${endpoint}\`\n\n`;
      const uniqueSamples = new Map<number, RequestResult>();
      for (const r of samples) {
        if (!uniqueSamples.has(r.status)) {
          uniqueSamples.set(r.status, r);
        }
      }

      Array.from(uniqueSamples.values())
        .sort((a, b) => a.status - b.status)
        .forEach((r) => {
          md += `<details>\n`;
          md += `<summary><strong>${r.status}</strong></summary>\n\n`;
          md += '```\n';
          md += `${r.body || '(No body captured)'}\n`;
          md += '```\n\n';
          md += `</details>\n`;
        });
      md += `\n`;
    }
  }

  // Endpoint Summary
  if (e.length > 0) {
    md += `## Endpoint Summary\n\n`;
    md += `> *A summary of request outcomes for each endpoint.*\n\n`;
    md += `| Endpoint | Success | Failed |\n`;
    md += `|---|---|---|\n`;
    for (const endpoint of e) {
      md += `| ${endpoint.method} ${endpoint.url} | ${endpoint.successfulRequests} | ${endpoint.failedRequests} |\n`;
    }
    md += `\n`;

    md += `## Endpoint Latency\n\n`;
    md += `> *A detailed latency breakdown for each individual API endpoint.*\n\n`;
    md += `| Endpoint | Avg | Min | Max | P95 | P99 |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const endpoint of e) {
      md += `| ${endpoint.method} ${endpoint.url} | ${endpoint.avgLatencyMs.toFixed(0)}ms | ${endpoint.minLatencyMs.toFixed(0)}ms | ${endpoint.maxLatencyMs.toFixed(0)}ms | ${endpoint.p95LatencyMs.toFixed(0)}ms | ${endpoint.p99LatencyMs.toFixed(0)}ms |\n`;
    }
  }

  return md;
}
