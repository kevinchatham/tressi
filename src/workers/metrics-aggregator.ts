import { cpus, loadavg } from 'os';

import type { SharedMemoryManager } from './shared-memory-manager';

export interface AggregatedMetrics {
  threads: number;
  cpuUsagePercent: number;
  memoryUsageMB: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  requestsPerSecond: number;
  duration: number;
  statusCodeDistribution: Record<number, number>;
  endpointMetrics: {
    [url: string]: {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      errorRate: number;
      averageLatency: number;
      minLatency: number;
      maxLatency: number;
      p50Latency: number;
      p95Latency: number;
      p99Latency: number;
      requestsPerSecond: number;
      statusCodeDistribution: Record<number, number>;
    };
  };
}

export class MetricsAggregator {
  constructor(private sharedMemory: SharedMemoryManager) {}

  getResults(workersCount: number, endpoints?: string[]): AggregatedMetrics {
    const globalStats = this.sharedMemory.getGlobalStats();
    const endpointStats = this.sharedMemory.getEndpointStats(endpoints);

    // Remove int overflow capping - use actual values
    const totalRequests = globalStats.totalRequests;
    const totalErrors = globalStats.totalErrors;

    // Calculate duration
    const startTime = this.sharedMemory['sharedMetrics'].startTime[0];
    const duration = startTime > 0 ? Date.now() - startTime : 0;

    // Get all latency data
    const allLatencies: number[] = [];

    // Collect latency data from all workers with validation
    for (let workerId = 0; workerId < workersCount; workerId++) {
      const latencies = this.sharedMemory.getLatencyData(workerId);
      // Filter out invalid latency values
      const validLatencies = latencies.filter((lat) => lat > 0 && lat < 60000);
      allLatencies.push(...validLatencies);
    }

    // Calculate latency percentiles
    const sortedLatencies = [...allLatencies].sort((a, b) => a - b);
    const p50 = this.calculatePercentile(sortedLatencies, 0.5);
    const p95 = this.calculatePercentile(sortedLatencies, 0.95);
    const p99 = this.calculatePercentile(sortedLatencies, 0.99);

    const averageLatency =
      allLatencies.length > 0
        ? allLatencies.reduce((sum, lat) => sum + lat, 0) / allLatencies.length
        : 0;

    const minLatency = allLatencies.length > 0 ? Math.min(...allLatencies) : 0;
    const maxLatency = allLatencies.length > 0 ? Math.max(...allLatencies) : 0;

    // Calculate RPS without capping
    const requestsPerSecond =
      duration > 0 ? totalRequests / (duration / 1000) : 0;

    // Build endpoint metrics with per-endpoint latency tracking
    const endpointMetrics: AggregatedMetrics['endpointMetrics'] = {};

    // Create a reliable endpoint index mapping
    const endpointIndexMap = new Map<string, number>();
    if (endpoints) {
      endpoints.forEach((url, index) => {
        endpointIndexMap.set(url, index);
      });
    } else {
      // Fallback to Object.keys order if endpoints not provided
      Object.keys(endpointStats).forEach((url, index) => {
        endpointIndexMap.set(url, index);
      });
    }

    // Get global status code distribution
    const globalStatusCodeDistribution =
      this.sharedMemory.getStatusCodeDistribution();

    for (const [url, stats] of Object.entries(endpointStats)) {
      const endpointIndex = endpointIndexMap.get(url);
      if (endpointIndex === undefined) {
        // eslint-disable-next-line no-console
        console.warn(`Warning: Could not find endpoint index for ${url}`);
        continue;
      }

      // Collect per-endpoint latency data from all workers
      const endpointLatencyData: number[] = [];
      for (let workerId = 0; workerId < workersCount; workerId++) {
        const latencies = this.sharedMemory.getEndpointLatencyData(
          workerId,
          endpointIndex,
        );
        const validLatencies = latencies.filter(
          (lat) => lat > 0 && lat < 60000,
        );
        endpointLatencyData.push(...validLatencies);
      }

      // If no per-endpoint data, fall back to global data (for backward compatibility)
      const useGlobalData = endpointLatencyData.length === 0;
      const latencyData = useGlobalData ? allLatencies : endpointLatencyData;

      const sortedEndpointLatencies = [...latencyData].sort((a, b) => a - b);

      // Get per-endpoint status code distribution
      const endpointStatusCodeDistribution =
        this.sharedMemory.getEndpointStatusCodeDistribution(endpointIndex);

      endpointMetrics[url] = {
        totalRequests: stats.totalRequests,
        successfulRequests: stats.totalRequests - stats.totalErrors,
        failedRequests: stats.totalErrors,
        errorRate:
          stats.totalRequests > 0 ? stats.totalErrors / stats.totalRequests : 0,
        averageLatency:
          latencyData.length > 0
            ? latencyData.reduce((sum, lat) => sum + lat, 0) /
              latencyData.length
            : 0,
        minLatency: latencyData.length > 0 ? Math.min(...latencyData) : 0,
        maxLatency: latencyData.length > 0 ? Math.max(...latencyData) : 0,
        p50Latency: this.calculatePercentile(sortedEndpointLatencies, 0.5),
        p95Latency: this.calculatePercentile(sortedEndpointLatencies, 0.95),
        p99Latency: this.calculatePercentile(sortedEndpointLatencies, 0.99),
        requestsPerSecond:
          duration > 0 ? stats.totalRequests / (duration / 1000) : 0,
        statusCodeDistribution: endpointStatusCodeDistribution,
      };
    }

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

    const metrics: AggregatedMetrics = {
      totalRequests: totalRequests,
      successfulRequests: totalRequests - totalErrors,
      failedRequests: totalErrors,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      averageLatency,
      minLatency,
      maxLatency,
      p50Latency: p50,
      p95Latency: p95,
      p99Latency: p99,
      requestsPerSecond,
      duration,
      statusCodeDistribution: globalStatusCodeDistribution,
      endpointMetrics,
      threads: workersCount,
      cpuUsagePercent,
      memoryUsageMB,
    };

    return metrics;
  }

  private calculatePercentile(
    sortedArray: number[],
    percentile: number,
  ): number {
    if (sortedArray.length === 0) return 0;

    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, index)];
  }
}
