import { Histogram } from 'hdr-histogram-js';

import type { CoreRunner } from '../core/runner/core-runner';
import { getStatusCodeDistributionByCategory } from '../stats';

/**
 * Transforms runner data into UI-friendly formats for display components.
 */
export class DataTransformer {
  /**
   * Transforms latency data for chart display.
   * @param histogram The HDR histogram containing latency data
   * @param dataPoints The number of historical data points to include
   * @returns Array of latency values for chart rendering
   */
  static transformLatencyData(
    _histogram: Histogram,
    dataPoints: number[],
  ): number[] {
    return dataPoints.map((value) => Math.round(value));
  }

  /**
   * Transforms response code distribution data for chart display.
   * @param statusCodeMap Map of status codes to their counts
   * @param historicalData Historical data points for each category
   * @returns Object containing transformed data for each response category
   */
  static transformResponseCodeData(
    statusCodeMap: Record<number, number>,
    historicalData: {
      success: number[];
      redirect: number[];
      clientError: number[];
      serverError: number[];
    },
  ): Array<{
    title: string;
    x: string[];
    y: number[];
    style?: { line: string };
  }> {
    const series = [];
    // Validate status codes but don't use the result directly
    getStatusCodeDistributionByCategory(statusCodeMap);

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
    workerCount: number;
    maxWorkers?: number;
  }): {
    headers: string[];
    data: string[][];
  } {
    const rpsStat = stats.targetReqPerSec
      ? `${stats.currentReqPerSec} / ${stats.targetReqPerSec}`
      : stats.currentReqPerSec.toString();

    const workerStat = stats.maxWorkers
      ? `${stats.workerCount} / ${stats.maxWorkers}`
      : stats.workerCount.toString();

    const data: string[][] = [
      ['Time', `${stats.elapsedSec.toFixed(0)}s / ${stats.totalSec}s`],
      ['Workers', workerStat],
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
   * @param runner The Runner instance
   * @param elapsedSec Elapsed time in seconds
   * @param totalSec Total test duration in seconds
   * @param targetReqPerSec Target requests per second
   * @returns Comprehensive data object for UI components
   */
  static extractRunnerData(runner: CoreRunner): {
    histogram: Histogram;
    statusCodeMap: Record<number, number>;
    currentReqPerSec: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
    workerCount: number;
    latencyDistribution: Array<{
      latency: string;
      count: string;
      percent: string;
      cumulative: string;
    }>;
  } {
    const resultAggregator = runner.getResultAggregator();
    const rpsCalculator = runner.getRpsCalculator();
    return {
      histogram: resultAggregator.getGlobalHistogram(),
      statusCodeMap: resultAggregator.getStatusCodeMap(),
      currentReqPerSec: rpsCalculator.getCurrentRps(),
      successfulRequests: resultAggregator.getSuccessfulRequestsCount(),
      failedRequests: resultAggregator.getFailedRequestsCount(),
      averageLatency: resultAggregator.getGlobalHistogram().mean,
      workerCount: runner.getWorkerPool().getWorkerCount(),
      latencyDistribution: resultAggregator.getLatencyDistribution({
        count: 10,
      }),
    };
  }
}
