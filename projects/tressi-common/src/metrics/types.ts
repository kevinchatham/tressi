export type EndpointMetrics = {
  averageLatency: number;
  errorRate: number;
  failedRequests: number;
  maxLatency: number;
  minLatency: number;
  networkBytesReceived: number;
  networkBytesSent: number;
  networkThroughputMBps: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  requestsPerSecond: number;
  statusCodeDistribution: Record<number, number>;
  successfulRequests: number;
  totalRequests: number;
};

/**
 * Global metrics across all endpoints
 */
export type GlobalMetrics = {
  totalSuccess: number;
  totalFailure: number;
  totalRequests: number;
  errorRate: number;
};

/**
 * Aggregated metrics from all workers and endpoints
 */
export type AggregatedMetrics = {
  threads: number;
  cpuUsagePercent: number;
  memoryUsageMB: number;
  duration: number;
  global: EndpointMetrics;
  endpoints: {
    [url: string]: EndpointMetrics;
  };
};
