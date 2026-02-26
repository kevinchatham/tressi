/**
 * Chart type constants for shared use across UI components and schema validation
 * This provides a single source of truth for all chart-related types
 */

/**
 * Available chart types for displaying test metrics
 */
export const CHART_TYPES = [
  'target_achieved',
  'peak_throughput',
  'average_throughput',
  'latency',

  // Phase 1: Enhanced Latency
  'latency_p95',
  'latency_p99',
  'latency_min_max',

  // Phase 2: Error & Reliability
  'error_rate',
  'success_rate',
  'failed_requests',

  // Phase 3: Network Performance
  'network_throughput',
  'network_bytes_sent',
  'network_bytes_received',
] as const;

/**
 * Chart type union type derived from the constants
 */
export type ChartType = (typeof CHART_TYPES)[number];

/**
 * Chart option interface for UI components
 */
export type ChartOption = {
  value: ChartType;
  label: string;
};

/**
 * Predefined chart options for UI select components
 */
export const CHART_OPTIONS: ChartOption[] = [
  // Throughput Category
  { value: 'target_achieved', label: 'Target Achieved' },
  { value: 'peak_throughput', label: 'Peak RPS' },
  { value: 'average_throughput', label: 'Average RPS' },

  // Latency Category
  { value: 'latency', label: 'P50 Latency' },
  { value: 'latency_p95', label: 'P95 Latency' },
  { value: 'latency_p99', label: 'P99 Latency' },

  // Reliability Category
  { value: 'success_rate', label: 'Success Rate' },
  { value: 'error_rate', label: 'Error Rate' },
  { value: 'failed_requests', label: 'Failed Requests' },

  // Network Category
  { value: 'network_throughput', label: 'Bytes Throughput' },
  { value: 'network_bytes_sent', label: 'Bytes Sent' },
  { value: 'network_bytes_received', label: 'Bytes Received' },
];

/**
 * Default chart type
 */
export const DEFAULT_CHART_TYPE: ChartType = 'peak_throughput';

/**
 * Chart data structure for line charts
 * Supports both single series and multi-series data
 */
export type ChartData = {
  data: number[] | { [seriesName: string]: number[] };
  labels: number[];
};

/**
 * Polling interval options for real-time updates
 */
export const POLLING_OPTIONS = [
  { label: 'Manual', value: 0 },
  { label: '1 second', value: 1_000 },
  { label: '5 seconds', value: 5000 },
  { label: '10 seconds', value: 10000 },
  { label: '30 seconds', value: 30000 },
] as const;

/**
 * Polling interval value type
 */
export type PollingInterval = (typeof POLLING_OPTIONS)[number]['value'];
