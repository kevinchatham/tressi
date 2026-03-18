import {
  IHdrHistogramManager,
  IMetricsAggregator,
  IStatsCounterManager,
} from '@tressi/shared/cli';
import {
  EndpointSummary,
  GlobalSummary,
  LatencyHistogram,
  ServerEvents,
  TestSummary,
  TressiConfig,
} from '@tressi/shared/common';
import { cpus, loadavg } from 'os';

import pkg from '../../../../package.json';
import { metricStorage } from '../collections/metrics-collection';
import { globalEventEmitter } from '../events/global-event-emitter';
import { transformAggregatedMetricToTestSummary } from '../reporting/utils/transformations';

// Store for body samples collected during test
const responseSamplesStore = new Map<
  string,
  Map<
    string,
    Array<{
      statusCode: number;
      headers: Record<string, string>;
      body: string;
    }>
  >
>();

const EMPTY_HISTOGRAM: LatencyHistogram = {
  totalCount: 0,
  min: 0,
  max: 0,
  mean: 0,
  stdDev: 0,
  percentiles: {},
  buckets: [],
};

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
    success: 0,
    failure: 0,
    timestamp: 0,
  };
  private _snapshots: TestSummary[] = [];

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
      success: 0,
      failure: 0,
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
        success: 0,
        failure: 0,
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
      const testSummary = this.getResults(
        this._hdrHistogramManagers.length,
        this._endpoints,
      );

      this._snapshots.push(testSummary);

      globalEventEmitter.emit(ServerEvents.METRICS, {
        testId: this._testId,
        testSummary,
      });

      if (this._testId) {
        await metricStorage.create({
          testId: this._testId,
          metric: testSummary,
          epoch: testSummary.global.epochEndedAt,
        });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to persist metrics to database:', error);
    }
  }

  getResults(workersCount: number, endpoints: string[]): TestSummary {
    let totalSuccess = 0;
    let totalFailure = 0;
    let totalRequests = 0;

    const endpointHistograms: Record<string, LatencyHistogram[]> = {};
    const endpointStatusCounts: Record<string, Record<number, number>> = {};

    endpoints.forEach((url) => {
      endpointHistograms[url] = [];
      endpointStatusCounts[url] = {};
    });

    let totalBytesSent = 0;
    let totalBytesReceived = 0;

    const currentEndpointCounts: Record<
      string,
      { success: number; failure: number }
    > = {};

    for (let workerId = 0; workerId < workersCount; workerId++) {
      const statsManager = this._statsCounterManagers[workerId];
      const histogramManager = this._hdrHistogramManagers[workerId];

      if (!statsManager || !histogramManager) continue;

      const allCounters = statsManager.getAllEndpointCounters();
      const allHistograms = histogramManager.getAllEndpointHistograms();

      allCounters.forEach((counters, localEndpointIndex: number) => {
        const globalEndpointIndex = this._getGlobalEndpointIndex(
          workerId,
          localEndpointIndex,
        );
        if (globalEndpointIndex >= endpoints.length) return;

        const endpointUrl = endpoints[globalEndpointIndex];

        if (!currentEndpointCounts[endpointUrl]) {
          currentEndpointCounts[endpointUrl] = { success: 0, failure: 0 };
        }

        totalSuccess += counters.successCount;
        totalFailure += counters.failureCount;
        totalRequests += counters.successCount + counters.failureCount;

        currentEndpointCounts[endpointUrl].success += counters.successCount;
        currentEndpointCounts[endpointUrl].failure += counters.failureCount;

        totalBytesSent += counters.bytesSent;
        totalBytesReceived += counters.bytesReceived;

        Object.entries(counters.statusCodeCounts).forEach(
          ([statusCode, count]) => {
            const code = parseInt(statusCode);
            endpointStatusCounts[endpointUrl][code] =
              (endpointStatusCounts[endpointUrl][code] || 0) + count;
          },
        );

        const histogramData = allHistograms[localEndpointIndex];
        if (histogramData && histogramData.totalCount > 0) {
          endpointHistograms[endpointUrl].push(histogramData);
        }
      });
    }

    const currentTime = Date.now();
    const duration = this._startTime > 0 ? currentTime - this._startTime : 0;

    const globalStats = this._calculateGlobalLatencyStats(endpointHistograms);

    const globalStatusCodeDistribution: Record<number, number> = {};
    Object.values(endpointStatusCounts).forEach((statusCounts) => {
      Object.entries(statusCounts).forEach(([statusCode, count]) => {
        const code = parseInt(statusCode);
        globalStatusCodeDistribution[code] =
          (globalStatusCodeDistribution[code] || 0) + count;
      });
    });

    const endpointSummaries: EndpointSummary[] = [];

    endpoints.forEach((url) => {
      const histograms = endpointHistograms[url];
      const statusCounts = endpointStatusCounts[url];

      const endpointStats = this._calculateEndpointLatencyStats(histograms);
      const endpointTotalRequests = endpointStats.totalCount;

      let endpointSuccessRequests = 0;
      let endpointFailureRequests = 0;

      for (let workerId = 0; workerId < workersCount; workerId++) {
        const statsManager = this._statsCounterManagers[workerId];
        if (!statsManager) continue;

        const allCounters = statsManager.getAllEndpointCounters();
        allCounters.forEach((counters, localEndpointIndex) => {
          const globalEndpointIndex = this._getGlobalEndpointIndex(
            workerId,
            localEndpointIndex,
          );
          if (globalEndpointIndex >= endpoints.length) return;

          const endpointUrl = endpoints[globalEndpointIndex];
          if (endpointUrl === url) {
            endpointSuccessRequests += counters.successCount;
            endpointFailureRequests += counters.failureCount;
          }
        });
      }

      const currentCounts = currentEndpointCounts[url] || {
        success: 0,
        failure: 0,
      };

      const previousCounts = this._previousEndpointCounts[url];

      let currentRequestsPerSecond = 0;
      if (
        previousCounts &&
        previousCounts.timestamp > 0 &&
        currentTime > previousCounts.timestamp
      ) {
        const timeDiffMs = currentTime - previousCounts.timestamp;
        const timeDiffSec = timeDiffMs / 1000;
        const requestDiff =
          currentCounts.success +
          currentCounts.failure -
          (previousCounts.success + previousCounts.failure);
        currentRequestsPerSecond =
          timeDiffSec > 0 ? requestDiff / timeDiffSec : 0;
      }

      this._previousEndpointCounts[url] = {
        success: currentCounts.success,
        failure: currentCounts.failure,
        timestamp: currentTime,
      };

      let targetAchieved = 0;
      if (this._config) {
        const requestConfig = this._config.requests.find(
          (req) => req.url === url,
        );
        if (requestConfig && requestConfig.rps > 0) {
          targetAchieved = currentRequestsPerSecond / requestConfig.rps;
        }
      }

      const theoreticalMaxRps =
        endpointStats.p50Latency > 0 ? 1000 / endpointStats.p50Latency : 0;

      endpointSummaries.push({
        method: this._endpointMethodMap[url] || 'GET',
        url,
        totalRequests: endpointTotalRequests,
        successfulRequests: endpointSuccessRequests,
        failedRequests: endpointFailureRequests,
        minLatencyMs: endpointStats.minLatency,
        maxLatencyMs: endpointStats.maxLatency,
        p50LatencyMs: endpointStats.p50Latency,
        p95LatencyMs: endpointStats.p95Latency,
        p99LatencyMs: endpointStats.p99Latency,
        averageRequestsPerSecond: currentRequestsPerSecond, // Windowed RPS for snapshot
        peakRequestsPerSecond: currentRequestsPerSecond, // Same for snapshot
        theoreticalMaxRps,
        targetAchieved,
        responseSamples:
          this.getCollectedResponseSamples(this._runId).get(url) || [],
        statusCodeDistribution: statusCounts,
        errorRate:
          endpointTotalRequests > 0
            ? endpointFailureRequests / endpointTotalRequests
            : 0,
        histogram:
          this._convertWorkerHistogramToTestSummaryHistogram(histograms) ||
          EMPTY_HISTOGRAM,
      });
    });

    let currentGlobalRps = 0;
    if (
      this._previousGlobalCounts.timestamp > 0 &&
      currentTime > this._previousGlobalCounts.timestamp
    ) {
      const timeDiffMs = currentTime - this._previousGlobalCounts.timestamp;
      const timeDiffSec = timeDiffMs / 1000;
      const requestDiff =
        totalRequests -
        (this._previousGlobalCounts.success +
          this._previousGlobalCounts.failure);
      currentGlobalRps = timeDiffSec > 0 ? requestDiff / timeDiffSec : 0;
    }

    this._previousGlobalCounts = {
      success: totalSuccess,
      failure: totalFailure,
      timestamp: currentTime,
    };

    const cpuUsagePercent = this._getCurrentCpuUsagePercent();
    const memoryUsageMB = this._getCurrentMemoryUsageMB();

    const globalBytesPerSec =
      duration > 0
        ? (totalBytesSent + totalBytesReceived) / (duration / 1000)
        : 0;

    let globalTargetAchieved = 0;
    if (this._config && this._config.requests.length > 0) {
      const totalTargetRps = this._config.requests.reduce(
        (sum, req) => sum + req.rps,
        0,
      );
      if (totalTargetRps > 0) {
        globalTargetAchieved = currentGlobalRps / totalTargetRps;
      }
    }

    const allGlobalHistograms: LatencyHistogram[] = [];
    Object.values(endpointHistograms).forEach((h) =>
      allGlobalHistograms.push(...h),
    );

    const globalSummary: GlobalSummary = {
      totalEndpoints: endpoints.length,
      totalRequests,
      successfulRequests: totalSuccess,
      failedRequests: totalFailure,
      minLatencyMs: globalStats.minLatency,
      maxLatencyMs: globalStats.maxLatency,
      p50LatencyMs: globalStats.p50Latency,
      p95LatencyMs: globalStats.p95Latency,
      p99LatencyMs: globalStats.p99Latency,
      averageRequestsPerSecond: currentGlobalRps, // Windowed RPS for snapshot
      peakRequestsPerSecond: currentGlobalRps, // Same for snapshot
      errorRate: totalRequests > 0 ? totalFailure / totalRequests : 0,
      finalDurationSec: duration / 1000,
      epochStartedAt: this._startTime,
      epochEndedAt: currentTime,
      networkBytesSent: totalBytesSent,
      networkBytesReceived: totalBytesReceived,
      networkBytesPerSec: globalBytesPerSec,
      avgSystemCpuUsagePercent: cpuUsagePercent,
      avgProcessMemoryUsageMB: memoryUsageMB,
      targetAchieved: globalTargetAchieved,
      histogram:
        this._convertWorkerHistogramToTestSummaryHistogram(
          allGlobalHistograms,
        ) || EMPTY_HISTOGRAM,
    };

    return {
      tressiVersion: pkg.version || 'unknown',
      configSnapshot: this._config!,
      global: globalSummary,
      endpoints: endpointSummaries,
    };
  }

  public getTestSummary(): TestSummary {
    // If no snapshots were taken (e.g. test was too short), take one now
    if (this._snapshots.length === 0) {
      this._snapshots.push(
        this.getResults(this._hdrHistogramManagers.length, this._endpoints),
      );
    }
    return transformAggregatedMetricToTestSummary(this._snapshots);
  }

  getCollectedResponseSamples(runId: string): Map<
    string,
    Array<{
      statusCode: number;
      headers: Record<string, string>;
      body: string;
    }>
  > {
    const samples = responseSamplesStore.get(runId) || new Map();
    return samples;
  }

  recordResponseSample(
    runId: string,
    url: string,
    statusCode: number,
    headers: Record<string, string>,
    body: string,
  ): void {
    if (!responseSamplesStore.has(runId)) {
      responseSamplesStore.set(runId, new Map());
    }
    const samples = responseSamplesStore.get(runId)!;

    if (!samples.has(url)) {
      samples.set(url, []);
    }

    const endpointSamples = samples.get(url)!;

    const existingSampleIndex = endpointSamples.findIndex(
      (s) => s.statusCode === statusCode,
    );

    if (existingSampleIndex === -1) {
      endpointSamples.push({
        statusCode,
        headers,
        body,
      });
    }
  }

  cleanupResponseSamples(runId: string): void {
    responseSamplesStore.delete(runId);
  }

  private _calculateGlobalLatencyStats(
    endpointHistograms: Record<string, LatencyHistogram[]>,
  ): {
    averageLatency: number;
    minLatency: number;
    maxLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
  } {
    let totalCount = 0;
    let weightedSum = 0;
    let minLatency = Infinity;
    let maxLatency = 0;

    const allHistograms: LatencyHistogram[] = [];
    Object.values(endpointHistograms).forEach((histograms) => {
      allHistograms.push(...histograms);
    });

    if (allHistograms.length === 0) {
      return {
        averageLatency: 0,
        minLatency: 0,
        maxLatency: 0,
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
      };
    }

    allHistograms.forEach((histogram) => {
      totalCount += histogram.totalCount;
      weightedSum += histogram.mean * histogram.totalCount;
      minLatency = Math.min(minLatency, histogram.min);
      maxLatency = Math.max(maxLatency, histogram.max);
    });

    const averageLatency = totalCount > 0 ? weightedSum / totalCount : 0;

    let weightedP50 = 0;
    let weightedP95 = 0;
    let weightedP99 = 0;

    allHistograms.forEach((histogram) => {
      const weight = histogram.totalCount / totalCount;
      weightedP50 += (histogram.percentiles[50] || 0) * weight;
      weightedP95 += (histogram.percentiles[95] || 0) * weight;
      weightedP99 += (histogram.percentiles[99] || 0) * weight;
    });

    return {
      averageLatency,
      minLatency: minLatency === Infinity ? 0 : minLatency,
      maxLatency,
      p50Latency: weightedP50,
      p95Latency: weightedP95,
      p99Latency: weightedP99,
    };
  }

  private _calculateEndpointLatencyStats(histograms: LatencyHistogram[]): {
    averageLatency: number;
    minLatency: number;
    maxLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    totalCount: number;
  } {
    let totalCount = 0;
    let weightedSum = 0;
    let minLatency = Infinity;
    let maxLatency = 0;

    if (histograms.length === 0) {
      return {
        averageLatency: 0,
        minLatency: 0,
        maxLatency: 0,
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
        totalCount: 0,
      };
    }

    histograms.forEach((histogram) => {
      totalCount += histogram.totalCount;
      weightedSum += histogram.mean * histogram.totalCount;
      minLatency = Math.min(minLatency, histogram.min);
      maxLatency = Math.max(maxLatency, histogram.max);
    });

    const averageLatency = totalCount > 0 ? weightedSum / totalCount : 0;

    let weightedP50 = 0;
    let weightedP95 = 0;
    let weightedP99 = 0;

    histograms.forEach((histogram) => {
      const weight = histogram.totalCount / totalCount;
      weightedP50 += (histogram.percentiles[50] || 0) * weight;
      weightedP95 += (histogram.percentiles[95] || 0) * weight;
      weightedP99 += (histogram.percentiles[99] || 0) * weight;
    });

    return {
      averageLatency,
      minLatency: minLatency === Infinity ? 0 : minLatency,
      maxLatency,
      p50Latency: weightedP50,
      p95Latency: weightedP95,
      p99Latency: weightedP99,
      totalCount,
    };
  }

  private _getGlobalEndpointIndex(
    workerId: number,
    localEndpointIndex: number,
  ): number {
    const workersCount = this._hdrHistogramManagers.length;
    return workerId + localEndpointIndex * workersCount;
  }

  private _convertWorkerHistogramToTestSummaryHistogram(
    histograms: LatencyHistogram[],
  ): LatencyHistogram | undefined {
    if (!histograms || histograms.length === 0) {
      return undefined;
    }

    let totalCount = 0;
    let min = Infinity;
    let max = 0;
    let weightedMeanSum = 0;
    let weightedStdDevSum = 0;

    const percentiles: Record<number, number> = {
      1: 0,
      5: 0,
      10: 0,
      25: 0,
      50: 0,
      75: 0,
      90: 0,
      95: 0,
      99: 0,
    };

    histograms.forEach((histogram) => {
      totalCount += histogram.totalCount;
      min = Math.min(min, histogram.min);
      max = Math.max(max, histogram.max);
    });

    if (totalCount === 0) {
      return undefined;
    }

    Object.keys(percentiles).forEach((p) => {
      const percentile = parseFloat(p);
      let weightedValue = 0;

      histograms.forEach((histogram) => {
        const weight = histogram.totalCount / totalCount;
        weightedValue += (histogram.percentiles[percentile] || 0) * weight;
      });

      percentiles[percentile] = weightedValue;
    });

    histograms.forEach((histogram) => {
      const weight = histogram.totalCount / totalCount;
      weightedMeanSum += histogram.mean * weight;
      weightedStdDevSum += histogram.stdDev * weight;
    });

    const numBuckets = 10;
    const buckets: { lowerBound: number; upperBound: number; count: number }[] =
      [];

    if (totalCount > 0) {
      if (max > min) {
        const logMin = Math.log10(min + 1);
        const logMax = Math.log10(max + 1);
        const logRange = logMax - logMin;
        const logBucketSize = logRange / numBuckets;

        for (let i = 0; i < numBuckets; i++) {
          const lowerLog = logMin + i * logBucketSize;
          const upperLog = logMin + (i + 1) * logBucketSize;

          buckets.push({
            lowerBound: Math.pow(10, lowerLog) - 1,
            upperBound: Math.pow(10, upperLog) - 1,
            count: 0,
          });
        }

        histograms.forEach((h) => {
          h.buckets?.forEach((b) => {
            const midpoint = (b.lowerBound + b.upperBound) / 2;
            const logMidpoint = Math.log10(midpoint + 1);
            let bucketIndex = Math.floor(
              (logMidpoint - logMin) / logBucketSize,
            );

            if (bucketIndex >= numBuckets) {
              bucketIndex = numBuckets - 1;
            }
            if (bucketIndex < 0) {
              bucketIndex = 0;
            }

            buckets[bucketIndex].count += b.count;
          });
        });

        const totalBucketCount = buckets.reduce((sum, b) => sum + b.count, 0);
        if (totalBucketCount < totalCount) {
          buckets[numBuckets - 1].count += totalCount - totalBucketCount;
        } else if (buckets[numBuckets - 1].count === 0 && totalCount > 0) {
          let largestBucketIndex = 0;
          for (let i = 1; i < numBuckets; i++) {
            if (buckets[i].count > buckets[largestBucketIndex].count) {
              largestBucketIndex = i;
            }
          }
          if (buckets[largestBucketIndex].count > 0) {
            buckets[largestBucketIndex].count--;
            buckets[numBuckets - 1].count++;
          }
        }
      } else {
        buckets.push({
          lowerBound: min,
          upperBound: max,
          count: totalCount,
        });
      }
    }

    return {
      totalCount,
      min,
      max,
      mean: weightedMeanSum,
      stdDev: weightedStdDevSum,
      percentiles,
      buckets,
    };
  }
}
