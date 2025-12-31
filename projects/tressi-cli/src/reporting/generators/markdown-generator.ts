import { TressiConfig } from '../../common/config/types';
import { ReportingUtils } from '../../utils/reporting-utils';
import {
  EndpointSummary,
  ReportMetadata,
  RequestResult,
  TestSummary,
} from '../types';

interface LatencyDistribution {
  getTotalCount(): number;
  getLatencyDistribution(options: {
    count: number;
    chartWidth: number;
  }): Array<{
    latency: string;
    count: string;
    percent: string;
    cumulative: string;
    chart: string;
  }>;
}

interface RunnerInterface {
  getDistribution(): LatencyDistribution;
  getStatusCodeMap(): Record<number, number>;
  getSampledResults(): RequestResult[];
}

/**
 * Generates a Markdown report from a summary object.
 */
export class MarkdownGenerator {
  /**
   * Generates a comprehensive Markdown report from test summary data.
   */
  generate(
    summary: TestSummary,
    runner: RunnerInterface,
    config: TressiConfig,
    metadata?: ReportMetadata,
  ): string {
    const { global: g, endpoints: e } = summary;

    const distribution = runner.getDistribution();

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

    // Generate warnings
    const warnings = this.generateWarnings(g, e);
    if (warnings.length > 0) {
      md += this.formatWarnings(warnings);
    }

    // Configuration section
    md += this.formatConfiguration(config);

    // Global summary
    md += this.formatGlobalSummary(g);

    // Latency distribution
    if (distribution.getTotalCount() > 0) {
      md += this.formatLatencyDistribution(distribution);
    }

    // Error summary
    if (g.failedRequests > 0) {
      md += this.formatErrorSummary(g.failedRequests);
    }

    // Status code summary
    const statusCodeMap: Record<number, number> = runner.getStatusCodeMap();
    if (Object.keys(statusCodeMap).length > 0) {
      md += this.formatStatusCodeSummary(statusCodeMap);
    }

    // Sampled responses
    const sampledResults = runner.getSampledResults();
    const sampledResponses = sampledResults.filter(
      (r: RequestResult) => r.body,
    );
    if (sampledResponses.length > 0) {
      md += this.formatSampledResponses(sampledResponses);
    }

    // Endpoint summary
    if (e.length > 0) {
      md += this.formatEndpointSummary(e);
    }

    return md;
  }

  private generateWarnings(
    _global: TestSummary['global'],
    endpoints: EndpointSummary[],
  ): string[] {
    const warnings: string[] = [];

    for (const endpoint of endpoints) {
      const failureRate =
        (endpoint.failedRequests / endpoint.totalRequests) * 100;
      if (failureRate > 10) {
        warnings.push(
          `**High Failure Rate**: The endpoint \`${endpoint.url}\` had a failure rate of ${failureRate}%. This may indicate a problem under load.`,
        );
      }
    }

    return warnings;
  }

  private formatWarnings(warnings: string[]): string {
    let md = `## Analysis & Warnings ⚠️\n\n`;
    md += `> *This section highlights potential performance issues or configuration problems detected during the test.*\n\n`;
    for (const warning of warnings) {
      md += `* ${warning}\n`;
    }
    md += `\n`;

    return md;
  }

  private formatConfiguration(config: TressiConfig): string {
    let md = `<details>\n`;
    md += `<summary>View Full Test Configuration</summary>\n\n`;
    md += '```json\n';
    md += `${JSON.stringify(config, null, 2)}\n`;
    md += '```\n\n';
    md += `</details>\n\n`;

    md += `## Run Configuration\n\n`;
    md += `> *This table shows the main parameters used for the load test run.*\n\n`;
    md += `| Option | Setting | Argument |\n`;
    md += `|---|---|---|\n`;
    md += `| Concurrency | Adaptive (based on system metrics) | N/A |\n`;
    md += `| Duration | ${config.options.durationSec}s | \`--duration\` |\n\n`;

    return md;
  }

  private formatGlobalSummary(global: TestSummary['global']): string {
    let md = `## Global Summary\n\n`;
    md += `> *A high-level overview of the entire test performance across all endpoints.*\n\n`;
    md += `| Stat | Value |\n| --- | --- |\n`;
    md += `| Duration | ${global.duration}s |\n`;
    md += `| Total Requests | ${global.totalRequests} |\n`;
    md += `| Successful | ${global.successfulRequests} |\n`;
    md += `| Failed | ${global.failedRequests} |\n`;
    md += `| Req/s | ${global.actualRps} |\n`;
    md += `| Req/m | ${global.actualRps * 60} |\n`;
    md += `| Avg Latency | ${global.avgLatencyMs}ms |\n`;
    md += `| Min Latency | ${global.minLatencyMs}ms |\n`;
    md += `| Max Latency | ${global.maxLatencyMs}ms |\n`;
    md += `| p95 Latency | ${global.p95LatencyMs}ms |\n`;
    md += `| p99 Latency | ${global.p99LatencyMs}ms |\n\n`;

    return md;
  }

  private formatLatencyDistribution(distribution: LatencyDistribution): string {
    const distributionResult = distribution.getLatencyDistribution({
      count: 8,
      chartWidth: 20,
    });

    let md = `## Latency Distribution\n\n`;
    md += `> *This table shows how request latencies were distributed. **% of Total** is the percentage of requests that fell into that specific time range. **Cumulative %** is the running total, showing the percentage of requests at or below that latency.*\n\n`;
    md += `| Range (ms) | Count | % of Total | Cumulative % | Chart |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const bucket of distributionResult) {
      if (bucket.count === '0') continue;
      md += `| ${bucket.latency}ms | ${bucket.count} | ${bucket.percent} | ${bucket.cumulative} | ${bucket.chart} |\n`;
    }
    md += `\n`;

    return md;
  }

  private formatErrorSummary(failedRequests: number): string {
    let md = `## Error Summary\n\n`;
    md += `> *A total of ${failedRequests} requests failed. Detailed error messages are available in the raw log (if exported).*\n\n`;
    return md;
  }

  private formatStatusCodeSummary(
    statusCodeMap: Record<number, number>,
  ): string {
    const statusCodeDistribution =
      ReportingUtils.getStatusCodeDistributionByCategory(statusCodeMap);

    let md = `## Responses by Status Code\n\n`;
    md += `> *A breakdown of all responses by their HTTP status code categories.\n\n`;
    md += `| Status Code Category | Count |\n`;
    md += `|---|---|\n`;
    for (const [category, count] of Object.entries(statusCodeDistribution)) {
      md += `| ${category} | ${count} |\n`;
    }
    md += `\n`;

    return md;
  }

  private formatSampledResponses(sampledResponses: RequestResult[]): string {
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

    let md = `## Sampled Responses by Endpoint\n\n`;
    md += `> *A sample response body for each unique status code received per endpoint. This is useful for debugging unexpected responses.*\n\n`;

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

    return md;
  }

  private formatEndpointSummary(endpoints: EndpointSummary[]): string {
    let md = `## Endpoint Summary\n\n`;
    md += `> *A summary of request outcomes for each endpoint.*\n\n`;
    md += `| Endpoint | Success | Failed |\n`;
    md += `|---|---|---|\n`;
    for (const endpoint of endpoints) {
      md += `| ${endpoint.method} ${endpoint.url} | ${endpoint.successfulRequests} | ${endpoint.failedRequests} |\n`;
    }
    md += `\n`;

    md += `## Endpoint Latency\n\n`;
    md += `> *A detailed latency breakdown for each individual API endpoint.*\n\n`;
    md += `| Endpoint | Avg | Min | Max | P95 | P99 |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const endpoint of endpoints) {
      md += `| ${endpoint.method} ${endpoint.url} | ${endpoint.avgLatencyMs}ms | ${endpoint.minLatencyMs}ms | ${endpoint.maxLatencyMs}ms | ${endpoint.p95LatencyMs}ms | ${endpoint.p99LatencyMs}ms |\n`;
    }

    return md;
  }
}
