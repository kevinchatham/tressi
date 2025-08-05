/**
 * Metrics export utility for tressi performance monitoring
 * Provides methods to export collected metrics in various formats
 */

import { writeFile } from 'fs/promises';

import { PerformanceMonitor } from './perf-monitor';

/**
 * Export formats supported
 */
export type ExportFormat = 'json' | 'csv' | 'html' | 'markdown';

/**
 * Metrics export configuration
 */
export interface ExportConfig {
  format: ExportFormat;
  outputPath?: string;
  includeSummary?: boolean;
  includeRawData?: boolean;
  timestamp?: boolean;
}

/**
 * Type definitions for metrics data
 */
interface RequestMetric {
  id: string;
  endpointKey: string;
  startTime: number;
  phases: Array<{
    phase: string;
    duration: number;
  }>;
  totalDuration: number;
  success: boolean;
  statusCode?: number;
  error?: string;
}

interface ResourceMetric {
  timestamp: number;
  connectionPool: {
    activeConnections: number;
    idleConnections: number;
    totalConnections: number;
    pendingRequests: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external?: number;
    arrayBuffers?: number;
  };
  workers?: {
    activeCount: number;
    scalingEvents: number;
    averageConcurrency: number;
  };
}

interface RateLimitMetric {
  timestamp: number;
  endpointKey: string;
  bucketState: {
    currentTokens: number;
    capacity: number;
    refillRate: number;
    utilization: number;
  };
  throttling: {
    queueDepth: number;
    averageWaitTime: number;
    maxWaitTime: number;
    rejectedRequests: number;
  };
  tokenFlow: {
    acquired: number;
    failed: number;
    averageAcquisitionTime: number;
  };
}

interface ShutdownMetric {
  totalDuration: number;
  activeRequests: number;
  drainedRequests: number;
  connectionCleanupDuration: number;
  resourceDeallocationDuration: number;
}

interface MetricsData {
  summary?: {
    requests: {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      averageLatency: number;
    };
    resources: {
      averageMemoryUsage: number;
      peakMemoryUsage: number;
      averageActiveConnections: number;
      scalingEvents: number;
    };
    rateLimits: Record<
      string,
      {
        averageUtilization: number;
        averageQueueDepth: number;
        averageWaitTime: number;
        totalAcquired: number;
        totalFailed: number;
      }
    >;
  };
  requestMetrics?: RequestMetric[];
  resourceMetrics?: ResourceMetric[];
  rateLimitMetrics?: Record<string, RateLimitMetric[]>;
  shutdownMetrics?: ShutdownMetric;
}

/**
 * Metrics exporter class
 */
export class MetricsExporter {
  private perfMonitor: PerformanceMonitor;

  constructor() {
    this.perfMonitor = PerformanceMonitor.getInstance();
  }

  /**
   * Export metrics to specified format
   * @param config Export configuration
   * @returns Promise resolving to the exported content
   */
  async export(config: ExportConfig): Promise<string> {
    const metrics = this.perfMonitor.exportMetrics() as unknown as MetricsData;
    const timestamp =
      config.timestamp !== false ? new Date().toISOString() : '';

    let content = '';

    switch (config.format) {
      case 'json':
        content = this.exportToJson(metrics, config.includeSummary);
        break;
      case 'csv':
        content = this.exportToCsv(metrics);
        break;
      case 'html':
        content = this.exportToHtml(metrics, timestamp);
        break;
      case 'markdown':
        content = this.exportToMarkdown(metrics, timestamp);
        break;
      default:
        throw new Error(`Unsupported export format: ${config.format}`);
    }

    if (config.outputPath) {
      await writeFile(config.outputPath, content, 'utf-8');
    }

    return content;
  }

  /**
   * Export metrics to JSON format
   */
  private exportToJson(metrics: MetricsData, includeSummary = true): string {
    const exportData = {
      metadata: {
        exportTime: new Date().toISOString(),
        version: '1.0.0',
      },
      ...(includeSummary && { summary: metrics.summary }),
      ...(metrics.requestMetrics && { requestMetrics: metrics.requestMetrics }),
      ...(metrics.resourceMetrics && {
        resourceMetrics: metrics.resourceMetrics,
      }),
      ...(metrics.rateLimitMetrics && {
        rateLimitMetrics: metrics.rateLimitMetrics,
      }),
      ...(metrics.shutdownMetrics && {
        shutdownMetrics: metrics.shutdownMetrics,
      }),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export metrics to CSV format
   */
  private exportToCsv(metrics: MetricsData): string {
    const lines: string[] = [];

    // Request metrics CSV
    if (metrics.requestMetrics && metrics.requestMetrics.length > 0) {
      lines.push('# Request Metrics');
      const requestHeaders = [
        'id',
        'endpointKey',
        'startTime',
        'totalDuration',
        'success',
        'statusCode',
        'error',
      ];
      lines.push(requestHeaders.join(','));

      for (const req of metrics.requestMetrics) {
        const row = [
          req.id,
          req.endpointKey,
          req.startTime,
          req.totalDuration.toString(),
          req.success.toString(),
          req.statusCode?.toString() || '',
          req.error || '',
        ];
        lines.push(row.join(','));
      }
      lines.push('');
    }

    // Resource metrics CSV
    if (metrics.resourceMetrics && metrics.resourceMetrics.length > 0) {
      lines.push('# Resource Metrics');
      const resourceHeaders = [
        'timestamp',
        'activeConnections',
        'idleConnections',
        'totalConnections',
        'pendingRequests',
        'heapUsed',
        'heapTotal',
      ];
      lines.push(resourceHeaders.join(','));

      for (const res of metrics.resourceMetrics) {
        const row = [
          res.timestamp,
          res.connectionPool.activeConnections.toString(),
          res.connectionPool.idleConnections.toString(),
          res.connectionPool.totalConnections.toString(),
          res.connectionPool.pendingRequests.toString(),
          res.memory.heapUsed.toString(),
          res.memory.heapTotal.toString(),
        ];
        lines.push(row.join(','));
      }
      lines.push('');
    }

    // Rate limit metrics CSV
    if (metrics.rateLimitMetrics) {
      lines.push('# Rate Limit Metrics');
      const rateHeaders = [
        'timestamp',
        'endpointKey',
        'currentTokens',
        'capacity',
        'refillRate',
        'utilization',
        'queueDepth',
        'averageWaitTime',
      ];
      lines.push(rateHeaders.join(','));

      for (const [endpointKey, metricsList] of Object.entries(
        metrics.rateLimitMetrics,
      )) {
        for (const metric of metricsList) {
          const row = [
            metric.timestamp,
            endpointKey,
            metric.bucketState.currentTokens.toString(),
            metric.bucketState.capacity.toString(),
            metric.bucketState.refillRate.toString(),
            metric.bucketState.utilization.toString(),
            metric.throttling.queueDepth.toString(),
            metric.throttling.averageWaitTime.toString(),
          ];
          lines.push(row.join(','));
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Export metrics to HTML format
   */
  private exportToHtml(metrics: MetricsData, timestamp: string): string {
    const requestRows =
      metrics.requestMetrics
        ?.slice(0, 100)
        .map(
          (req) => `
                <tr>
                    <td>${req.endpointKey}</td>
                    <td>${req.totalDuration.toFixed(2)}</td>
                    <td>${req.success}</td>
                    <td>${req.statusCode || 'N/A'}</td>
                </tr>
                `,
        )
        .join('') || '';

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Tressi Performance Metrics</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric-section { margin: 20px 0; }
        .metric-table { border-collapse: collapse; width: 100%; }
        .metric-table th, .metric-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .metric-table th { background-color: #f2f2f2; }
        .summary { background-color: #f9f9f9; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Tressi Performance Metrics</h1>
    <p>Generated: ${timestamp}</p>
    
    ${
      metrics.summary
        ? `
    <div class="summary">
        <h2>Summary</h2>
        <h3>Requests</h3>
        <ul>
            <li>Total Requests: ${metrics.summary.requests.totalRequests}</li>
            <li>Successful Requests: ${metrics.summary.requests.successfulRequests}</li>
            <li>Failed Requests: ${metrics.summary.requests.failedRequests}</li>
            <li>Average Latency: ${metrics.summary.requests.averageLatency.toFixed(2)}ms</li>
        </ul>
        
        <h3>Resources</h3>
        <ul>
            <li>Average Memory Usage: ${(metrics.summary.resources.averageMemoryUsage / 1024 / 1024).toFixed(2)}MB</li>
            <li>Peak Memory Usage: ${(metrics.summary.resources.peakMemoryUsage / 1024 / 1024).toFixed(2)}MB</li>
            <li>Average Active Connections: ${metrics.summary.resources.averageActiveConnections}</li>
            <li>Scaling Events: ${metrics.summary.resources.scalingEvents}</li>
        </ul>
    </div>
    `
        : ''
    }
    
    ${
      metrics.shutdownMetrics
        ? `
    <div class="metric-section">
        <h2>Shutdown Analysis</h2>
        <ul>
            <li>Total Duration: ${metrics.shutdownMetrics.totalDuration}ms</li>
            <li>Active Requests: ${metrics.shutdownMetrics.activeRequests}</li>
            <li>Drained Requests: ${metrics.shutdownMetrics.drainedRequests}</li>
            <li>Connection Cleanup: ${metrics.shutdownMetrics.connectionCleanupDuration}ms</li>
            <li>Resource Deallocation: ${metrics.shutdownMetrics.resourceDeallocationDuration}ms</li>
        </ul>
    </div>
    `
        : ''
    }
    
    ${
      metrics.requestMetrics && metrics.requestMetrics.length > 0
        ? `
    <div class="metric-section">
        <h2>Request Metrics</h2>
        <table class="metric-table">
            <thead>
                <tr>
                    <th>Endpoint</th>
                    <th>Duration (ms)</th>
                    <th>Success</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${requestRows}
            </tbody>
        </table>
    </div>
    `
        : ''
    }
</body>
</html>
    `.trim();
  }

  /**
   * Export metrics to Markdown format
   */
  private exportToMarkdown(metrics: MetricsData, timestamp: string): string {
    let md = `# Tressi Performance Metrics\n\nGenerated: ${timestamp}\n\n`;

    if (metrics.summary) {
      md += `## Summary\n\n`;
      md += `### Requests\n`;
      md += `- Total Requests: ${metrics.summary.requests.totalRequests}\n`;
      md += `- Successful Requests: ${metrics.summary.requests.successfulRequests}\n`;
      md += `- Failed Requests: ${metrics.summary.requests.failedRequests}\n`;
      md += `- Average Latency: ${metrics.summary.requests.averageLatency.toFixed(2)}ms\n\n`;

      md += `### Resources\n`;
      md += `- Average Memory Usage: ${(metrics.summary.resources.averageMemoryUsage / 1024 / 1024).toFixed(2)}MB\n`;
      md += `- Peak Memory Usage: ${(metrics.summary.resources.peakMemoryUsage / 1024 / 1024).toFixed(2)}MB\n`;
      md += `- Average Active Connections: ${metrics.summary.resources.averageActiveConnections}\n`;
      md += `- Scaling Events: ${metrics.summary.resources.scalingEvents}\n\n`;
    }

    if (metrics.shutdownMetrics) {
      md += `## Shutdown Analysis\n\n`;
      md += `- Total Duration: ${metrics.shutdownMetrics.totalDuration}ms\n`;
      md += `- Active Requests: ${metrics.shutdownMetrics.activeRequests}\n`;
      md += `- Drained Requests: ${metrics.shutdownMetrics.drainedRequests}\n`;
      md += `- Connection Cleanup: ${metrics.shutdownMetrics.connectionCleanupDuration}ms\n`;
      md += `- Resource Deallocation: ${metrics.shutdownMetrics.resourceDeallocationDuration}ms\n\n`;
    }

    if (metrics.summary?.rateLimits) {
      md += `## Rate Limiting Summary\n\n`;
      for (const [endpoint, summary] of Object.entries(
        metrics.summary.rateLimits,
      )) {
        md += `### ${endpoint}\n`;
        md += `- Average Utilization: ${(summary.averageUtilization * 100).toFixed(1)}%\n`;
        md += `- Average Queue Depth: ${summary.averageQueueDepth}\n`;
        md += `- Average Wait Time: ${summary.averageWaitTime.toFixed(2)}ms\n`;
        md += `- Total Acquired: ${summary.totalAcquired}\n`;
        md += `- Total Failed: ${summary.totalFailed}\n\n`;
      }
    }

    return md;
  }

  /**
   * Get quick summary of metrics
   */
  getSummary(): string {
    const metrics = this.perfMonitor.exportMetrics() as unknown as MetricsData;
    const summary = metrics.summary;

    if (!summary) {
      return 'No metrics data available';
    }

    return `
Tressi Performance Summary:
- Total Requests: ${summary.requests.totalRequests}
- Success Rate: ${((summary.requests.successfulRequests / summary.requests.totalRequests) * 100).toFixed(1)}%
- Average Latency: ${summary.requests.averageLatency.toFixed(2)}ms
- Peak Memory: ${(summary.resources.peakMemoryUsage / 1024 / 1024).toFixed(2)}MB
- Active Connections: ${summary.resources.averageActiveConnections}
- Scaling Events: ${summary.resources.scalingEvents}
    `.trim();
  }
}

// Export singleton instance
export const metricsExporter = new MetricsExporter();
