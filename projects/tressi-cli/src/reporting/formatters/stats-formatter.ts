import {
  EndpointSummary,
  FormattedStats,
  GlobalSummary,
  TestSummary,
} from '../../types/reporting/types';

/**
 * Formats statistics for display and export purposes
 */
export class StatsFormatter {
  /**
   * Formats test summary statistics with proper number formatting
   */
  format(summary: TestSummary): FormattedStats {
    return {
      global: this.formatGlobalStats(summary.global),
      endpoints: summary.endpoints.map((endpoint) =>
        this.formatEndpointStats(endpoint),
      ),
    };
  }

  private formatGlobalStats(global: GlobalSummary): FormattedStats['global'] {
    return {
      totalRequests: this.formatNumber(global.totalRequests),
      successfulRequests: this.formatNumber(global.successfulRequests),
      failedRequests: this.formatNumber(global.failedRequests),
      avgLatencyMs: this.formatLatency(global.avgLatencyMs),
      minLatencyMs: this.formatLatency(global.minLatencyMs),
      maxLatencyMs: this.formatLatency(global.maxLatencyMs),
      p95LatencyMs: this.formatLatency(global.p95LatencyMs),
      p99LatencyMs: this.formatLatency(global.p99LatencyMs),
      actualRps: this.formatRps(global.actualRps),
      theoreticalMaxRps: this.formatRps(global.theoreticalMaxRps),
      achievedPercentage: this.formatPercentage(global.achievedPercentage),
      duration: this.formatDuration(global.duration),
    };
  }

  private formatEndpointStats(
    endpoint: EndpointSummary,
  ): FormattedStats['endpoints'][0] {
    const failureRate =
      endpoint.totalRequests > 0
        ? (endpoint.failedRequests / endpoint.totalRequests) * 100
        : 0;

    return {
      method: endpoint.method,
      url: endpoint.url,
      totalRequests: this.formatNumber(endpoint.totalRequests),
      successfulRequests: this.formatNumber(endpoint.successfulRequests),
      failedRequests: this.formatNumber(endpoint.failedRequests),
      avgLatencyMs: this.formatLatency(endpoint.avgLatencyMs),
      minLatencyMs: this.formatLatency(endpoint.minLatencyMs),
      maxLatencyMs: this.formatLatency(endpoint.maxLatencyMs),
      p95LatencyMs: this.formatLatency(endpoint.p95LatencyMs),
      p99LatencyMs: this.formatLatency(endpoint.p99LatencyMs),
      failureRate: this.formatPercentage(failureRate),
    };
  }

  /**
   * Formats a number with thousands separators
   */
  private formatNumber(num: number): string {
    return num.toLocaleString();
  }

  /**
   * Formats latency in milliseconds with appropriate precision
   */
  private formatLatency(ms: number): string {
    if (ms < 1) return `${ms.toFixed(2)}ms`;
    if (ms < 10) return `${ms.toFixed(1)}ms`;
    return `${Math.round(ms)}ms`;
  }

  /**
   * Formats requests per second with appropriate precision
   */
  private formatRps(rps: number): string {
    if (rps === 0) return '0';
    if (rps < 1) return rps.toFixed(2);
    if (rps < 10) return rps.toFixed(1);
    return Math.round(rps).toLocaleString();
  }

  /**
   * Formats percentage with appropriate precision
   */
  private formatPercentage(percentage: number): string {
    if (percentage === 0) return '0%';
    if (percentage < 0.1) return `${percentage.toFixed(2)}%`;
    if (percentage < 1) return `${percentage.toFixed(1)}%`;
    return `${Math.round(percentage)}%`;
  }

  /**
   * Formats duration in seconds
   */
  private formatDuration(seconds: number): string {
    if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  }

  /**
   * Creates a summary string for console output
   */
  createSummaryString(summary: TestSummary): string {
    const formatted = this.format(summary);
    const { global: g } = formatted;

    return [
      `Total: ${g.totalRequests} requests`,
      `Success: ${g.successfulRequests} (${this.calculateSuccessRate(summary.global)}%)`,
      `Failed: ${g.failedRequests} (${this.calculateFailureRate(summary.global)}%)`,
      `Avg Latency: ${g.avgLatencyMs}`,
      `p95 Latency: ${g.p95LatencyMs}`,
      `RPS: ${g.actualRps}`,
      `Duration: ${g.duration}`,
    ].join(' | ');
  }

  /**
   * Creates a detailed summary for logging
   */
  createDetailedSummary(summary: TestSummary): string {
    const formatted = this.format(summary);
    const lines: string[] = [];

    // Global summary
    lines.push('=== GLOBAL SUMMARY ===');
    lines.push(`Total Requests: ${formatted.global.totalRequests}`);
    lines.push(`Successful: ${formatted.global.successfulRequests}`);
    lines.push(`Failed: ${formatted.global.failedRequests}`);
    lines.push(`Success Rate: ${this.calculateSuccessRate(summary.global)}%`);
    lines.push(`Average Latency: ${formatted.global.avgLatencyMs}`);
    lines.push(
      `Min/Max Latency: ${formatted.global.minLatencyMs} / ${formatted.global.maxLatencyMs}`,
    );
    lines.push(
      `p95/p99 Latency: ${formatted.global.p95LatencyMs} / ${formatted.global.p99LatencyMs}`,
    );
    lines.push(`Actual RPS: ${formatted.global.actualRps}`);

    if (summary.global.theoreticalMaxRps > 0) {
      lines.push(`Theoretical Max RPS: ${formatted.global.theoreticalMaxRps}`);
      lines.push(`Achieved Percentage: ${formatted.global.achievedPercentage}`);
    }

    lines.push(`Duration: ${formatted.global.duration}`);
    lines.push('');

    // Endpoint summary
    if (formatted.endpoints.length > 0) {
      lines.push('=== ENDPOINT SUMMARY ===');
      for (const endpoint of formatted.endpoints) {
        lines.push(`${endpoint.method} ${endpoint.url}`);
        lines.push(
          `  Total: ${endpoint.totalRequests} | Success: ${endpoint.successfulRequests} | Failed: ${endpoint.failedRequests}`,
        );
        lines.push(`  Failure Rate: ${endpoint.failureRate}`);
        lines.push(
          `  Avg Latency: ${endpoint.avgLatencyMs} | p95: ${endpoint.p95LatencyMs} | p99: ${endpoint.p99LatencyMs}`,
        );
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private calculateSuccessRate(global: GlobalSummary): string {
    if (global.totalRequests === 0) return '0.0';
    const rate = (global.successfulRequests / global.totalRequests) * 100;
    return rate.toFixed(1);
  }

  private calculateFailureRate(global: GlobalSummary): string {
    if (global.totalRequests === 0) return '0.0';
    const rate = (global.failedRequests / global.totalRequests) * 100;
    return rate.toFixed(1);
  }
}
