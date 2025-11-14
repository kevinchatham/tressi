import type { SharedMemoryManager } from './shared-memory-manager';

export interface AggregatedMetrics {
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

    // Build endpoint metrics without capping
    const endpointMetrics: AggregatedMetrics['endpointMetrics'] = {};

    for (const [url, stats] of Object.entries(endpointStats)) {
      // For now, use all latencies for each endpoint since we don't have per-endpoint tracking
      // This is a limitation that should be addressed in future improvements
      const endpointLatencyData = allLatencies;
      const sortedEndpointLatencies = [...endpointLatencyData].sort(
        (a, b) => a - b,
      );

      endpointMetrics[url] = {
        totalRequests: stats.totalRequests,
        successfulRequests: stats.totalRequests - stats.totalErrors,
        failedRequests: stats.totalErrors,
        errorRate:
          stats.totalRequests > 0 ? stats.totalErrors / stats.totalRequests : 0,
        averageLatency:
          endpointLatencyData.length > 0
            ? endpointLatencyData.reduce((sum, lat) => sum + lat, 0) /
              endpointLatencyData.length
            : 0,
        minLatency:
          endpointLatencyData.length > 0 ? Math.min(...endpointLatencyData) : 0,
        maxLatency:
          endpointLatencyData.length > 0 ? Math.max(...endpointLatencyData) : 0,
        p50Latency: this.calculatePercentile(sortedEndpointLatencies, 0.5),
        p95Latency: this.calculatePercentile(sortedEndpointLatencies, 0.95),
        p99Latency: this.calculatePercentile(sortedEndpointLatencies, 0.99),
      };
    }

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
      endpointMetrics,
    };

    // do not remove / do not eslint ignore
    console.log('\nDEBUG: Request Metrics', metrics);

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
