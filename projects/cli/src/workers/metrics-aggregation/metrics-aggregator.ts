import { cpus, loadavg } from 'node:os';
import {
  type AggregatedWorkerData,
  EMPTY_HISTOGRAM,
  type IHdrHistogramManager,
  type IMetricsAggregator,
  type IStatsCounterManager,
  type ResponseSample,
} from '@tressi/shared/cli';
import {
  type EndpointSummary,
  type GlobalSummary,
  type LatencyHistogram,
  ServerEvents,
  type TestSummary,
  type TressiConfig,
} from '@tressi/shared/common';

import pkg from '../../../../../package.json';
import { metricStorage } from '../../collections/metrics-collection';
import { globalEventEmitter } from '../../events/global-event-emitter';
import { transformAggregatedMetricToTestSummary } from '../../reporting/utils/transformations';
import { ResponseSampleStore } from './response-sample-store';
import * as StatsCalculator from './stats-calculator';
import { convertWorkerHistogramToTestSummaryHistogram } from './utils/histogram-utils';

export class MetricsAggregator implements IMetricsAggregator {
  private _pollingInterval: NodeJS.Timeout | null = null;
  private _startTime: number = 0;
  private _endTime: number = 0;
  private _endpoints: string[] = [];
  private _config: TressiConfig | null = null;
  private _testId?: string; // Optional for server persistence
  private _previousEndpointCounts: Record<
    string,
    { success: number; failure: number; timestamp: number }
  > = {};
  private _previousGlobalCounts: {
    success: number;
    failure: number;
    timestamp: number;
  } = {
    failure: 0,
    success: 0,
    timestamp: 0,
  };
  private _snapshots: TestSummary[] = [];
  private _responseSampleStore = new ResponseSampleStore();

  public get endTime(): number {
    return this._endTime;
  }

  constructor(
    private _hdrHistogramManagers: IHdrHistogramManager[],
    private _statsCounterManagers: IStatsCounterManager[],
    private _endpointMethodMap: Record<string, string> = {},
    private _runId: string,
  ) {}

  setTestId(testId: string): void {
    this._testId = testId;
  }

  public setStartTime(startTime: number): void {
    this._startTime = startTime;
    this._previousGlobalCounts = {
      failure: 0,
      success: 0,
      timestamp: startTime,
    };
  }

  public setEndTime(endTime: number): void {
    this._endTime = endTime;
  }

  private _getCurrentCpuUsagePercent(): number {
    const cpuCount = cpus().length;
    const loadAvg = loadavg()[0];
    return Math.min(Math.round((loadAvg / cpuCount) * 100), 100);
  }

  private _getCurrentMemoryUsageMB(): number {
    return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  }

  setConfig(config: TressiConfig): void {
    this._config = config;
  }

  setEndpoints(endpoints: string[]): void {
    this._endpoints = endpoints;
    const startTime = this._startTime || Date.now();
    this._previousEndpointCounts = {};
    endpoints.forEach((url) => {
      this._previousEndpointCounts[url] = {
        failure: 0,
        success: 0,
        timestamp: startTime,
      };
    });
  }

  startPolling(intervalMs: number = 1000): void {
    if (this._pollingInterval) {
      clearInterval(this._pollingInterval);
      this._pollingInterval = null;
    }

    this._startTime = Date.now();
    this._pollingInterval = setInterval(async () => {
      await this._pollMetrics();
    }, intervalMs);
  }

  stopPolling(): void {
    if (this._pollingInterval) {
      clearInterval(this._pollingInterval);
      this._pollingInterval = null;
    }
    this._endTime = Date.now();
  }

  private async _pollMetrics(): Promise<void> {
    try {
      const testSummary = this.getResults(this._hdrHistogramManagers.length, this._endpoints);

      this._snapshots.push(testSummary);

      globalEventEmitter.emit(ServerEvents.METRICS, {
        testId: this._testId,
        testSummary,
      });

      if (this._testId) {
        await metricStorage.create({
          epoch: testSummary.global.epochEndedAt,
          metric: testSummary,
          testId: this._testId,
        });
      }
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: default
      console.error('Failed to persist metrics to database:', error);
    }
  }

  private _updateHistoricalState(aggregatedData: AggregatedWorkerData, currentTime: number): void {
    Object.entries(aggregatedData.currentEndpointCounts).forEach(([url, counts]) => {
      this._previousEndpointCounts[url] = {
        failure: counts.failure,
        success: counts.success,
        timestamp: currentTime,
      };
    });

    this._previousGlobalCounts = {
      failure: aggregatedData.totalFailure,
      success: aggregatedData.totalSuccess,
      timestamp: currentTime,
    };
  }

  private _calculateGlobalSummary(
    aggregatedData: AggregatedWorkerData,
    currentTime: number,
    endpoints: string[],
  ): GlobalSummary {
    const duration = this._startTime > 0 ? currentTime - this._startTime : 0;
    const globalStats = StatsCalculator.calculateGlobalLatencyStats(
      aggregatedData.endpointHistograms,
    );

    let currentGlobalRps = 0;
    if (
      this._previousGlobalCounts.timestamp > 0 &&
      currentTime > this._previousGlobalCounts.timestamp
    ) {
      const timeDiffMs = currentTime - this._previousGlobalCounts.timestamp;
      const timeDiffSec = timeDiffMs / 1000;
      const requestDiff =
        aggregatedData.totalRequests -
        (this._previousGlobalCounts.success + this._previousGlobalCounts.failure);
      currentGlobalRps = timeDiffSec > 0 ? requestDiff / timeDiffSec : 0;
    }

    const cpuUsagePercent = this._getCurrentCpuUsagePercent();
    const memoryUsageMB = this._getCurrentMemoryUsageMB();

    const globalBytesPerSec =
      duration > 0
        ? (aggregatedData.totalBytesSent + aggregatedData.totalBytesReceived) / (duration / 1000)
        : 0;

    let globalTargetAchieved = 0;
    if (this._config && this._config.requests.length > 0) {
      const totalTargetRps = this._config.requests.reduce((sum, req) => sum + req.rps, 0);
      if (totalTargetRps > 0) {
        globalTargetAchieved = currentGlobalRps / totalTargetRps;
      }
    }

    const allGlobalHistograms: LatencyHistogram[] = [];
    Object.values(aggregatedData.endpointHistograms).forEach(
      (h) => void allGlobalHistograms.push(...h),
    );

    return {
      averageRequestsPerSecond: currentGlobalRps,
      avgProcessMemoryUsageMB: memoryUsageMB,
      avgSystemCpuUsagePercent: cpuUsagePercent,
      epochEndedAt: currentTime,
      epochStartedAt: this._startTime,
      errorRate:
        aggregatedData.totalRequests > 0
          ? aggregatedData.totalFailure / aggregatedData.totalRequests
          : 0,
      failedRequests: aggregatedData.totalFailure,
      finalDurationSec: duration / 1000,
      histogram:
        convertWorkerHistogramToTestSummaryHistogram(allGlobalHistograms) || EMPTY_HISTOGRAM,
      maxLatencyMs: globalStats.maxLatency,
      minLatencyMs: globalStats.minLatency,
      networkBytesPerSec: globalBytesPerSec,
      networkBytesReceived: aggregatedData.totalBytesReceived,
      networkBytesSent: aggregatedData.totalBytesSent,
      p50LatencyMs: globalStats.p50Latency,
      p95LatencyMs: globalStats.p95Latency,
      p99LatencyMs: globalStats.p99Latency,
      peakRequestsPerSecond: currentGlobalRps,
      successfulRequests: aggregatedData.totalSuccess,
      targetAchieved: globalTargetAchieved,
      totalEndpoints: endpoints.length,
      totalRequests: aggregatedData.totalRequests,
    };
  }

  private _calculateEndpointSummary(
    url: string,
    aggregatedData: AggregatedWorkerData,
    currentTime: number,
  ): EndpointSummary {
    const histograms = aggregatedData.endpointHistograms[url] || [];
    const statusCounts = aggregatedData.endpointStatusCounts[url] || {};

    const endpointStats = StatsCalculator.calculateEndpointLatencyStats(histograms);
    const endpointTotalRequests = endpointStats.totalCount;

    const currentCounts = aggregatedData.currentEndpointCounts[url] || {
      failure: 0,
      success: 0,
    };

    const previousCounts = this._previousEndpointCounts[url];

    let currentRequestsPerSecond = 0;
    if (previousCounts && previousCounts.timestamp > 0 && currentTime > previousCounts.timestamp) {
      const timeDiffMs = currentTime - previousCounts.timestamp;
      const timeDiffSec = timeDiffMs / 1000;
      const requestDiff =
        currentCounts.success +
        currentCounts.failure -
        (previousCounts.success + previousCounts.failure);
      currentRequestsPerSecond = timeDiffSec > 0 ? requestDiff / timeDiffSec : 0;
    }

    let targetAchieved = 0;
    if (this._config) {
      const requestConfig = this._config.requests.find((req) => req.url === url);
      if (requestConfig && requestConfig.rps > 0) {
        targetAchieved = currentRequestsPerSecond / requestConfig.rps;
      }
    }

    const theoreticalMaxRps = endpointStats.p50Latency > 0 ? 1000 / endpointStats.p50Latency : 0;

    return {
      averageRequestsPerSecond: currentRequestsPerSecond,
      errorRate: endpointTotalRequests > 0 ? currentCounts.failure / endpointTotalRequests : 0,
      failedRequests: currentCounts.failure,
      histogram: convertWorkerHistogramToTestSummaryHistogram(histograms) || EMPTY_HISTOGRAM,
      maxLatencyMs: endpointStats.maxLatency,
      method: this._endpointMethodMap[url] || 'GET',
      minLatencyMs: endpointStats.minLatency,
      p50LatencyMs: endpointStats.p50Latency,
      p95LatencyMs: endpointStats.p95Latency,
      p99LatencyMs: endpointStats.p99Latency,
      peakRequestsPerSecond: currentRequestsPerSecond,
      responseSamples:
        this._responseSampleStore.getCollectedResponseSamples(this._runId).get(url) || [],
      statusCodeDistribution: statusCounts,
      successfulRequests: currentCounts.success,
      targetAchieved,
      theoreticalMaxRps,
      totalRequests: endpointTotalRequests,
      url,
    };
  }

  private _aggregateWorkerData(workersCount: number, endpoints: string[]): AggregatedWorkerData {
    const data: AggregatedWorkerData = {
      currentEndpointCounts: {},
      endpointHistograms: {},
      endpointStatusCounts: {},
      totalBytesReceived: 0,
      totalBytesSent: 0,
      totalFailure: 0,
      totalRequests: 0,
      totalSuccess: 0,
    };

    endpoints.forEach((url) => {
      data.endpointHistograms[url] = [];
      data.endpointStatusCounts[url] = {};
      data.currentEndpointCounts[url] = { failure: 0, success: 0 };
    });

    for (let workerId = 0; workerId < workersCount; workerId++) {
      const statsManager = this._statsCounterManagers[workerId];
      const histogramManager = this._hdrHistogramManagers[workerId];

      if (!statsManager || !histogramManager) continue;

      const allCounters = statsManager.getAllEndpointCounters();
      const allHistograms = histogramManager.getAllEndpointHistograms();

      allCounters.forEach((counters, localEndpointIndex: number) => {
        const globalEndpointIndex = this._getGlobalEndpointIndex(workerId, localEndpointIndex);
        if (globalEndpointIndex >= endpoints.length) return;

        const endpointUrl = endpoints[globalEndpointIndex];

        data.totalSuccess += counters.successCount;
        data.totalFailure += counters.failureCount;
        data.totalRequests += counters.successCount + counters.failureCount;

        data.currentEndpointCounts[endpointUrl].success += counters.successCount;
        data.currentEndpointCounts[endpointUrl].failure += counters.failureCount;

        data.totalBytesSent += counters.bytesSent;
        data.totalBytesReceived += counters.bytesReceived;

        Object.entries(counters.statusCodeCounts).forEach(([statusCode, count]) => {
          const code = parseInt(statusCode, 10);
          data.endpointStatusCounts[endpointUrl][code] =
            (data.endpointStatusCounts[endpointUrl][code] || 0) + count;
        });

        const histogramData = allHistograms[localEndpointIndex];
        if (histogramData && histogramData.totalCount > 0) {
          data.endpointHistograms[endpointUrl].push(histogramData);
        }
      });
    }

    return data;
  }

  getResults(workersCount: number, endpoints: string[]): TestSummary {
    const aggregatedData = this._aggregateWorkerData(workersCount, endpoints);
    const currentTime = Date.now();

    const endpointSummaries = endpoints.map((url) =>
      this._calculateEndpointSummary(url, aggregatedData, currentTime),
    );

    const globalSummary = this._calculateGlobalSummary(aggregatedData, currentTime, endpoints);

    this._updateHistoricalState(aggregatedData, currentTime);

    return {
      configSnapshot: this._config!,
      endpoints: endpointSummaries,
      global: globalSummary,
      tressiVersion: pkg.version || 'unknown',
    };
  }

  public getTestSummary(): TestSummary {
    if (this._snapshots.length === 0) {
      this._snapshots.push(this.getResults(this._hdrHistogramManagers.length, this._endpoints));
    }
    return transformAggregatedMetricToTestSummary(this._snapshots);
  }

  getCollectedResponseSamples(runId: string): Map<string, ResponseSample[]> {
    return this._responseSampleStore.getCollectedResponseSamples(runId);
  }

  recordResponseSample(
    runId: string,
    url: string,
    statusCode: number,
    headers: Record<string, string>,
    body: string,
  ): void {
    this._responseSampleStore.recordResponseSample(runId, url, statusCode, headers, body);
  }

  cleanupResponseSamples(runId: string): void {
    this._responseSampleStore.cleanupResponseSamples(runId);
  }

  private _getGlobalEndpointIndex(workerId: number, localEndpointIndex: number): number {
    const workersCount = this._hdrHistogramManagers.length;
    return workerId + localEndpointIndex * workersCount;
  }
}
