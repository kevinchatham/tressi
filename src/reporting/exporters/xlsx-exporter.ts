import * as xlsx from 'xlsx';

import type { EndpointSummary, RequestResult, TestSummary } from '../../types';

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
 * Exports test results to Excel format
 */
export class XlsxExporter {
  /**
   * Exports test results to an Excel file
   */
  async export(
    path: string,
    results: RequestResult[],
    summary: TestSummary,
    runner: RunnerInterface,
  ): Promise<void> {
    const wb = xlsx.utils.book_new();

    // Global Summary Sheet
    this.addGlobalSummarySheet(wb, summary);

    // Endpoint Summary Sheet
    this.addEndpointSummarySheet(wb, summary.endpoints);

    // Status Code Distribution Sheet
    this.addStatusCodeDistributionSheet(wb, runner);

    // Raw Results Sheet
    this.addRawResultsSheet(wb, results);

    // Sampled Responses Sheet
    this.addSampledResponsesSheet(wb, runner);

    xlsx.writeFile(wb, path);
  }

  private addGlobalSummarySheet(wb: xlsx.WorkBook, summary: TestSummary): void {
    const globalArray = Object.entries(summary.global).map(([key, value]) => ({
      Stat: key,
      Value: typeof value === 'number' ? Math.round(value) : String(value),
    }));
    globalArray.unshift({
      Stat: 'Tressi Version',
      Value: summary.tressiVersion,
    });

    const wsGlobal = xlsx.utils.json_to_sheet(globalArray);
    xlsx.utils.book_append_sheet(wb, wsGlobal, 'Global Summary');
  }

  private addEndpointSummarySheet(
    wb: xlsx.WorkBook,
    endpoints: EndpointSummary[],
  ): void {
    const formattedEndpoints = endpoints.map((endpoint) => ({
      ...endpoint,
      avgLatencyMs: Math.round(endpoint.avgLatencyMs),
      minLatencyMs: Math.round(endpoint.minLatencyMs),
      maxLatencyMs: Math.round(endpoint.maxLatencyMs),
      p95LatencyMs: Math.round(endpoint.p95LatencyMs),
      p99LatencyMs: Math.round(endpoint.p99LatencyMs),
    }));

    const wsEndpoints = xlsx.utils.json_to_sheet(formattedEndpoints);
    xlsx.utils.book_append_sheet(wb, wsEndpoints, 'Endpoint Summary');
  }

  private addStatusCodeDistributionSheet(
    wb: xlsx.WorkBook,
    runner: RunnerInterface,
  ): void {
    const statusCodeMap = runner.getStatusCodeMap();
    const statusCodeDistribution =
      this.getStatusCodeDistribution(statusCodeMap);

    const formattedStatusCodeDistribution = Object.entries(
      statusCodeDistribution,
    ).map(([category, count]) => ({
      'Status Code Category': category,
      Count: count,
    }));

    const wsStatusCode = xlsx.utils.json_to_sheet(
      formattedStatusCodeDistribution,
    );
    xlsx.utils.book_append_sheet(wb, wsStatusCode, 'Status Code Distribution');
  }

  private addRawResultsSheet(
    wb: xlsx.WorkBook,
    results: RequestResult[],
  ): void {
    const formattedResults = results.map((result) => ({
      Timestamp: result.timestamp,
      Method: result.method,
      URL: result.url,
      Status: result.status,
      'Latency (ms)': result.latencyMs,
      Success: result.success,
      Error: result.error || '',
    }));

    const wsResults = xlsx.utils.json_to_sheet(formattedResults);
    xlsx.utils.book_append_sheet(wb, wsResults, 'Raw Results');
  }

  private addSampledResponsesSheet(
    wb: xlsx.WorkBook,
    runner: RunnerInterface,
  ): void {
    const sampledResponses = runner.getSampledResults().filter((r) => r.body);
    if (sampledResponses.length === 0) return;

    const uniqueSamples = new Map<string, RequestResult>();
    for (const r of sampledResponses) {
      const key = `${r.method} ${r.url} ${r.status}`;
      if (!uniqueSamples.has(key)) {
        uniqueSamples.set(key, r);
      }
    }

    const samplesForSheet = Array.from(uniqueSamples.values())
      .sort((a, b) => a.status - b.status)
      .map((r) => ({
        Method: r.method,
        URL: r.url,
        'Status Code': r.status,
        'Response Body': r.body,
      }));

    if (samplesForSheet.length > 0) {
      const wsSamples = xlsx.utils.json_to_sheet(samplesForSheet);
      xlsx.utils.book_append_sheet(wb, wsSamples, 'Sampled Responses');
    }
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
}
