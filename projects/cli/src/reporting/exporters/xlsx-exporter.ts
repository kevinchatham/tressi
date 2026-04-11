import { writeFile } from 'node:fs/promises';
import type { EndpointSummary, StatusCodeMap, TestSummary } from '@tressi/shared/common';
import * as xlsx from 'xlsx';

import { validateXlsxPath } from '../utils/validation';

/**
 * Exports test results to Excel format with unified interface
 */
export class XlsxExporter {
  /**
   * Exports test results to an Excel file with unified interface
   * @param summary - The test summary containing global and endpoint statistics
   * @param path - Optional file path to write the Excel to (returns buffer if undefined)
   * @returns Buffer when path is undefined, void when path is provided
   */
  async export(summary: TestSummary, path?: string): Promise<undefined | Buffer> {
    try {
      const { summary: processedSummary, statusCodeMap } = this._processData(summary);

      const wb = xlsx.utils.book_new();

      // Test Summary Sheet
      this._addTestSummarySheet(wb, processedSummary);

      // Endpoint Summary Sheet
      if (processedSummary.endpoints.length > 0) {
        this._addEndpointSummarySheet(wb, processedSummary.endpoints);
      }

      // Status Code Distribution Sheet
      this._addStatusCodeDistributionSheet(wb, statusCodeMap);

      // Configuration Sheet
      this._addConfigurationSheet(wb, processedSummary.configSnapshot);

      // Latency Distribution Sheet
      this._addLatencyDistributionSheet(wb, processedSummary);

      // Sampled Responses Sheet
      this._addSampledResponsesSheet(wb, processedSummary.endpoints);

      if (path) {
        validateXlsxPath(path);
        const buffer = xlsx.write(wb, { type: 'buffer' });
        await writeFile(path, buffer);
        return;
      } else {
        // Return buffer for in-memory use
        return xlsx.write(wb, { type: 'buffer' });
      }
    } catch (error) {
      throw new Error(`Failed to export test results to Excel: ${(error as Error).message}`);
    }
  }

  /**
   * Process data to extract status code map from summary
   */
  private _processData(summary: TestSummary): {
    summary: TestSummary;
    statusCodeMap: StatusCodeMap;
  } {
    const statusCodeMap: StatusCodeMap = {};

    // Aggregate status codes from all endpoints
    for (const endpoint of summary.endpoints) {
      for (const [statusCode, count] of Object.entries(endpoint.statusCodeDistribution)) {
        const code = Number.parseInt(statusCode, 10);
        statusCodeMap[code] = (statusCodeMap[code] || 0) + count;
      }
    }

    return { statusCodeMap, summary };
  }

  private _addTestSummarySheet(wb: xlsx.WorkBook, summary: TestSummary): void {
    const { global: g } = summary;

    const summaryData = [
      { Metric: 'Duration (s)', Value: g.finalDurationSec },
      { Metric: 'Total Requests', Value: g.totalRequests },
      { Metric: 'Successful', Value: g.successfulRequests },
      { Metric: 'Failed', Value: g.failedRequests },
      { Metric: 'Error Rate', Value: g.errorRate },
      { Metric: 'Min Latency (ms)', Value: g.minLatencyMs },
      { Metric: 'P50 Latency (ms)', Value: g.p50LatencyMs },
      { Metric: 'P95 Latency (ms)', Value: g.p95LatencyMs },
      { Metric: 'P99 Latency (ms)', Value: g.p99LatencyMs },
      {
        Metric: 'P99.9 Latency (ms)',
        Value: g.histogram?.percentiles[99.9] || 0,
      },
      { Metric: 'Max Latency (ms)', Value: g.maxLatencyMs },
      { Metric: 'Avg RPS', Value: g.averageRequestsPerSecond },
      { Metric: 'Peak RPS', Value: g.peakRequestsPerSecond },
      { Metric: 'Network Bytes Sent', Value: g.networkBytesSent },
      { Metric: 'Network Bytes Received', Value: g.networkBytesReceived },
      { Metric: 'Network Throughput (B/s)', Value: g.networkBytesPerSec },
      { Metric: 'Target Achieved (%)', Value: g.targetAchieved },
      { Metric: 'CPU Usage (%)', Value: g.avgSystemCpuUsagePercent },
      { Metric: 'Memory Usage (MB)', Value: g.avgProcessMemoryUsageMB },
      { Metric: 'Test Started (epoch)', Value: g.epochStartedAt },
      { Metric: 'Test Ended (epoch)', Value: g.epochEndedAt },
    ];

    const wsSummary = xlsx.utils.json_to_sheet(summaryData);
    xlsx.utils.book_append_sheet(wb, wsSummary, 'Test Summary');
  }

  private _addEndpointSummarySheet(wb: xlsx.WorkBook, endpoints: EndpointSummary[]): void {
    const formattedEndpoints = endpoints.map((endpoint) => ({
      'Avg RPS': endpoint.averageRequestsPerSecond,
      'Error Rate': endpoint.errorRate,
      Failed: endpoint.failedRequests,
      'Max Latency (ms)': endpoint.maxLatencyMs,
      Method: endpoint.method,
      'Min Latency (ms)': endpoint.minLatencyMs,
      'P1 Latency (ms)': endpoint.histogram?.percentiles[1] || 0,
      'P5 Latency (ms)': endpoint.histogram?.percentiles[5] || 0,
      'P10 Latency (ms)': endpoint.histogram?.percentiles[10] || 0,
      'P25 Latency (ms)': endpoint.histogram?.percentiles[25] || 0,
      'P50 Latency (ms)': endpoint.p50LatencyMs,
      'P75 Latency (ms)': endpoint.histogram?.percentiles[75] || 0,
      'P90 Latency (ms)': endpoint.histogram?.percentiles[90] || 0,
      'P95 Latency (ms)': endpoint.p95LatencyMs,
      'P99 Latency (ms)': endpoint.p99LatencyMs,
      'P99.9 Latency (ms)': endpoint.histogram?.percentiles[99.9] || 0,
      'Peak RPS': endpoint.peakRequestsPerSecond,
      Successful: endpoint.successfulRequests,
      'Target Achieved (%)': endpoint.targetAchieved,
      'Theoretical Max RPS': endpoint.theoreticalMaxRps,
      'Total Requests': endpoint.totalRequests,
      URL: endpoint.url,
    }));

    const wsEndpoints = xlsx.utils.json_to_sheet(formattedEndpoints);
    xlsx.utils.book_append_sheet(wb, wsEndpoints, 'Endpoint Summary');
  }

  private _addStatusCodeDistributionSheet(
    wb: xlsx.WorkBook,
    statusCodeMap: Record<number, number>,
  ): void {
    const statusCodeDistribution = this._getStatusCodeDistribution(statusCodeMap);

    const formattedStatusCodeDistribution = Object.entries(statusCodeDistribution).map(
      ([category, count]) => ({
        Count: count,
        'Status Code Category': category,
      }),
    );

    const wsStatusCode = xlsx.utils.json_to_sheet(formattedStatusCodeDistribution);
    xlsx.utils.book_append_sheet(wb, wsStatusCode, 'Status Code Distribution');
  }

  private _addLatencyDistributionSheet(wb: xlsx.WorkBook, summary: TestSummary): void {
    const { global: g } = summary;

    if (!g.histogram || g.histogram.totalCount === 0) {
      return;
    }

    const h = g.histogram;

    // Sheet 1: Percentile Distribution
    const percentileData = [
      {
        'Latency (ms)': h.min,
        Percentile: 'Min',
        'Total Requests': h.totalCount,
      },
      {
        'Latency (ms)': h.percentiles[1] || 0,
        Percentile: '1st',
        'Total Requests': h.totalCount,
      },
      {
        'Latency (ms)': h.percentiles[5] || 0,
        Percentile: '5th',
        'Total Requests': h.totalCount,
      },
      {
        'Latency (ms)': h.percentiles[10] || 0,
        Percentile: '10th',
        'Total Requests': h.totalCount,
      },
      {
        'Latency (ms)': h.percentiles[25] || 0,
        Percentile: '25th',
        'Total Requests': h.totalCount,
      },
      {
        'Latency (ms)': h.percentiles[50] || 0,
        Percentile: '50th',
        'Total Requests': h.totalCount,
      },
      {
        'Latency (ms)': h.percentiles[75] || 0,
        Percentile: '75th',
        'Total Requests': h.totalCount,
      },
      {
        'Latency (ms)': h.percentiles[90] || 0,
        Percentile: '90th',
        'Total Requests': h.totalCount,
      },
      {
        'Latency (ms)': h.percentiles[95] || 0,
        Percentile: '95th',
        'Total Requests': h.totalCount,
      },
      {
        'Latency (ms)': h.percentiles[99] || 0,
        Percentile: '99th',
        'Total Requests': h.totalCount,
      },
      {
        'Latency (ms)': h.max,
        Percentile: 'Max',
        'Total Requests': h.totalCount,
      },
    ];

    const wsPercentiles = xlsx.utils.json_to_sheet(percentileData);
    xlsx.utils.book_append_sheet(wb, wsPercentiles, 'Latency Percentiles');

    // NEW: Sheet 2: Bucket Distribution
    if (h.buckets.length > 0) {
      const bucketData = h.buckets.map((bucket, index) => ({
        'Bucket #': index + 1,
        Count: bucket.count,
        'Lower Bound (ms)': bucket.lowerBound,
        Percentage: `${((bucket.count / h.totalCount) * 100).toFixed(1)}%`,
        'Upper Bound (ms)': bucket.upperBound,
      }));

      const wsBuckets = xlsx.utils.json_to_sheet(bucketData);
      xlsx.utils.book_append_sheet(wb, wsBuckets, 'Latency Buckets');
    }
  }

  private _addSampledResponsesSheet(wb: xlsx.WorkBook, endpoints: EndpointSummary[]): void {
    const samplesForSheet: Array<{
      URL: string;
      Method: string;
      'Status Code': number;
      'Response Headers': string;
      'Response Body': string;
    }> = [];

    // Flatten response samples into individual rows
    for (const endpoint of endpoints) {
      if (!endpoint.responseSamples || endpoint.responseSamples.length === 0) {
        continue;
      }

      // Use a Set to track unique status codes per endpoint
      const seenStatusCodes = new Set<number>();

      for (const sample of endpoint.responseSamples) {
        if (!seenStatusCodes.has(sample.statusCode)) {
          seenStatusCodes.add(sample.statusCode);
          samplesForSheet.push({
            Method: endpoint.method,
            'Response Body': sample.body || '(No body captured)',
            'Response Headers': JSON.stringify(sample.headers || {}),
            'Status Code': sample.statusCode,
            URL: endpoint.url,
          });
        }
      }
    }

    // Sort by URL and then by status code
    samplesForSheet.sort((a, b) => {
      if (a.URL !== b.URL) {
        return a.URL.localeCompare(b.URL);
      }
      return a['Status Code'] - b['Status Code'];
    });

    if (samplesForSheet.length > 0) {
      const wsSamples = xlsx.utils.json_to_sheet(samplesForSheet);
      xlsx.utils.book_append_sheet(wb, wsSamples, 'Sampled Responses');
    }
  }

  private _addConfigurationSheet(wb: xlsx.WorkBook, config: TestSummary['configSnapshot']): void {
    const configData = Object.entries(config).map(([key, value]) => ({
      'Config Option': key,
      Value: typeof value === 'object' ? JSON.stringify(value) : String(value),
    }));

    const wsConfig = xlsx.utils.json_to_sheet(configData);
    xlsx.utils.book_append_sheet(wb, wsConfig, 'Configuration');
  }

  private _getStatusCodeDistribution(
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
      const code = Number.parseInt(statusCode, 10);
      const category = `${Math.floor(code / 100)}xx`;
      if (distribution[category] !== undefined) {
        distribution[category] += count;
      }
    }

    return distribution;
  }
}
