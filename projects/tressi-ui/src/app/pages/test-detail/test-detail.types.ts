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
