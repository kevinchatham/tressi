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

  getResults(workersCount: number): AggregatedMetrics {
    const globalStats = this.sharedMemory.getGlobalStats();
    const endpointStats = this.sharedMemory.getEndpointStats();

    // Validate and sanitize global stats to prevent overflow
    const totalRequests = Math.min(globalStats.totalRequests, 1000000);
    const totalErrors = Math.min(globalStats.totalErrors, totalRequests);

    // Calculate duration
    const startTime = this.sharedMemory['sharedMetrics'].startTime[0];
    const duration = startTime > 0 ? Date.now() - startTime : 0;

    // Get all latency data
    const allLatencies: number[] = [];
    const endpointLatencies: { [url: string]: number[] } = {};

    // Collect latency data from all workers with validation
    for (let workerId = 0; workerId < workersCount; workerId++) {
      const latencies = this.sharedMemory.getLatencyData(workerId);
      // Filter out invalid latency values
      const validLatencies = latencies.filter((lat) => lat > 0 && lat < 60000);
      allLatencies.push(...validLatencies);

      // Group by endpoint (simplified for now)
      for (const latency of validLatencies) {
        if (!endpointLatencies['all']) {
          endpointLatencies['all'] = [];
        }
        endpointLatencies['all'].push(latency);
      }
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

    // Calculate RPS with realistic bounds
    const requestsPerSecond =
      duration > 0 ? Math.min(totalRequests / (duration / 1000), 10000) : 0;

    // Build endpoint metrics with validation
    const endpointMetrics: AggregatedMetrics['endpointMetrics'] = {};

    for (const [url, stats] of Object.entries(endpointStats)) {
      const endpointLatencyData = endpointLatencies['all'] || [];
      const sortedEndpointLatencies = [...endpointLatencyData].sort(
        (a, b) => a - b,
      );

      // Validate endpoint stats
      const endpointTotal = Math.min(stats.totalRequests, 1000000);
      const endpointErrors = Math.min(stats.totalErrors, endpointTotal);

      endpointMetrics[url] = {
        totalRequests: endpointTotal,
        successfulRequests: endpointTotal - endpointErrors,
        failedRequests: endpointErrors,
        errorRate: endpointTotal > 0 ? endpointErrors / endpointTotal : 0,
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

    return {
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
