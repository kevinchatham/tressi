import { TressiConfig } from './config';
import { RunOptions } from './index';
import { average, percentile, RequestResult } from './stats';

export interface ReportMetadata {
  exportName?: string;
  runDate?: Date;
}

export interface EndpointSummary {
  url: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
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
  global: GlobalSummary;
  endpoints: EndpointSummary[];
}

/**
 * Analyzes the results of a load test and generates a comprehensive summary.
 * @param results An array of `RequestResult` objects from the test run.
 * @param options The original `RunOptions` used for the test.
 * @returns A `TestSummary` object containing the global and endpoint-specific summaries.
 */
export function generateSummary(
  results: RequestResult[],
  options: RunOptions,
  actualDurationSec?: number,
): TestSummary {
  if (results.length === 0) {
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
    };
  }

  const { durationSec = 10, rps } = options;
  const totalRequests = results.length;
  const allLatencies = results.map((r) => r.latencyMs);
  const effectiveDuration = actualDurationSec ?? durationSec;
  const actualRps =
    effectiveDuration > 0 ? totalRequests / effectiveDuration : 0;
  const avgLatency = average(allLatencies);
  const theoreticalMaxRps = rps
    ? Math.min(
        (1000 / (avgLatency || 1)) * (options.workers || 10),
        options.rps || Infinity,
      )
    : 0;
  const achievedPercentage =
    rps && theoreticalMaxRps ? (actualRps / theoreticalMaxRps) * 100 : 0;

  const requestsByEndpoint = results.reduce(
    (acc, result) => {
      if (!acc[result.url]) {
        acc[result.url] = [];
      }
      acc[result.url].push(result);
      return acc;
    },
    {} as Record<string, RequestResult[]>,
  );

  const endpointSummaries = Object.values(requestsByEndpoint).map(
    (endpointResults): EndpointSummary => {
      const latencies = endpointResults.map((r) => r.latencyMs);
      return {
        url: endpointResults[0].url,
        totalRequests: endpointResults.length,
        successfulRequests: endpointResults.filter((r) => r.status < 400)
          .length,
        failedRequests: endpointResults.filter((r) => r.status >= 400).length,
        avgLatencyMs: average(latencies),
        p95LatencyMs: percentile(latencies, 0.95),
        p99LatencyMs: percentile(latencies, 0.99),
      };
    },
  );

  return {
    global: {
      totalRequests,
      successfulRequests: results.filter((r) => r.status < 400).length,
      failedRequests: results.filter((r) => r.status >= 400).length,
      avgLatencyMs: avgLatency,
      minLatencyMs: Math.min(...allLatencies),
      maxLatencyMs: Math.max(...allLatencies),
      p95LatencyMs: percentile(allLatencies, 0.95),
      p99LatencyMs: percentile(allLatencies, 0.99),
      actualRps,
      theoreticalMaxRps,
      achievedPercentage,
      duration: effectiveDuration,
    },
    endpoints: endpointSummaries,
  };
}

/**
 * Generates a Markdown report from a summary object.
 * @param summary The `TestSummary` object.
 * @param options The original `RunOptions` used for the test.
 * @param results The raw `RequestResult` array.
 * @param config The `TressiConfig` used for the run.
 * @param metadata Additional metadata for the report.
 * @returns A Markdown string representing the report.
 */
export function generateMarkdownReport(
  summary: TestSummary,
  options: RunOptions,
  results: RequestResult[],
  config: TressiConfig,
  metadata?: ReportMetadata,
): string {
  const { global: g, endpoints: e } = summary;
  const { workers = 10, durationSec = 10, rps, autoscale } = options;

  let md = `# Tressi Load Test Report\n\n`;

  if (metadata?.exportName) {
    md += `**Export Name:** ${metadata.exportName}\n\n`;
  }

  if (metadata?.runDate) {
    md += `**Test Time:** ${metadata.runDate.toLocaleString()}\n\n`;
  }

  // Analysis & Warnings
  const warnings: string[] = [];
  if (rps && g.achievedPercentage && g.achievedPercentage < 80) {
    warnings.push(
      `**Target RPS Unreachable**: The target of ${rps} RPS was not met. The test achieved ~${g.actualRps.toFixed(
        0,
      )} RPS (${
        g.achievedPercentage
      }% of the target). Consider increasing workers or optimizing the service.`,
    );
  }
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
  md += `| Option | Setting |\n`;
  md += `|---|---|\n`;
  md += `| Workers | ${autoscale ? `Up to ${workers}` : workers} |\n`;
  md += `| Duration | ${durationSec}s |\n`;
  if (rps) md += `| Target RPS | ${rps} |\n`;
  if (autoscale) md += `| Autoscale | Enabled |\n\n`;

  // Global Summary
  md += `## Global Summary\n\n`;
  md += `| Stat | Value |\n| --- | --- |\n`;
  md += `| Total Requests | ${g.totalRequests} |\n`;
  md += `| Successful | ${g.successfulRequests} |\n`;
  md += `| Failed | ${g.failedRequests} |\n`;

  if (options.rps && g.theoreticalMaxRps) {
    md += `| Req/s (Actual/Target) | ${g.actualRps.toFixed(0)} / ${
      options.rps
    } |\n`;
    md += `| Req/m (Actual/Target) | ${(g.actualRps * 60).toFixed(
      0,
    )} / ${options.rps * 60} |\n`;
    md += `| Theoretical Max Req/s | ${g.theoreticalMaxRps.toFixed(0)} |\n`;
    md += `| Achieved % | ${g.achievedPercentage.toFixed(0)}% |\n`;
  } else {
    md += `| Req/s | ${g.actualRps.toFixed(0)} |\n`;
    md += `| Req/m | ${(g.actualRps * 60).toFixed(0)} |\n`;
  }

  md += `| Avg Latency (ms) | ${g.avgLatencyMs.toFixed(0)} |\n`;
  md += `| p95 Latency (ms) | ${g.p95LatencyMs.toFixed(0)} |\n`;
  md += `| p99 Latency (ms) | ${g.p99LatencyMs.toFixed(0)} |\n\n`;

  // Latency Distribution
  const latencies = results.map((r) => r.latencyMs);
  if (latencies.length > 0) {
    const min = g.minLatencyMs;
    const max = g.maxLatencyMs;
    const numBuckets = 8;
    const range = max - min;

    const buckets = new Array(numBuckets).fill(0);
    const labels: string[] = [];

    if (range === 0) {
      // If all latencies are the same, create a single bucket
      labels.push(`${min}ms`);
      buckets[0] = latencies.length;
    } else {
      const bucketSize = Math.ceil(range / numBuckets);
      for (let i = 0; i < numBuckets; i++) {
        const lower = Math.floor(min + i * bucketSize);
        const upper = Math.floor(min + (i + 1) * bucketSize - 1);
        labels.push(`${lower}-${upper}ms`);
      }

      for (const latency of latencies) {
        if (latency === max) {
          buckets[numBuckets - 1]++;
        } else {
          const bucketIndex = Math.floor((latency - min) / bucketSize);
          buckets[bucketIndex]++;
        }
      }
    }

    md += `## Latency Distribution\n\n`;
    md += `| Range | Count | Chart |\n`;
    md += `|---|---|---|\n`;

    const maxCount = Math.max(...buckets);
    for (let i = 0; i < labels.length; i++) {
      const count = buckets[i];
      if (count === 0) continue;

      const barLength = maxCount > 0 ? Math.round((count / maxCount) * 20) : 0;
      const bar = '█'.repeat(barLength);
      const percentage = ((count / latencies.length) * 100).toFixed(1);
      md += `| ${labels[i]} | ${count} | \`${bar}\` (${percentage}%) |\n`;
    }
    md += `\n`;
  }

  // Error Summary
  const errors = results.filter((r) => r.error);
  if (errors.length > 0) {
    const errorMap: Record<string, number> = errors.reduce(
      (acc, r) => {
        const errorKey = r.error || 'Unknown Error';
        acc[errorKey] = (acc[errorKey] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    md += `## Error Summary\n\n`;
    md += `| Count | Error Message |\n`;
    md += `|---|---|\n`;
    for (const [error, count] of Object.entries(errorMap).sort(
      (a, b) => b[1] - a[1],
    )) {
      md += `| ${count} | ${error} |\n`;
    }
    md += `\n`;
  }

  // Status Code Summary
  const statusCodeMap: Record<number, number> = results.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {} as Record<number, number>,
  );

  if (Object.keys(statusCodeMap).length > 0) {
    md += `## Responses by Status Code\n\n`;
    md += `| Status Code | Count |\n`;
    md += `|---|---|\n`;
    for (const [code, count] of Object.entries(statusCodeMap).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      md += `| ${code} | ${count} |\n`;
    }
    md += `\n`;
  }

  // Endpoint Summary
  if (e.length > 0) {
    md += `## Endpoint Summary\n\n`;
    md += `| URL | Total | Success | Failed | Avg Latency (ms) | P95 Latency (ms) |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const endpoint of e) {
      md += `| ${endpoint.url} | ${endpoint.totalRequests} | ${
        endpoint.successfulRequests
      } | ${endpoint.failedRequests} | ${endpoint.avgLatencyMs.toFixed(
        0,
      )} | ${endpoint.p95LatencyMs.toFixed(0)} |\n`;
    }
  }

  return md;
}
