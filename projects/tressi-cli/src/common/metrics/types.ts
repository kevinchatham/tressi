export type Metric = {
  failedRequests: number;
  maxLatencyMs: number;
  minLatencyMs: number;
  networkBytesReceived: number;
  networkBytesSent: number;
  networkBytesPerSec: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  averageRequestsPerSecond: number;
  peakRequestsPerSecond: number;
  errorRate: number;
  statusCodeDistribution: Record<number, number>;
  successfulRequests: number;
  totalRequests: number;
};

/**
 * CPU usage sample
 */
export type CpuUsageSample = {
  timestamp: number;
  cpuUsagePercent: number;
};

/**
 * Memory usage sample
 */
export type MemoryUsageSample = {
  timestamp: number;
  memoryUsageMB: number;
};

/**
 * Aggregated metrics from all workers and endpoints
 */
export type AggregatedMetrics = {
  epoch: number;
  cpuUsagePercent: number;
  memoryUsageMB: number;
  cpuUsageSamples: CpuUsageSample[];
  memoryUsageSamples: MemoryUsageSample[];
  global: Metric;
  endpoints: {
    [url: string]: Metric;
  };
};
