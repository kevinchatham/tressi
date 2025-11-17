/**
 * Base interface for all quadrant data
 */
export interface QuadrantData {
  timestamp: number;
  elapsedSec: number;
  aggregatedMetrics: import('../../workers/metrics-aggregator').AggregatedMetrics;
}

/**
 * Data interface for Quadrant 1: RPS Chart
 */
export interface Quadrant1RPSData extends QuadrantData {
  targetRPS?: number;
  actualRPS: number;
  successRPS: number;
  errorRPS: number;
  viewMode: 'actual-target' | 'success-error' | 'all-metrics';
}

/**
 * Data interface for Quadrant 2: Latency Chart
 */
export interface Quadrant2LatencyData extends QuadrantData {
  percentiles: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    min: number;
    max: number;
  };
  viewMode: 'line-chart' | 'gauge';
  timeLabels: string[];
}

/**
 * Data interface for Quadrant 3: System Metrics
 */
export interface Quadrant3SystemData extends QuadrantData {
  systemMetrics: {
    cpuUsage: number;
    memoryUsageMB: number;
    networkThroughputMBps: number;
  };
  configData?: {
    endpoints: string[];
    targetRPS: number;
    duration: number;
    workers: number;
    status: 'running' | 'paused' | 'completed';
  };
  viewMode: 'system-metrics' | 'app-config';
}

/**
 * Data interface for Quadrant 4: Status Distribution
 */
export interface Quadrant4StatusData extends QuadrantData {
  statusDistribution: {
    '2xx': number;
    '3xx': number;
    '4xx': number;
    '5xx': number;
  };
  detailedStatusCodes?: Array<{
    code: number;
    count: number;
    avgLatency: number;
  }>;
  viewMode: 'status-distribution' | 'detailed-analysis';
  totalRequests: number;
}

/**
 * Standardized interface for all quadrant components
 */
export interface QuadrantComponent {
  update(data: QuadrantData): void;
  clear(): void;
  getElement(): import('blessed').Widgets.BlessedElement;
  setViewMode(mode: string): void;
  getViewMode?(): string;
}
