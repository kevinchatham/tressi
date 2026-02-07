import { ChartData } from '../../types/chart.types';

/**
 * Cache structure for endpoint chart data
 */
export type EndpointChartDataCache = Map<string, Map<string, ChartData>>;

/**
 * Color state for performance metrics
 * - 'good': Normal/healthy state (green)
 * - 'warning': Elevated/caution state (yellow)
 * - 'error': Critical/problem state (red)
 */
export type MetricState = 'good' | 'warning' | 'error';

/**
 * DaisyUI color classes for metric states
 */
export interface MetricStateClasses {
  /** Background color class (e.g., 'bg-success/20') */
  bg: string;
  /** Text color class (e.g., 'text-success') */
  text: string;
}

/**
 * Tooltip content mapping for all metric labels
 * Keys correspond to metric identifiers used in the metrics-summary component
 */
export interface MetricTooltips {
  /** Minimum latency tooltip */
  minLatency: string;
  /** P50 (median) latency tooltip */
  p50Latency: string;
  /** P95 latency tooltip */
  p95Latency: string;
  /** P99 latency tooltip */
  p99Latency: string;
  /** Maximum latency tooltip */
  maxLatency: string;
  /** Test duration tooltip */
  duration: string;
  /** Endpoints tested tooltip */
  endpoints: string;
  /** Target achieved percentage tooltip */
  targetAchieved: string;
  /** Theoretical max throughput tooltip */
  maxThroughput: string;
  /** Average RPS tooltip */
  avgRps: string;
  /** Peak RPS tooltip */
  peakRps: string;
  /** Total requests tooltip */
  totalRequests: string;
  /** Error rate tooltip */
  errorRate: string;
  /** Network throughput tooltip */
  networkThroughput: string;
  /** Network bytes sent tooltip */
  networkSent: string;
  /** Network bytes received tooltip */
  networkReceived: string;
  /** CPU usage tooltip with threshold info */
  cpuUsage: string;
  /** Memory usage tooltip with threshold info */
  memoryUsage: string;
}

/**
 * Threshold configuration for metric state determination
 */
export interface MetricThresholds {
  /** CPU usage thresholds in percent */
  cpu: {
    /** Good threshold - below this is good (default: 70) */
    warning: number;
    /** Warning threshold - below this is warning, above is error (default: 85) */
    error: number;
  };
  /** Memory usage thresholds in MB */
  memory: {
    /** Good threshold - below this is good in MB (default: 500) */
    warning: number;
    /** Warning threshold - below this is warning, above is error in MB (default: 1000) */
    error: number;
  };
}

/**
 * Default threshold values for metric state determination
 */
export const DEFAULT_METRIC_THRESHOLDS: MetricThresholds = {
  cpu: {
    warning: 70,
    error: 85,
  },
  memory: {
    warning: 500,
    error: 1000,
  },
};

/**
 * CPU threshold state with human-readable descriptions
 */
export interface CpuThresholdInfo {
  /** Current state based on CPU usage */
  state: MetricState;
  /** Description of the current state */
  description: string;
  /** Formatted CPU percentage */
  formattedValue: string;
}

/**
 * Memory threshold state with human-readable descriptions
 */
export interface MemoryThresholdInfo {
  /** Current state based on memory usage */
  state: MetricState;
  /** Description of the current state */
  description: string;
  /** Formatted memory value */
  formattedValue: string;
}

/**
 * Network metrics display data
 */
export interface NetworkMetricsDisplay {
  /** Formatted throughput string (e.g., "1.2 MB/s") */
  throughputFormatted: string;
  /** Formatted bytes sent string (e.g., "512 MB") */
  bytesSentFormatted: string;
  /** Formatted bytes received string (e.g., "1.2 GB") */
  bytesReceivedFormatted: string;
  /** Raw values for calculations */
  raw: {
    bytesPerSec: number;
    bytesSent: number;
    bytesReceived: number;
  };
}

/**
 * System resource metrics display data
 */
export interface SystemMetricsDisplay {
  /** CPU usage information */
  cpu: CpuThresholdInfo;
  /** Memory usage information */
  memory: MemoryThresholdInfo;
}

/**
 * Throughput metrics display data
 */
export interface ThroughputMetricsDisplay {
  /** Average RPS formatted string */
  averageRpsFormatted: string;
  /** Peak RPS formatted string */
  peakRpsFormatted: string;
  /** Whether peak RPS is available */
  hasPeakRps: boolean;
  /** Raw values for calculations */
  raw: {
    averageRps: number;
    peakRps: number;
  };
}

/**
 * Complete enhanced metrics display data for a test summary
 * Used to pass pre-calculated display values to components
 */
export interface EnhancedMetricsDisplay {
  /** Throughput metrics */
  throughput: ThroughputMetricsDisplay;
  /** Network metrics (global view only) */
  network?: NetworkMetricsDisplay;
  /** System resource metrics (global view only) */
  system?: SystemMetricsDisplay;
}
