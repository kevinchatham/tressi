export type EndpointMetric = {
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
 * Aggregated metrics from all workers and endpoints
 */
export type AggregatedMetric = {
  epoch: number;
  cpuUsagePercent: number;
  memoryUsageMB: number;
  global: EndpointMetric;
  endpoints: {
    [url: string]: EndpointMetric;
  };
};
