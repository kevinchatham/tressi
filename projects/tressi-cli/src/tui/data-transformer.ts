/**
 * Transforms runner data into UI-friendly formats for display components.
 */
export class DataTransformer {
  /**
   * Transforms latency data for chart display.
   * @param dataPoints The number of historical data points to include
   * @returns Array of latency values for chart rendering
   */
  static transformLatencyData(dataPoints: number[]): number[] {
    return dataPoints.map((value) => Math.round(value));
  }

  /**
   * Transforms response code distribution data for chart display.
   * @param historicalData Historical data points for each category
   * @returns Object containing transformed data for each response category
   */
  static transformResponseCodeData(historicalData: {
    success: number[];
    redirect: number[];
    clientError: number[];
    serverError: number[];
  }): Array<{
    title: string;
    x: string[];
    y: number[];
    style?: { line: string };
  }> {
    const series = [];

    if (historicalData.success.some((v) => v > 0)) {
      series.push({
        title: '2xx',
        x: [],
        y: historicalData.success,
        style: { line: 'green' },
      });
    }
    if (historicalData.redirect.some((v) => v > 0)) {
      series.push({
        title: '3xx',
        x: [],
        y: historicalData.redirect,
        style: { line: 'yellow' },
      });
    }
    if (historicalData.clientError.some((v) => v > 0)) {
      series.push({
        title: '4xx',
        x: [],
        y: historicalData.clientError,
        style: { line: 'red' },
      });
    }
    if (historicalData.serverError.some((v) => v > 0)) {
      series.push({
        title: '5xx',
        x: [],
        y: historicalData.serverError,
        style: { line: 'magenta' },
      });
    }

    return series;
  }

  /**
   * Transforms latency distribution data for table display.
   * @param latencyDistribution Raw latency distribution data
   * @returns Formatted table data with headers and rows
   */
  static transformLatencyDistributionData(
    latencyDistribution: Array<{
      latency: string;
      count: string;
      percent: string;
      cumulative: string;
    }>,
  ): {
    headers: string[];
    data: string[][];
  } {
    return {
      headers: ['Range', 'Count', '% of Total', 'Cumulative'],
      data: latencyDistribution.map((b) => [
        b.latency,
        b.count,
        b.percent,
        b.cumulative,
      ]),
    };
  }

  /**
   * Transforms statistics data for table display.
   * @param stats Object containing various statistics
   * @returns Formatted table data with headers and rows
   */
  static transformStatsData(stats: {
    elapsedSec: number;
    totalSec: number;
    currentReqPerSec: number;
    targetReqPerSec?: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
    totalRps: number;
  }): {
    headers: string[];
    data: string[][];
  } {
    const rpsStat = stats.targetReqPerSec
      ? `${stats.currentReqPerSec} / ${stats.targetReqPerSec}`
      : stats.currentReqPerSec.toString();

    const data: string[][] = [
      ['Time', `${stats.elapsedSec.toFixed(0)}s / ${stats.totalSec}s`],
      ['Target RPS', stats.totalRps.toString()],
      ['Req/s (Actual/Target)', rpsStat],
      [
        'Success / Fail',
        `${stats.successfulRequests} / ${stats.failedRequests}`,
      ],
      ['Avg Latency (ms)', Math.round(stats.averageLatency).toString()],
    ];

    return {
      headers: ['Stat', 'Value'],
      data: data,
    };
  }

  /**
   * Generates time labels for chart x-axis.
   * @param elapsedSec Current elapsed time in seconds
   * @param dataPointsCount Number of data points
   * @param intervalSec Interval between data points in seconds
   * @returns Array of time labels
   */
  static generateTimeLabels(
    elapsedSec: number,
    dataPointsCount: number,
    intervalSec: number = 0.5,
  ): string[] {
    return Array.from({ length: dataPointsCount }, (_, i) => {
      const timeAgoSec = (dataPointsCount - 1 - i) * intervalSec;
      const timeSec = elapsedSec - timeAgoSec;
      return timeSec < 0 ? `0s` : `${Math.round(timeSec)}s`;
    });
  }

  /**
   * Extracts all necessary data from a Runner instance for UI display.
   * @returns Comprehensive data object for UI components
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static extractRunnerData(runner: any): {
    histogram: { mean: number };
    latencyDistribution: Array<{
      latency: string;
      count: string;
      percent: string;
      cumulative: string;
    }>;
    currentReqPerSec: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
  } {
    // Get results from the runner
    const results =
      runner && typeof runner.getResults === 'function'
        ? runner.getResults()
        : null;

    if (!results) {
      return {
        histogram: { mean: 0 },
        latencyDistribution: [],
        currentReqPerSec: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatency: 0,
      };
    }

    const typedResults = results as {
      averageLatency?: number;
      currentReqPerSec?: number;
      successfulRequests?: number;
      failedRequests?: number;
      latencyDistribution?: Array<{
        latency: string;
        count: string;
        percent: string;
        cumulative: string;
      }>;
    };

    return {
      histogram: { mean: typedResults.averageLatency || 0 },
      latencyDistribution: typedResults.latencyDistribution || [],
      currentReqPerSec: typedResults.currentReqPerSec || 0,
      successfulRequests: typedResults.successfulRequests || 0,
      failedRequests: typedResults.failedRequests || 0,
      averageLatency: typedResults.averageLatency || 0,
    };
  }
}
