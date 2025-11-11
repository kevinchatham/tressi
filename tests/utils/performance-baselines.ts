export interface MemoryUsage {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
}

export interface PerformanceBaseline {
  timestamp: string;
  nodeVersion: string;
  platform: string;
  metrics: {
    startupTime: number;
    healthCheckLatency: number;
    successEndpointLatency: number;
    delayEndpointLatency: number;
    concurrentRequestLatency: number;
    memoryUsage: MemoryUsage;
  };
}

export const DEFAULT_BASELINE: PerformanceBaseline = {
  timestamp: new Date().toISOString(),
  nodeVersion: process.version,
  platform: process.platform,
  metrics: {
    startupTime: 1000,
    healthCheckLatency: 25,
    successEndpointLatency: 20,
    delayEndpointLatency: 125,
    concurrentRequestLatency: 500,
    memoryUsage: {
      rss: 30 * 1024 * 1024,
      heapTotal: 20 * 1024 * 1024,
      heapUsed: 15 * 1024 * 1024,
      external: 2 * 1024 * 1024,
    },
  },
};

export const PERFORMANCE_THRESHOLDS = {
  startupTime: 10000, // Increased for CI environments
  healthCheckLatency: 300, // Increased for CI environments
  successEndpointLatency: 300, // Increased for CI environments
  delayEndpointLatency: 5000, // Increased for CI environments
  concurrentRequestLatency: 8000, // Increased for CI environments
  memoryIncrease: 100 * 1024 * 1024, // Increased for CI environments
};
