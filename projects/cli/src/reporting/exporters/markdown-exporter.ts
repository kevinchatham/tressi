import { writeFile } from 'node:fs/promises';
import type {
  EndpointSummary,
  LatencyHistogramBucket,
  TestSummary,
  TressiConfig,
} from '@tressi/shared/common';

import { ReportingUtils } from '../../utils/reporting-utils';
import { aggregateStatusCodesFromEndpoints } from '../utils/status-code-aggregator';
import { validateMarkdownPath } from '../utils/validation';

/**
 * Exports test results as a comprehensive Markdown report.
 * Replaces the deprecated MarkdownGenerator class with direct data access.
 */
export class MarkdownExporter {
  /**
   * Exports test summary data as a comprehensive Markdown report.
   *
   * @param summary - The test summary containing global and endpoint statistics
   * @param path - Optional file path to write the markdown to (returns string if undefined)
   * @param responseSamples - Optional response samples collected during load testing
   * @param metadata - Optional metadata about the test run
   * @returns A formatted Markdown string representing the test report (or void if path provided)
   */
  async export(summary: TestSummary, path?: string): Promise<undefined | string> {
    try {
      const { global: g, endpoints: e } = summary;
      const config = summary.configSnapshot;

      let md = '# Tressi Load Test Report\n\n';

      md += '| Metric | Value |\n';
      md += '|---|---|\n';
      md += `| Version | ${summary.tressiVersion} |\n`;
      md += `| Test Time | ${new Date(summary.global.epochStartedAt).toLocaleString()} |\n`;
      md += `| Duration | ${summary.global.finalDurationSec}s |\n`;
      md += '\n';

      // Generate warnings
      const warnings = this._generateWarnings(e);
      if (warnings.length > 0) {
        md += this._formatWarnings(warnings);
      }

      // Configuration section
      md += this._formatConfiguration(config);

      // Global summary
      md += this._formatGlobalSummary(g);

      // Latency distribution
      if (g.totalRequests > 0) {
        md += this._formatLatencyDistributionFromSummary(summary);
      }

      // Error summary
      if (g.failedRequests > 0) {
        md += this._formatErrorSummary(g.failedRequests);
      }

      // Status code summary
      const statusCodeMap = this._aggregateStatusCodesFromEndpoints(e);
      if (Object.keys(statusCodeMap).length > 0) {
        md += this._formatStatusCodeSummary(statusCodeMap);
      }

      // Endpoint summary (includes per-endpoint details and samples)
      if (e.length > 0) {
        md += this._formatEndpointSummary(e);
      }

      if (path) {
        validateMarkdownPath(path);
        await writeFile(path, md, 'utf-8');
        return;
      } else {
        return md;
      }
    } catch (error) {
      throw new Error(`Failed to export test summary to Markdown: ${(error as Error).message}`);
    }
  }

  /**
   * Aggregates status codes from all endpoints into a single map.
   */
  private _aggregateStatusCodesFromEndpoints(endpoints: EndpointSummary[]): Record<number, number> {
    return aggregateStatusCodesFromEndpoints(endpoints);
  }

  /**
   * Generates latency distribution from real histogram data.
   */
  private _formatLatencyDistributionFromSummary(summary: TestSummary): string {
    const { global: g } = summary;

    let md = '## Latency Distribution\n\n';
    md +=
      '> *This table shows how request latencies were distributed based on actual test data.*\n\n';

    if (g.histogram && g.histogram.totalCount > 0) {
      const h = g.histogram;

      // NEW: ASCII histogram chart
      md += '### Latency Histogram\n\n';
      md += '```\n';
      md += this._generateAsciiHistogram(h.buckets);
      md += '```\n\n';

      // Add real percentile summary
      md += '### Global Latency Percentiles\n\n';
      md += '| Percentile | Latency (ms) |\n';
      md += '|---|---|\n';
      md += `| Min | ${h.min.toFixed(2)}ms |\n`;
      md += `| 1st | ${(h.percentiles[1] || 0).toFixed(2)}ms |\n`;
      md += `| 5th | ${(h.percentiles[5] || 0).toFixed(2)}ms |\n`;
      md += `| 10th | ${(h.percentiles[10] || 0).toFixed(2)}ms |\n`;
      md += `| 25th | ${(h.percentiles[25] || 0).toFixed(2)}ms |\n`;
      md += `| 50th | ${(h.percentiles[50] || 0).toFixed(2)}ms |\n`;
      md += `| 75th | ${(h.percentiles[75] || 0).toFixed(2)}ms |\n`;
      md += `| 90th | ${(h.percentiles[90] || 0).toFixed(2)}ms |\n`;
      md += `| 95th | ${(h.percentiles[95] || 0).toFixed(2)}ms |\n`;
      md += `| 99th | ${(h.percentiles[99] || 0).toFixed(2)}ms |\n`;
      md += `| Max | ${h.max.toFixed(2)}ms |\n`;
      md += `| Total Requests | ${h.totalCount.toLocaleString()} |\n`;
      md += '\n';

      // NEW: Bucket distribution table
      if (h.buckets.length > 0) {
        md += '### Latency Bucket Distribution\n\n';
        md += '| Range (ms) | Count | Percentage |\n';
        md += '|---|---|---|\n';
        for (const bucket of h.buckets) {
          const percentage = ((bucket.count / h.totalCount) * 100).toFixed(1);
          md += `| ${bucket.lowerBound.toFixed(1)} - ${bucket.upperBound.toFixed(1)} | ${bucket.count.toLocaleString()} | ${percentage}% |\n`;
        }
        md += '\n';
      }
    } else {
      // Fallback to basic percentiles if no histogram data
      md += '### Key Percentiles\n\n';
      md += '| Percentile | Latency |\n';
      md += '|---|---|\n';
      md += `| 50th | ${g.p50LatencyMs}ms |\n`;
      md += `| 95th | ${g.p95LatencyMs}ms |\n`;
      md += `| 99th | ${g.p99LatencyMs}ms |\n`;
      md += '\n';
    }

    return md;
  }

  /**
   * Generate ASCII histogram for markdown output
   */
  private _generateAsciiHistogram(buckets: Array<LatencyHistogramBucket>): string {
    if (buckets.length === 0) {
      return 'No histogram data available\n';
    }

    const maxCount = Math.max(...buckets.map((b) => b.count));
    const maxBarWidth = 40;
    const totalCount = buckets.reduce((sum, b) => sum + b.count, 0);

    let chart = 'Latency Distribution:\n\n';
    for (const bucket of buckets) {
      const barWidth = Math.round((bucket.count / maxCount) * maxBarWidth);
      const bar = '█'.repeat(barWidth);
      const empty = '░'.repeat(maxBarWidth - barWidth);
      const label = `${bucket.lowerBound.toFixed(0)}-${bucket.upperBound.toFixed(0)}ms`;
      const percentage = ((bucket.count / totalCount) * 100).toFixed(1);
      chart += `${label.padEnd(15)} ${bar}${empty} ${bucket.count.toLocaleString().padStart(6)} (${percentage}%)\n`;
    }
    return chart;
  }

  private _generateWarnings(endpoints: EndpointSummary[]): string[] {
    const warnings: string[] = [];

    for (const endpoint of endpoints) {
      const failureRate = endpoint.errorRate * 100;
      if (failureRate > 10) {
        warnings.push(
          `**High Failure Rate**: The endpoint \`${endpoint.url}\` had a failure rate of ${failureRate.toFixed(1)}%. This may indicate a problem under load.`,
        );
      }
    }

    return warnings;
  }

  private _formatWarnings(warnings: string[]): string {
    let md = '## Analysis & Warnings ⚠️\n\n';
    md +=
      '> *This section highlights potential performance issues or configuration problems detected during the test.*\n\n';
    for (const warning of warnings) {
      md += `* ${warning}\n`;
    }
    md += '\n';

    return md;
  }

  private _formatConfiguration(config: TressiConfig): string {
    let md = '## Test Configuration\n\n';

    md += '### Global Options\n\n';
    md += '| Option | Value |\n';
    md += '|---|---|\n';
    md += `| Duration | ${config.options?.durationSec ?? 'N/A'}s |\n`;
    md += `| Threads | ${config.options?.threads ?? 'N/A'} |\n`;
    md += `| Worker Memory Limit | ${config.options?.workerMemoryLimit ?? 'N/A'} MB |\n`;
    md += `| Ramp Up Duration | ${config.options?.rampUpDurationSec ?? 0}s |\n`;

    if (config.options?.workerEarlyExit?.enabled) {
      md += `| Early Exit | Enabled (Threshold: ${config.options.workerEarlyExit.errorRateThreshold}%) |\n`;
    } else {
      md += '| Early Exit | Disabled |\n';
    }
    md += '\n';

    md += '### Configured Endpoints\n\n';
    md += '| Method | URL | Target RPS | Ramp Up |\n';
    md += '|---|---|---|---|\n';
    for (const req of config.requests) {
      md += `| ${req.method} | \`${req.url}\` | ${req.rps} | ${req.rampUpDurationSec ?? 0}s |\n`;
    }
    md += '\n';

    md += '<details>\n';
    md += '<summary>View Full JSON Configuration</summary>\n\n';
    md += '```json\n';
    md += `${JSON.stringify(config, null, 2)}\n`;
    md += '```\n\n';
    md += '</details>\n\n';
    return md;
  }

  private _formatGlobalSummary(global: TestSummary['global']): string {
    let md = '## Global Summary\n\n';
    md += '> *A high-level overview of the entire test performance across all endpoints.*\n\n';

    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
    };

    md += '| Stat | Value |\n| --- | --- |\n';
    md += `| Duration | ${global.finalDurationSec}s |\n`;
    md += `| Total Requests | ${global.totalRequests.toLocaleString()} |\n`;
    md += `| Successful | ${global.successfulRequests.toLocaleString()} |\n`;
    md += `| Failed | ${global.failedRequests.toLocaleString()} |\n`;
    md += `| Error Rate | ${(global.errorRate * 100).toFixed(2)}% |\n`;
    if (global.histogram && global.histogram.totalCount > 0) {
      const h = global.histogram;
      md += `| Min Latency | ${h.min.toFixed(2)}ms |\n`;
      md += `| p50 Latency | ${h.percentiles[50].toFixed(2)}ms |\n`;
      md += `| p95 Latency | ${h.percentiles[95].toFixed(2)}ms |\n`;
      md += `| p99 Latency | ${h.percentiles[99].toFixed(2)}ms |\n`;
      md += `| Max Latency | ${h.max.toFixed(2)}ms |\n`;
    } else {
      md += `| Min Latency | ${global.minLatencyMs.toFixed(2)}ms |\n`;
      md += `| p50 Latency | ${global.p50LatencyMs.toFixed(2)}ms |\n`;
      md += `| p95 Latency | ${global.p95LatencyMs.toFixed(2)}ms |\n`;
      md += `| p99 Latency | ${global.p99LatencyMs.toFixed(2)}ms |\n`;
      md += `| Max Latency | ${global.maxLatencyMs.toFixed(2)}ms |\n`;
    }
    md += `| Average RPS | ${global.averageRequestsPerSecond.toFixed(2)} |\n`;
    md += `| Peak RPS | ${global.peakRequestsPerSecond.toFixed(2)} |\n`;
    md += `| Network Sent | ${formatBytes(global.networkBytesSent)} |\n`;
    md += `| Network Received | ${formatBytes(global.networkBytesReceived)} |\n`;
    md += `| Network Throughput | ${formatBytes(global.networkBytesPerSec)}/s |\n`;
    md += `| Target Achieved | ${(global.targetAchieved * 100).toFixed(1)}% |\n`;
    md += `| CPU Usage | ${global.avgSystemCpuUsagePercent.toFixed(1)}% |\n`;
    md += `| Memory Usage | ${global.avgProcessMemoryUsageMB.toFixed(1)} MB |\n`;
    md += `| Test Started | ${new Date(global.epochStartedAt).toLocaleString()} |\n`;
    md += `| Test Ended | ${new Date(global.epochEndedAt).toLocaleString()} |\n`;
    return md;
  }

  private _formatErrorSummary(failedRequests: number): string {
    let md = '## Error Summary\n\n';
    md += `> *A total of ${failedRequests} requests failed. Detailed error messages are available in the raw log (if exported).*\n\n`;
    return md;
  }

  private _formatStatusCodeSummary(statusCodeMap: Record<number, number>): string {
    const statusCodeDistribution =
      ReportingUtils.getStatusCodeDistributionByCategory(statusCodeMap);

    let md = '## Responses by Status Code\n\n';
    md += '> *A breakdown of all responses by their HTTP status code categories.*\n\n';

    // Category breakdown
    md += '| Status Code Category | Count |\n';
    md += '|---|---|\n';
    for (const [category, count] of Object.entries(statusCodeDistribution)) {
      md += `| ${category} | ${count} |\n`;
    }
    md += '\n';

    // Individual status codes if there are any
    const individualCodes = Object.entries(statusCodeMap)
      .filter(([_code, count]) => count > 0)
      .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10));

    if (individualCodes.length > 0) {
      md += '### Individual Status Codes\n\n';
      md += '| Status Code | Count |\n';
      md += '|---|---|\n';
      for (const [code, count] of individualCodes) {
        md += `| ${code} | ${count} |\n`;
      }
      md += '\n';
    }

    return md;
  }

  private _formatEndpointSummary(endpoints: EndpointSummary[]): string {
    let md = '## Endpoint Summary\n\n';
    md +=
      '> *A comprehensive summary of request outcomes and performance metrics for each endpoint.*\n\n';

    // First table - Request counts and rates
    md += '### Request Counts and Rates\n\n';
    md +=
      '| Endpoint | Total | Success | Failed | Error Rate | Avg RPS | Peak RPS | Target Achieved |\n';
    md += '|---|---|---|---|---|---|---|---|\n';
    for (const endpoint of endpoints) {
      const targetAchieved = (endpoint.targetAchieved * 100).toFixed(1);
      const errorRate = (endpoint.errorRate * 100).toFixed(2);
      md += `| ${endpoint.method} ${endpoint.url} | ${endpoint.totalRequests} | ${endpoint.successfulRequests} | ${endpoint.failedRequests} | ${errorRate}% | ${endpoint.averageRequestsPerSecond.toFixed(2)} | ${endpoint.peakRequestsPerSecond.toFixed(2)} | ${targetAchieved}% |\n`;
    }
    md += '\n';

    // Second table - Enhanced latency details with histogram data
    md += '### Endpoint Latency Details\n\n';
    md += '| Endpoint | Min | P1 | P5 | P10 | P25 | P50 | P75 | P90 | P95 | P99 | Max |\n';
    md += '|---|---|---|---|---|---|---|---|---|---|---|---|\n';
    for (const endpoint of endpoints) {
      if (endpoint.histogram && endpoint.histogram.totalCount > 0) {
        const h = endpoint.histogram;
        md += `| ${endpoint.method} ${endpoint.url} | ${h.min.toFixed(2)}ms | ${h.percentiles[1].toFixed(2)}ms | ${h.percentiles[5].toFixed(2)}ms | ${h.percentiles[10].toFixed(2)}ms | ${h.percentiles[25].toFixed(2)}ms | ${h.percentiles[50].toFixed(2)}ms | ${h.percentiles[75].toFixed(2)}ms | ${h.percentiles[90].toFixed(2)}ms | ${h.percentiles[95].toFixed(2)}ms | ${h.percentiles[99].toFixed(2)}ms | ${h.max.toFixed(2)}ms |\n`;
      } else {
        // Fallback if no histogram data
        md += `| ${endpoint.method} ${endpoint.url} | ${endpoint.minLatencyMs.toFixed(2)}ms | - | - | - | - | ${endpoint.p50LatencyMs.toFixed(2)}ms | - | - | ${endpoint.p95LatencyMs.toFixed(2)}ms | ${endpoint.p99LatencyMs.toFixed(2)}ms | ${endpoint.maxLatencyMs.toFixed(2)}ms |\n`;
      }
    }

    // Third section - Per-endpoint status codes and samples
    md += '\n### Per-Endpoint Details\n\n';
    for (const endpoint of endpoints) {
      md += `#### ${endpoint.method} ${endpoint.url}\n\n`;

      // Status code distribution for this endpoint
      md += '**Status Code Distribution:**\n\n';
      md += '| Status Code | Count | Percentage |\n';
      md += '|---|---|---|\n';
      const codes = Object.entries(endpoint.statusCodeDistribution).sort(
        ([a], [b]) => parseInt(a, 10) - parseInt(b, 10),
      );
      for (const [code, count] of codes) {
        const percentage = ((count / endpoint.totalRequests) * 100).toFixed(1);
        md += `| ${code} | ${count.toLocaleString()} | ${percentage}% |\n`;
      }
      md += '\n';

      // Histogram for this endpoint
      if (endpoint.histogram && endpoint.histogram.totalCount > 0) {
        md += '<details>\n';
        md += '<summary>View Latency Histogram</summary>\n\n';
        md += '```\n';
        md += this._generateAsciiHistogram(endpoint.histogram.buckets);
        md += '```\n\n';
        md += '</details>\n\n';
      }

      // Samples for this endpoint
      if (endpoint.responseSamples && endpoint.responseSamples.length > 0) {
        md += '<details>\n';
        md += '<summary>View Response Samples</summary>\n\n';

        // Group samples by status code
        const uniqueSamples = new Map<number, (typeof endpoint.responseSamples)[0]>();
        for (const sample of endpoint.responseSamples) {
          if (!uniqueSamples.has(sample.statusCode)) {
            uniqueSamples.set(sample.statusCode, sample);
          }
        }

        Array.from(uniqueSamples.values())
          .sort((a, b) => a.statusCode - b.statusCode)
          .forEach((sample) => {
            md += `**Status ${sample.statusCode}**\n\n`;
            if (Object.keys(sample.headers).length > 0) {
              md += '<details>\n<summary>Headers</summary>\n\n';
              md += '```json\n';
              md += `${JSON.stringify(sample.headers, null, 2)}\n`;
              md += '```\n\n';
              md += '</details>\n\n';
            }
            md += '```\n';
            md += `${sample.body || '(No body captured)'}`;
            md += '\n```\n\n';
          });

        md += '</details>\n\n';
      }
      md += '---\n\n';
    }

    return md;
  }
}
