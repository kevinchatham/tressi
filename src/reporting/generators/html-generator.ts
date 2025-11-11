import type {
  EndpointSummary,
  ReportMetadata,
  RequestResult,
  TestSummary,
  TressiConfig,
} from '../../types';

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
 * Generates HTML reports from test summary data
 */
export class HtmlGenerator {
  /**
   * Generates a comprehensive HTML report from test summary data
   */
  generate(
    summary: TestSummary,
    runner: RunnerInterface,
    config: TressiConfig,
    metadata?: ReportMetadata,
  ): string {
    const { global: g, endpoints: e } = summary;
    const distribution = runner.getDistribution();
    const statusCodeMap: Record<number, number> = runner.getStatusCodeMap();
    const sampledResults = runner.getSampledResults();

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tressi Load Test Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 30px;
        }
        h1, h2, h3 {
            color: #2c3e50;
        }
        h1 {
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        h2 {
            border-bottom: 2px solid #ecf0f1;
            padding-bottom: 8px;
            margin-top: 30px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f8f9fa;
            font-weight: 600;
            color: #495057;
        }
        tr:hover {
            background-color: #f8f9fa;
        }
        .metric-card {
            display: inline-block;
            background: #e8f4fd;
            border-left: 4px solid #3498db;
            padding: 15px;
            margin: 10px 10px 10px 0;
            border-radius: 4px;
            min-width: 200px;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
        }
        .metric-label {
            font-size: 14px;
            color: #7f8c8d;
            margin-top: 5px;
        }
        .warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
        }
        .warning-title {
            color: #856404;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .warning-item {
            color: #856404;
            margin: 5px 0;
        }
        .config-details {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
        }
        .endpoint-sample {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 15px;
            margin: 10px 0;
        }
        .sample-header {
            font-weight: bold;
            color: #495057;
            margin-bottom: 10px;
        }
        .sample-body {
            background-color: #2c3e50;
            color: #ecf0f1;
            padding: 15px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            white-space: pre-wrap;
            overflow-x: auto;
        }
        .status-2xx { color: #27ae60; }
        .status-3xx { color: #f39c12; }
        .status-4xx { color: #e74c3c; }
        .status-5xx { color: #8e44ad; }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Tressi Load Test Report</h1>
        
        <div class="summary-grid">
            <div class="metric-card">
                <div class="metric-value">${summary.tressiVersion}</div>
                <div class="metric-label">Version</div>
            </div>
            ${
              metadata?.exportName
                ? `
            <div class="metric-card">
                <div class="metric-value">${metadata.exportName}</div>
                <div class="metric-label">Export Name</div>
            </div>
            `
                : ''
            }
            ${
              metadata?.runDate
                ? `
            <div class="metric-card">
                <div class="metric-value">${metadata.runDate.toLocaleString()}</div>
                <div class="metric-label">Test Time</div>
            </div>
            `
                : ''
            }
        </div>

        ${this.generateWarningsHtml(g, e)}

        <div class="config-details">
            <h3>Test Configuration</h3>
            <table>
                <tr><th>Option</th><th>Setting</th><th>Argument</th></tr>
                <tr><td>Concurrency</td><td>Adaptive (based on system metrics)</td><td>N/A</td></tr>
                <tr><td>Duration</td><td>${config.options.durationSec}s</td><td>--duration</td></tr>
            </table>
        </div>

        <h2>Global Summary</h2>
        <table>
            <tr><th>Stat</th><th>Value</th></tr>
            <tr><td>Duration</td><td>${g.duration.toFixed(0)}s</td></tr>
            <tr><td>Total Requests</td><td>${g.totalRequests}</td></tr>
            <tr><td>Successful</td><td>${g.successfulRequests}</td></tr>
            <tr><td>Failed</td><td>${g.failedRequests}</td></tr>
            <tr><td>Req/s</td><td>${g.actualRps.toFixed(0)}</td></tr>
            <tr><td>Req/m</td><td>${(g.actualRps * 60).toFixed(0)}</td></tr>
            <tr><td>Avg Latency</td><td>${g.avgLatencyMs.toFixed(0)}ms</td></tr>
            <tr><td>Min Latency</td><td>${g.minLatencyMs.toFixed(0)}ms</td></tr>
            <tr><td>Max Latency</td><td>${g.maxLatencyMs.toFixed(0)}ms</td></tr>
            <tr><td>p95 Latency</td><td>${g.p95LatencyMs.toFixed(0)}ms</td></tr>
            <tr><td>p99 Latency</td><td>${g.p99LatencyMs.toFixed(0)}ms</td></tr>
        </table>

        ${this.generateLatencyDistributionHtml(distribution)}

        ${
          g.failedRequests > 0
            ? `
        <h2>Error Summary</h2>
        <div class="warning">
            <div class="warning-title">Errors Detected</div>
            <div class="warning-item">A total of ${g.failedRequests} requests failed. Detailed error messages are available in the raw log (if exported).</div>
        </div>
        `
            : ''
        }

        ${this.generateStatusCodeSummaryHtml(statusCodeMap)}

        ${this.generateSampledResponsesHtml(sampledResults)}

        ${
          e.length > 0
            ? `
        <h2>Endpoint Summary</h2>
        <table>
            <tr><th>Endpoint</th><th>Success</th><th>Failed</th></tr>
            ${e
              .map(
                (endpoint) => `
            <tr>
                <td>${endpoint.method} ${endpoint.url}</td>
                <td>${endpoint.successfulRequests}</td>
                <td>${endpoint.failedRequests}</td>
            </tr>
            `,
              )
              .join('')}
        </table>

        <h2>Endpoint Latency</h2>
        <table>
            <tr><th>Endpoint</th><th>Avg</th><th>Min</th><th>Max</th><th>P95</th><th>P99</th></tr>
            ${e
              .map(
                (endpoint) => `
            <tr>
                <td>${endpoint.method} ${endpoint.url}</td>
                <td>${endpoint.avgLatencyMs.toFixed(0)}ms</td>
                <td>${endpoint.minLatencyMs.toFixed(0)}ms</td>
                <td>${endpoint.maxLatencyMs.toFixed(0)}ms</td>
                <td>${endpoint.p95LatencyMs.toFixed(0)}ms</td>
                <td>${endpoint.p99LatencyMs.toFixed(0)}ms</td>
            </tr>
            `,
              )
              .join('')}
        </table>
        `
            : ''
        }
    </div>
</body>
</html>`;

    return html;
  }

  private generateWarningsHtml(
    _global: TestSummary['global'],
    endpoints: EndpointSummary[],
  ): string {
    const warnings: string[] = [];

    for (const endpoint of endpoints) {
      const failureRate =
        (endpoint.failedRequests / endpoint.totalRequests) * 100;
      if (failureRate > 10) {
        warnings.push(
          `High Failure Rate: The endpoint <code>${endpoint.url}</code> had a failure rate of ${failureRate.toFixed(
            1,
          )}%. This may indicate a problem under load.`,
        );
      }
    }

    if (warnings.length === 0) return '';

    return `
        <div class="warning">
            <div class="warning-title">Analysis & Warnings</div>
            ${warnings.map((warning) => `<div class="warning-item">${warning}</div>`).join('')}
        </div>
    `;
  }

  private generateLatencyDistributionHtml(
    distribution: LatencyDistribution,
  ): string {
    if (distribution.getTotalCount() === 0) return '';

    const result = distribution.getLatencyDistribution({
      count: 8,
      chartWidth: 20,
    });

    const rows = result
      .filter((bucket) => bucket.count !== '0')
      .map(
        (bucket) => `
            <tr>
                <td>${bucket.latency}ms</td>
                <td>${bucket.count}</td>
                <td>${bucket.percent}</td>
                <td>${bucket.cumulative}</td>
                <td><code>${bucket.chart}</code></td>
            </tr>
        `,
      )
      .join('');

    return `
        <h2>Latency Distribution</h2>
        <table>
            <tr><th>Range (ms)</th><th>Count</th><th>% of Total</th><th>Cumulative %</th><th>Chart</th></tr>
            ${rows}
        </table>
    `;
  }

  private generateStatusCodeSummaryHtml(
    statusCodeMap: Record<number, number>,
  ): string {
    if (Object.keys(statusCodeMap).length === 0) return '';

    const statusCodeDistribution =
      this.getStatusCodeDistribution(statusCodeMap);

    const rows = Object.entries(statusCodeDistribution)
      .map(
        ([category, count]) => `
            <tr>
                <td>${category}</td>
                <td>${count}</td>
            </tr>
        `,
      )
      .join('');

    return `
        <h2>Responses by Status Code</h2>
        <table>
            <tr><th>Status Code Category</th><th>Count</th></tr>
            ${rows}
        </table>
    `;
  }

  private getStatusCodeDistribution(
    statusCodeMap: Record<number, number>,
  ): Record<string, number> {
    const distribution: Record<string, number> = {
      '1xx': 0,
      '2xx': 0,
      '3xx': 0,
      '4xx': 0,
      '5xx': 0,
    };

    for (const [statusCode, count] of Object.entries(statusCodeMap)) {
      const code = parseInt(statusCode, 10);
      const category = `${Math.floor(code / 100)}xx`;
      if (distribution[category] !== undefined) {
        distribution[category] += count;
      }
    }

    return distribution;
  }

  private generateSampledResponsesHtml(
    sampledResults: RequestResult[],
  ): string {
    const sampledResponses = sampledResults.filter((r) => r.body);
    if (sampledResponses.length === 0) return '';

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

    let html = '<h2>Sampled Responses by Endpoint</h2>';

    for (const [endpoint, samples] of Object.entries(samplesByEndpoint)) {
      const uniqueSamples = new Map<number, RequestResult>();
      for (const r of samples) {
        if (!uniqueSamples.has(r.status)) {
          uniqueSamples.set(r.status, r);
        }
      }

      html += `
            <div class="endpoint-sample">
                <div class="sample-header">${endpoint}</div>
                ${Array.from(uniqueSamples.values())
                  .sort((a, b) => a.status - b.status)
                  .map(
                    (r) => `
                    <div style="margin: 10px 0;">
                        <strong>Status ${r.status}</strong>
                        <div class="sample-body">${this.escapeHtml(r.body || '(No body captured)')}</div>
                    </div>
                `,
                  )
                  .join('')}
            </div>
        `;
    }

    return html;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#x27;');
  }
}
