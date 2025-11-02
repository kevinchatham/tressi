import type {
  EndpointSummary,
  ReportMetadata,
  RequestResult,
  SafeTressiConfig,
  TestSummary,
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
 * Interface for JSON report data structure
 */
export interface JsonReport {
  metadata: {
    version: string;
    exportName?: string;
    runDate?: string;
    config: SafeTressiConfig;
  };
  summary: {
    global: TestSummary['global'];
    endpoints: EndpointSummary[];
  };
  statistics: {
    statusCodeDistribution: Record<string, number>;
    latencyDistribution: Array<{
      range: string;
      count: number;
      percentage: number;
      cumulativePercentage: number;
    }>;
  };
  samples?: Array<{
    endpoint: string;
    statusCode: number;
    body: string;
  }>;
}

/**
 * Generates JSON reports from test summary data
 */
export class JsonGenerator {
  /**
   * Generates a comprehensive JSON report from test summary data
   */
  generate(
    summary: TestSummary,
    runner: RunnerInterface,
    config: SafeTressiConfig,
    metadata?: ReportMetadata,
  ): JsonReport {
    const statusCodeMap: Record<number, number> = runner.getStatusCodeMap();
    const distribution = runner.getDistribution();
    const sampledResults = runner.getSampledResults();

    const report: JsonReport = {
      metadata: {
        version: summary.tressiVersion,
        exportName: metadata?.exportName,
        runDate: metadata?.runDate?.toISOString(),
        config,
      },
      summary: {
        global: summary.global,
        endpoints: summary.endpoints,
      },
      statistics: {
        statusCodeDistribution: this.getStatusCodeDistribution(statusCodeMap),
        latencyDistribution: this.getLatencyDistribution(distribution),
      },
    };

    // Add sampled responses if available
    const sampledResponses = sampledResults.filter(
      (r: RequestResult) => r.body,
    );
    if (sampledResponses.length > 0) {
      report.samples = this.formatSampledResponses(sampledResponses);
    }

    return report;
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

  private getLatencyDistribution(distribution: LatencyDistribution): Array<{
    range: string;
    count: number;
    percentage: number;
    cumulativePercentage: number;
  }> {
    if (distribution.getTotalCount() === 0) {
      return [];
    }

    const result = distribution.getLatencyDistribution({
      count: 10,
      chartWidth: 20,
    });

    return result.map(
      (bucket: {
        latency: string;
        count: string;
        percent: string;
        cumulative: string;
      }) => ({
        range: bucket.latency,
        count: parseInt(bucket.count, 10),
        percentage: parseFloat(bucket.percent),
        cumulativePercentage: parseFloat(bucket.cumulative),
      }),
    );
  }

  private formatSampledResponses(sampledResponses: RequestResult[]): Array<{
    endpoint: string;
    statusCode: number;
    body: string;
  }> {
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

    const uniqueSamples = new Map<string, RequestResult>();

    for (const [endpoint, samples] of Object.entries(samplesByEndpoint)) {
      for (const sample of samples) {
        const key = `${endpoint} ${sample.status}`;
        if (!uniqueSamples.has(key)) {
          uniqueSamples.set(key, sample);
        }
      }
    }

    return Array.from(uniqueSamples.values())
      .sort((a, b) => a.status - b.status)
      .map((r) => ({
        endpoint: `${r.method} ${r.url}`,
        statusCode: r.status,
        body: r.body || '(No body captured)',
      }));
  }
}
