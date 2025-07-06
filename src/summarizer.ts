import { RunOptions } from '.';
import { average, percentile, RequestResult } from './stats';

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
  theoreticalMaxRps?: number;
  achievedPercentage?: number;
}

export interface Summary {
  global: GlobalSummary;
  endpoints: EndpointSummary[];
}

/**
 * Analyzes the results of a load test and generates a structured summary.
 * @param results An array of `RequestResult` objects from the test run.
 * @param options The original `RunOptions` used for the test.
 * @returns A `Summary` object containing global and per-endpoint statistics.
 */
export function generateSummary(
  results: RequestResult[],
  options: RunOptions,
): Summary {
  const { durationSec = 10, rps, rampUpTimeSec } = options;

  // Global calculations
  const latencies = results.map((r) => r.latencyMs);
  const totalRequests = results.length;
  const successfulRequests = results.filter((r) => r.success).length;
  const failedRequests = totalRequests - successfulRequests;
  const actualRps = totalRequests / durationSec;

  let theoreticalMaxRps: number | undefined;
  let achievedPercentage: number | undefined;

  if (rps) {
    const rampUpRequests = rampUpTimeSec ? (rps / 2) * rampUpTimeSec : 0;
    const steadyStateDuration = rampUpTimeSec
      ? durationSec - rampUpTimeSec
      : durationSec;
    const steadyStateRequests = rps * steadyStateDuration;
    theoreticalMaxRps = Math.round(rampUpRequests + steadyStateRequests);
    achievedPercentage = Math.ceil((totalRequests / theoreticalMaxRps) * 100);
  }

  const globalSummary: GlobalSummary = {
    totalRequests,
    successfulRequests,
    failedRequests,
    avgLatencyMs: average(latencies),
    minLatencyMs: Math.min(...latencies),
    maxLatencyMs: Math.max(...latencies),
    p95LatencyMs: percentile(latencies, 95),
    p99LatencyMs: percentile(latencies, 99),
    actualRps,
    theoreticalMaxRps,
    achievedPercentage,
  };

  // Endpoint calculations
  const resultsByUrl: Record<string, RequestResult[]> = results.reduce(
    (acc, r) => {
      if (!acc[r.url]) {
        acc[r.url] = [];
      }
      acc[r.url].push(r);
      return acc;
    },
    {} as Record<string, RequestResult[]>,
  );

  const endpointSummaries: EndpointSummary[] = Object.entries(resultsByUrl)
    .sort(([urlA], [urlB]) => urlA.localeCompare(urlB))
    .map(([url, endpointResults]) => {
      const endpointLatencies = endpointResults.map((r) => r.latencyMs);
      const total = endpointResults.length;
      const successful = endpointResults.filter((r) => r.success).length;
      const failed = total - successful;

      return {
        url,
        totalRequests: total,
        successfulRequests: successful,
        failedRequests: failed,
        avgLatencyMs: average(endpointLatencies),
        p95LatencyMs: percentile(endpointLatencies, 95),
        p99LatencyMs: percentile(endpointLatencies, 99),
      };
    });

  return {
    global: globalSummary,
    endpoints: endpointSummaries,
  };
}

/**
 * Generates a Markdown report from a summary object.
 * @param summary The summary object to convert to Markdown.
 * @returns A string containing the Markdown report.
 */
export function generateMarkdownReport(summary: Summary): string {
  const { global: g, endpoints: e } = summary;

  let md = `# Load Test Report\n\n`;
  md += `## Global Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|---|---|\n`;
  md += `| Total Requests | ${g.totalRequests} |\n`;
  md += `| Successful | ${g.successfulRequests} |\n`;
  md += `| Failed | ${g.failedRequests} |\n`;
  md += `| Avg Latency (ms) | ${g.avgLatencyMs.toFixed(0)} |\n`;
  md += `| P95 Latency (ms) | ${g.p95LatencyMs.toFixed(0)} |\n`;
  md += `| P99 Latency (ms) | ${g.p99LatencyMs.toFixed(0)} |\n\n`;

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
