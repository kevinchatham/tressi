import { cpus, loadavg } from 'os';

import { endpointMetricStorage } from '../collections/endpoint-metrics-collection';
import { globalMetricStorage } from '../collections/global-metrics-collection';
import type { TressiConfig } from '../common/config/types';
import type { AggregatedMetrics, Metric } from '../common/metrics';
import { ServerEvents } from '../events/event-types';
import { globalEventEmitter } from '../events/global-event-emitter';
import type { TestSummary } from '../reporting/types';
import { transformAggregatedMetricToTestSummary } from '../reporting/utils/transformations';
import { truncateToDecimals } from '../utils/math-utils';
import {
  IHdrHistogramManager,
  IMetricsAggregator,
  IStatsCounterManager,
} from './interfaces';
import { LatencyHistogram } from './types';

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

export class MetricsAggregator implements IMetricsAggregator {
  private pollingInterval: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private endTime: number = 0;
  private endpoints: string[] = [];
  private config: TressiConfig | null = null;
  private testId?: string; // Optional for server persistence
  private previousEndpointCounts: Record<
    string,
    { success: number; failure: number; timestamp: number }
  > = {};
  private rpsWindowSamples: Record<
    string,
    Array<{ timestamp: number; rps: number }>
  > = {};
  private previousGlobalCounts: {
    success: number;
    failure: number;
    timestamp: number;
  } = {
    success: 0,
    failure: 0,
    timestamp: 0,
  };
  private cpuUsageSamples: Array<{
    timestamp: number;
    cpuUsagePercent: number;
  }> = [];
  private memoryUsageSamples: Array<{
    timestamp: number;
    memoryUsageMB: number;
  }> = [];
  private metricsSamplingInterval: NodeJS.Timeout | null = null;

  constructor(
    private hdrHistogramManagers: IHdrHistogramManager[],
    private statsCounterManagers: IStatsCounterManager[],
    private endpointMethodMap: Record<string, string> = {},
    private runId: string,
  ) {}

  /**
   * Set the testId for server mode persistence
   * @param testId The test ID from database
   */
  setTestId(testId: string): void {
    this.testId = testId;
  }

  /**
   * Set the start time for duration calculations
   * @param startTime Unix timestamp in milliseconds
   */
  public setStartTime(startTime: number): void {
    this.startTime = startTime;
    // Reset RPS window samples for new test
    this.rpsWindowSamples = {};
    // Initialize previous global counts with zero values to ensure proper peak RPS calculation
    this.previousGlobalCounts = {
      success: 0,
      failure: 0,
      timestamp: startTime,
    };
    this.startMetricsSampling();
  }

  /**
   * Set the end time for duration calculations
   * @param endTime Unix timestamp in milliseconds
   */
  public setEndTime(endTime: number): void {
    this.endTime = endTime;
    this.stopMetricsSampling();
  }

  /**
   * Start collecting resource usage samples at regular intervals
   */
  private startMetricsSampling(): void {
    if (this.metricsSamplingInterval) {
      clearInterval(this.metricsSamplingInterval);
    }

    // Sample every 2 seconds during the test
    this.metricsSamplingInterval = setInterval(() => {
      this.collectResourceUsageSample();
    }, 2000);
  }

  /**
   * Stop collecting resource usage samples
   */
  private stopMetricsSampling(): void {
    if (this.metricsSamplingInterval) {
      clearInterval(this.metricsSamplingInterval);
      this.metricsSamplingInterval = null;
    }
  }

  /**
   * Collect a single resource usage sample
   */
  private collectResourceUsageSample(): void {
    const timestamp = Date.now();

    // Calculate CPU usage percentage based on system load average
    const cpuCount = cpus().length;
    const loadAvg = loadavg()[0];
    const cpuUsagePercent = Math.min(
      Math.round((loadAvg / cpuCount) * 100),
      100,
    );

    // Calculate memory usage in MB
    const memoryUsageMB = Math.round(
      process.memoryUsage().heapUsed / 1024 / 1024,
    );

    this.cpuUsageSamples.push({ timestamp, cpuUsagePercent });
    this.memoryUsageSamples.push({ timestamp, memoryUsageMB });
  }

  /**
   * Calculate average from samples
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, value) => acc + value, 0);
    return Math.round(sum / values.length);
  }

  /**
   * Calculate the peak RPS window size based on test duration
   * Uses 10% of test duration with a minimum of 1 second and maximum of 10 seconds
   * @param testDurationMs - Test duration in milliseconds
   * @returns Window size in milliseconds
   */
  private calculatePeakRpsWindowMs(testDurationMs: number): number {
    return Math.min(Math.max(testDurationMs * 0.1, 1000), 10_000);
  }

  /**
   * Calculate peak RPS over a sliding window for a specific key
   * @param key - The key to track samples for ('global' or endpoint URL)
   * @param currentTime - Current timestamp in milliseconds
   * @param windowMs - Window size in milliseconds
   * @returns RPS value over the window
   */
  private calculateWindowedPeakRps(
    key: string,
    currentTime: number,
    windowMs: number,
  ): number {
    // Initialize samples array for this key if it doesn't exist
    if (!this.rpsWindowSamples[key]) {
      this.rpsWindowSamples[key] = [];
    }

    // Prevent unbounded growth - remove samples older than window
    this.rpsWindowSamples[key] = this.rpsWindowSamples[key].filter(
      (sample) => currentTime - sample.timestamp <= windowMs,
    );

    // Extract RPS values
    const rpsValues = this.rpsWindowSamples[key].map((s) => s.rps);

    // Return 0 if no samples
    if (rpsValues.length === 0) {
      return 0;
    }

    // Sort RPS values
    const sortedRps = rpsValues.sort((a, b) => a - b);

    // Calculate median percentile index with bounds checking
    const index = Math.min(
      Math.floor(sortedRps.length * 0.5),
      sortedRps.length - 1,
    );

    return sortedRps[index];
  }

  /**
   * Set the configuration for metrics aggregation
   * @param config The Tressi configuration
   */
  setConfig(config: TressiConfig): void {
    this.config = config;
  }

  /**
   * Set the endpoints for metrics collection
   * @param endpoints Array of endpoint URLs
   */
  setEndpoints(endpoints: string[]): void {
    this.endpoints = endpoints;
    // Initialize previous endpoint counts with zero values to ensure proper peak RPS calculation
    const startTime = this.startTime || Date.now();
    this.previousEndpointCounts = {};
    endpoints.forEach((url) => {
      this.previousEndpointCounts[url] = {
        success: 0,
        failure: 0,
        timestamp: startTime,
      };
    });
  }

  /**
   * Start polling for metrics updates
   * @param intervalMs Polling interval in milliseconds
   */
  startPolling(intervalMs: number = 1000): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    this.startTime = Date.now();
    this.pollingInterval = setInterval(async () => {
      await this.pollMetrics();
    }, intervalMs);
  }

  /**
   * Stop polling for metrics updates
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.endTime = Date.now(); // ← Capture end time
  }

  /**
   * Polls metrics from all workers and broadcasts updates.
   *
   * @remarks
   * This method is called on a regular interval to collect and display real-time metrics.
   * It retrieves aggregated results from all workers and endpoints, updates the terminal display,
   * and broadcasts metrics via Server-Sent Events for the web UI.
   *
   * The polling approach ensures that metrics are updated frequently enough for real-time
   * monitoring while being efficient enough to not impact test performance.
   */
  private async pollMetrics(): Promise<void> {
    try {
      const metrics = this.getResults(
        this.hdrHistogramManagers.length,
        this.endpoints,
      );

      const testSummary = this.getTestSummary(
        this.hdrHistogramManagers.length,
        this.endpoints,
      );

      // ! terminal.clearAndPrint(metrics);

      globalEventEmitter.emit(ServerEvents.METRICS, {
        testId: this.testId,
        testSummary,
      });

      // Store metrics if testId is provided (server mode)
      if (this.testId) {
        // Store global metrics
        await globalMetricStorage.create({
          testId: this.testId,
          metric: metrics.global,
          epoch: metrics.epoch,
        });

        // Store per-endpoint metrics
        for (const [url, endpointMetric] of Object.entries(metrics.endpoints)) {
          await endpointMetricStorage.create({
            testId: this.testId,
            url,
            metric: endpointMetric,
            epoch: metrics.epoch,
          });
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to persist metrics to database:', error);
    }
  }

  /**
   * Get aggregated results from all workers and endpoints
   * @param workersCount Number of workers
   * @param endpoints Array of endpoint URLs
   * @returns Aggregated metrics
   */
  getResults(workersCount: number, endpoints: string[]): AggregatedMetrics {
    let totalSuccess = 0;
    let totalFailure = 0;
    let totalRequests = 0;

    // Collect histogram statistics from all workers and endpoints
    const endpointHistograms: Record<string, LatencyHistogram[]> = {};
    const endpointStatusCounts: Record<string, Record<number, number>> = {};

    // Initialize endpoint data structures
    endpoints.forEach((url) => {
      endpointHistograms[url] = [];
      endpointStatusCounts[url] = {};
    });

    // Aggregate data from all workers
    let totalBytesSent = 0;
    let totalBytesReceived = 0;

    // Track current endpoint counts for instant RPS calculation
    const currentEndpointCounts: Record<
      string,
      { success: number; failure: number }
    > = {};

    for (let workerId = 0; workerId < workersCount; workerId++) {
      const statsManager = this.statsCounterManagers[workerId];
      const histogramManager = this.hdrHistogramManagers[workerId];

      if (!statsManager || !histogramManager) continue;

      // Get all endpoint counters for this worker
      const allCounters = statsManager.getAllEndpointCounters();

      // Get all endpoint histograms for this worker
      const allHistograms = histogramManager.getAllEndpointHistograms();

      // Process each endpoint owned by this worker
      allCounters.forEach((counters, localEndpointIndex: number) => {
        const globalEndpointIndex = this.getGlobalEndpointIndex(
          workerId,
          localEndpointIndex,
        );
        if (globalEndpointIndex >= endpoints.length) return;

        const endpointUrl = endpoints[globalEndpointIndex];

        // Initialize current counts for this endpoint if not exists
        if (!currentEndpointCounts[endpointUrl]) {
          currentEndpointCounts[endpointUrl] = { success: 0, failure: 0 };
        }

        // Aggregate success/failure counts
        totalSuccess += counters.successCount;
        totalFailure += counters.failureCount;
        totalRequests += counters.successCount + counters.failureCount;

        // Track current counts for peak RPS calculation
        currentEndpointCounts[endpointUrl].success += counters.successCount;
        currentEndpointCounts[endpointUrl].failure += counters.failureCount;

        // Aggregate network metrics
        totalBytesSent += counters.bytesSent;
        totalBytesReceived += counters.bytesReceived;

        // Aggregate status code counts
        Object.entries(counters.statusCodeCounts).forEach(
          ([statusCode, count]) => {
            const code = parseInt(statusCode);
            endpointStatusCounts[endpointUrl][code] =
              (endpointStatusCounts[endpointUrl][code] || 0) + count;
          },
        );

        // Get histogram data for this endpoint
        const histogramData = allHistograms[localEndpointIndex];
        if (histogramData && histogramData.totalCount > 0) {
          // Store the histogram statistics directly
          endpointHistograms[endpointUrl].push(histogramData);
        }
      });
    }

    const currentTime = Date.now();

    // Calculate test duration and window size
    const testDurationMs =
      this.endTime > 0
        ? this.endTime - this.startTime
        : currentTime - this.startTime;
    const windowMs = this.calculatePeakRpsWindowMs(testDurationMs);

    // Calculate global metrics
    const duration = this.startTime > 0 ? currentTime - this.startTime : 0;
    const averageRequestsPerSecond =
      duration > 0 ? totalRequests / (duration / 1000) : 0;

    // Calculate global latency statistics using weighted averages
    const globalStats = this.calculateGlobalLatencyStats(endpointHistograms);

    // Calculate global status code distribution
    const globalStatusCodeDistribution: Record<number, number> = {};
    Object.values(endpointStatusCounts).forEach((statusCounts) => {
      Object.entries(statusCounts).forEach(([statusCode, count]) => {
        const code = parseInt(statusCode);
        globalStatusCodeDistribution[code] =
          (globalStatusCodeDistribution[code] || 0) + count;
      });
    });

    // Build per-endpoint metrics
    const endpointMetrics: AggregatedMetrics['endpoints'] = {};

    endpoints.forEach((url) => {
      const histograms = endpointHistograms[url];
      const statusCounts = endpointStatusCounts[url];

      // Calculate endpoint-level statistics
      const endpointStats = this.calculateEndpointLatencyStats(histograms);
      const endpointTotalRequests = endpointStats.totalCount;

      const endpointSuccessRequests = Object.values(statusCounts).reduce(
        (sum, count) => sum + count,
        0,
      );
      const endpointFailureRequests =
        endpointTotalRequests - endpointSuccessRequests;

      // Aggregate network metrics per endpoint
      let endpointBytesSent = 0;
      let endpointBytesReceived = 0;

      for (let workerId = 0; workerId < workersCount; workerId++) {
        const statsManager = this.statsCounterManagers[workerId];
        if (!statsManager) continue;

        const allCounters = statsManager.getAllEndpointCounters();
        allCounters.forEach((counters, localEndpointIndex) => {
          const globalEndpointIndex = this.getGlobalEndpointIndex(
            workerId,
            localEndpointIndex,
          );
          if (globalEndpointIndex >= endpoints.length) return;

          const endpointUrl = endpoints[globalEndpointIndex];
          if (endpointUrl === url) {
            endpointBytesSent += counters.bytesSent;
            endpointBytesReceived += counters.bytesReceived;
          }
        });
      }

      const endpointBytesPerSec =
        duration > 0
          ? (endpointBytesSent + endpointBytesReceived) / (duration / 1000)
          : 0;

      // Calculate peak RPS based on difference from previous counts
      const currentCounts = currentEndpointCounts[url] || {
        success: 0,
        failure: 0,
      };

      const previousCounts = this.previousEndpointCounts[url];

      let peakRequestsPerSecond = 0;
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
        peakRequestsPerSecond = timeDiffSec > 0 ? requestDiff / timeDiffSec : 0;
      }

      // Store sample for windowed peak calculation (per-endpoint)
      if (!this.rpsWindowSamples[url]) {
        this.rpsWindowSamples[url] = [];
      }
      this.rpsWindowSamples[url].push({
        timestamp: currentTime,
        rps: peakRequestsPerSecond,
      });

      // Calculate windowed peak RPS for this endpoint
      const endpointPeakRps = this.calculateWindowedPeakRps(
        url,
        currentTime,
        windowMs,
      );

      // Update previous counts for next calculation
      this.previousEndpointCounts[url] = {
        success: currentCounts.success,
        failure: currentCounts.failure,
        timestamp: currentTime,
      };

      endpointMetrics[url] = {
        totalRequests: endpointTotalRequests,
        successfulRequests: endpointSuccessRequests,
        failedRequests: endpointFailureRequests,
        minLatencyMs: truncateToDecimals(endpointStats.minLatency),
        maxLatencyMs: truncateToDecimals(endpointStats.maxLatency),
        p50LatencyMs: truncateToDecimals(endpointStats.p50Latency),
        p95LatencyMs: truncateToDecimals(endpointStats.p95Latency),
        p99LatencyMs: truncateToDecimals(endpointStats.p99Latency),
        averageRequestsPerSecond: truncateToDecimals(
          duration > 0 ? endpointTotalRequests / (duration / 1000) : 0,
        ),
        peakRequestsPerSecond: truncateToDecimals(endpointPeakRps),
        statusCodeDistribution: statusCounts,
        networkBytesSent: endpointBytesSent,
        networkBytesReceived: endpointBytesReceived,
        networkBytesPerSec: truncateToDecimals(endpointBytesPerSec),
        errorRate: endpointFailureRequests / endpointTotalRequests,
      };
    });

    // Calculate global peak RPS
    let globalPeakRpsDiff = 0;
    if (
      this.previousGlobalCounts.timestamp > 0 &&
      currentTime > this.previousGlobalCounts.timestamp
    ) {
      const timeDiffMs = currentTime - this.previousGlobalCounts.timestamp;
      const timeDiffSec = timeDiffMs / 1000;
      const requestDiff =
        totalRequests -
        (this.previousGlobalCounts.success + this.previousGlobalCounts.failure);
      globalPeakRpsDiff = timeDiffSec > 0 ? requestDiff / timeDiffSec : 0;
    }

    // Store sample for global windowed peak calculation
    if (!this.rpsWindowSamples['global']) {
      this.rpsWindowSamples['global'] = [];
    }
    this.rpsWindowSamples['global'].push({
      timestamp: currentTime,
      rps: globalPeakRpsDiff,
    });

    // Calculate global windowed peak RPS
    const globalPeakRps = this.calculateWindowedPeakRps(
      'global',
      currentTime,
      windowMs,
    );

    // Update previous global counts for next calculation
    this.previousGlobalCounts = {
      success: totalSuccess,
      failure: totalFailure,
      timestamp: currentTime,
    };

    // Calculate CPU usage percentage based on system load average
    const cpuCount = cpus().length;
    const loadAvg = loadavg()[0];
    const currentCpuUsagePercent = Math.min(
      Math.round((loadAvg / cpuCount) * 100),
      100,
    );

    // Calculate memory usage in MB
    const currentMemoryUsageMB = Math.round(
      process.memoryUsage().heapUsed / 1024 / 1024,
    );

    // Add final sample if test is still running
    if (this.endTime === 0) {
      this.cpuUsageSamples.push({
        timestamp: currentTime,
        cpuUsagePercent: currentCpuUsagePercent,
      });
      this.memoryUsageSamples.push({
        timestamp: currentTime,
        memoryUsageMB: currentMemoryUsageMB,
      });
    }

    // Calculate averages from samples
    const cpuUsagePercent = this.calculateAverage(
      this.cpuUsageSamples.map((s) => s.cpuUsagePercent),
    );
    const memoryUsageMB = this.calculateAverage(
      this.memoryUsageSamples.map((s) => s.memoryUsageMB),
    );

    // Calculate global network throughput
    const globalBytesPerSec =
      duration > 0
        ? (totalBytesSent + totalBytesReceived) / (duration / 1000)
        : 0;

    const globalMetrics: Metric = {
      totalRequests,
      successfulRequests: totalSuccess,
      failedRequests: totalFailure,
      minLatencyMs: truncateToDecimals(globalStats.minLatency),
      maxLatencyMs: truncateToDecimals(globalStats.maxLatency),
      p50LatencyMs: truncateToDecimals(globalStats.p50Latency),
      p95LatencyMs: truncateToDecimals(globalStats.p95Latency),
      p99LatencyMs: truncateToDecimals(globalStats.p99Latency),
      averageRequestsPerSecond: truncateToDecimals(averageRequestsPerSecond),
      peakRequestsPerSecond: truncateToDecimals(globalPeakRps),
      statusCodeDistribution: globalStatusCodeDistribution,
      networkBytesSent: totalBytesSent,
      networkBytesReceived: totalBytesReceived,
      networkBytesPerSec: truncateToDecimals(globalBytesPerSec),
      errorRate: totalFailure / totalRequests,
    };

    return {
      epoch: currentTime,
      cpuUsagePercent,
      memoryUsageMB,
      cpuUsageSamples: this.cpuUsageSamples,
      memoryUsageSamples: this.memoryUsageSamples,
      global: globalMetrics,
      endpoints: endpointMetrics,
    };
  }

  /**
   * Get TestSummary for real-time UI updates
   * @param workersCount Number of workers
   * @param endpoints Array of endpoint URLs
   * @returns TestSummary object for UI consumption
   */
  public getTestSummary(
    workersCount: number,
    endpoints: string[],
  ): TestSummary {
    const metrics = this.getResults(workersCount, endpoints);
    const duration =
      this.startTime > 0 ? (Date.now() - this.startTime) / 1000 : 0;

    if (!this.config) {
      throw new Error('Config not set in MetricsAggregator');
    }

    const responseSamplesMap = this.getCollectedResponseSamples(this.runId);

    // Convert Map to Record for TestSummary
    const responseSamples: Record<
      string,
      Array<{
        statusCode: number;
        headers: Record<string, string>;
        body: string;
      }>
    > = {};

    Array.from(responseSamplesMap.entries()).forEach(([url, samples]) => {
      responseSamples[url] = samples;
    });

    // Collect histogram data from all workers
    const globalHistograms: LatencyHistogram[] = [];
    const endpointHistograms: Record<string, LatencyHistogram[]> = {};

    // Initialize endpoint histograms
    endpoints.forEach((url) => {
      endpointHistograms[url] = [];
    });

    // Aggregate histogram data from all workers
    for (let workerId = 0; workerId < workersCount; workerId++) {
      const histogramManager = this.hdrHistogramManagers[workerId];
      if (!histogramManager) continue;

      const allHistograms = histogramManager.getAllEndpointHistograms();

      // Process each endpoint
      allHistograms.forEach((histogram, localEndpointIndex) => {
        const globalEndpointIndex = this.getGlobalEndpointIndex(
          workerId,
          localEndpointIndex,
        );
        if (globalEndpointIndex >= endpoints.length) return;

        const endpointUrl = endpoints[globalEndpointIndex];

        if (histogram && histogram.totalCount > 0) {
          // Add to endpoint histograms
          endpointHistograms[endpointUrl].push(histogram);

          // Add to global histograms
          globalHistograms.push(histogram);
        }
      });
    }

    // Use stored times (endTime captured in stopPolling)
    const epochStartedAt = this.startTime;
    const epochEndedAt = this.endTime > 0 ? this.endTime : Date.now();

    return transformAggregatedMetricToTestSummary(
      metrics,
      duration,
      this.endpointMethodMap,
      this.config,
      epochStartedAt,
      epochEndedAt,
      responseSamples,
      {
        global: globalHistograms,
        endpoints: endpointHistograms,
      },
    );
  }

  /**
   * Get collected body samples for a run
   * @param runId The run ID
   * @returns Map of endpoint URL to body samples
   */
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

  /**
   * Record a body sample from a worker thread
   * @param statusCode HTTP status code
   * @param body Response body content
   * @param url Endpoint URL
   * @param runId The run ID to associate samples with
   */
  recordResponseSample(
    runId: string,
    url: string,
    statusCode: number,
    headers: Record<string, string>,
    body: string,
  ): void {
    // Store directly under runId (no more 'current' key pattern)
    if (!responseSamplesStore.has(runId)) {
      responseSamplesStore.set(runId, new Map());
    }
    const samples = responseSamplesStore.get(runId)!;

    if (!samples.has(url)) {
      samples.set(url, []);
    }

    const endpointSamples = samples.get(url)!;

    // Only store one sample per status code (as per the original design)
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

  /**
   * Clean up body samples for a run
   * @param runId The run ID to clean up
   */
  cleanupResponseSamples(runId: string): void {
    responseSamplesStore.delete(runId);
  }

  /**
   * Calculates global latency statistics by aggregating histograms across all endpoints.
   *
   * @param endpointHistograms - Map of endpoint URLs to their histogram arrays from all workers
   * @returns Global latency statistics including mean, min, max, and percentiles
   *
   * @remarks
   * Uses a weighted averaging approach where histograms with more samples have greater influence
   * on the final statistics. This ensures that endpoints with higher traffic properly influence
   * the global metrics.
   *
   * The algorithm:
   * 1. Collects all histograms from all workers and endpoints
   * 2. Calculates weighted averages for mean, min, and max latency
   * 3. Uses weighted averaging of pre-calculated percentiles for p50, p95, p99
   * 4. Handles edge cases like empty histograms gracefully
   *
   * @example
   * ```typescript
   * const globalStats = aggregator.calculateGlobalLatencyStats({
   *   'https://api.example.com/users': [worker1Histogram, worker2Histogram],
   *   'https://api.example.com/posts': [worker1Histogram, worker2Histogram]
   * });
   * ```
   */
  private calculateGlobalLatencyStats(
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

    // Collect all histograms for global aggregation
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

    // Calculate weighted averages for mean, min, max
    allHistograms.forEach((histogram) => {
      totalCount += histogram.totalCount;
      weightedSum += histogram.mean * histogram.totalCount;
      minLatency = Math.min(minLatency, histogram.min);
      maxLatency = Math.max(maxLatency, histogram.max);
    });

    const averageLatency = totalCount > 0 ? weightedSum / totalCount : 0;

    // For percentiles, use weighted average of pre-calculated percentiles
    // This is an approximation but respects the HDR histogram pattern
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

  /**
   * Calculates endpoint-level latency statistics by aggregating histograms for a single endpoint.
   *
   * @param histograms - Array of histograms for this endpoint from different workers
   * @returns Endpoint latency statistics including mean, min, max, percentiles, and total count
   *
   * @remarks
   * Similar to global statistics but focused on a single endpoint. Uses weighted averaging
   * where histograms with more samples contribute proportionally more to the final statistics.
   *
   * This method is essential for per-endpoint performance analysis, allowing identification
   * of slow endpoints independently of overall system performance.
   *
   * The algorithm:
   * 1. Aggregates total request count across all worker histograms
   * 2. Calculates weighted mean latency based on sample counts
   * 3. Determines overall min/max from individual histogram extremes
   * 4. Computes weighted percentiles from pre-calculated percentile values
   *
   * @example
   * ```typescript
   * const endpointStats = aggregator.calculateEndpointLatencyStats([
   *   worker1Histogram, // e.g., 1000 requests, mean 50ms
   *   worker2Histogram  // e.g., 1500 requests, mean 45ms
   * ]);
   * // Result: weighted average based on 2500 total requests
   * ```
   */
  private calculateEndpointLatencyStats(histograms: LatencyHistogram[]): {
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

    // Calculate weighted averages for mean, min, max
    histograms.forEach((histogram) => {
      totalCount += histogram.totalCount;
      weightedSum += histogram.mean * histogram.totalCount;
      minLatency = Math.min(minLatency, histogram.min);
      maxLatency = Math.max(maxLatency, histogram.max);
    });

    const averageLatency = totalCount > 0 ? weightedSum / totalCount : 0;

    // For percentiles, use weighted average of pre-calculated percentiles
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
      averageLatency: truncateToDecimals(averageLatency),
      minLatency: truncateToDecimals(minLatency === Infinity ? 0 : minLatency),
      maxLatency: truncateToDecimals(maxLatency),
      p50Latency: truncateToDecimals(weightedP50),
      p95Latency: truncateToDecimals(weightedP95),
      p99Latency: truncateToDecimals(weightedP99),
      totalCount,
    };
  }

  /**
   * Converts worker-local endpoint indices to global endpoint indices.
   *
   * @param workerId - The worker identifier
   * @param localEndpointIndex - Local index within the worker (0..n-1)
   * @returns Global endpoint index across all workers (0..total_endpoints-1)
   *
   * @remarks
   * Uses round-robin distribution logic to map local indices to global indices.
   * This is essential for coordinating between worker-local metrics storage
   * and global endpoint identification in shared memory structures.
   *
   * @example
   * ```typescript
   * // With 4 endpoints and 2 workers:
   * // Worker 0: local 0 -> global 0, local 1 -> global 2
   * // Worker 1: local 0 -> global 1, local 1 -> global 3
   * ```
   */
  private getGlobalEndpointIndex(
    workerId: number,
    localEndpointIndex: number,
  ): number {
    // Calculate based on round-robin distribution
    const workersCount = this.hdrHistogramManagers.length;
    return workerId + localEndpointIndex * workersCount;
  }
}
