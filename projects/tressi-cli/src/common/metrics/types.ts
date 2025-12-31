export type Metric = {
  averageLatency: number;
  errorPercentage: number;
  failedRequests: number;
  maxLatency: number;
  minLatency: number;
  networkBytesReceived: number;
  networkBytesSent: number;
  networkBytesPerSec: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  requestsPerSecond: number;
  statusCodeDistribution: Record<number, number>;
  successfulRequests: number;
  totalRequests: number;
};

/**
 * Aggregated metrics from all workers and endpoints
 */
export type AggregatedMetrics = {
  epoch: number;
  cpuUsagePercent: number;
  memoryUsageMB: number;
  global: Metric;
  endpoints: {
    [url: string]: Metric;
  };
};
