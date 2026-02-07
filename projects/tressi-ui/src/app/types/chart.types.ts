/**
 * Chart type constants for shared use across UI components and schema validation
 * This provides a single source of truth for all chart-related types
 */

/**
 * Available chart types for displaying test metrics
 */
export const CHART_TYPES = [
  'peak_throughput',
  'average_throughput',
  'latency',
] as const;

/**
 * Chart type union type derived from the constants
 */
export type ChartType = (typeof CHART_TYPES)[number];

/**
 * Chart option interface for UI components
 */
export interface ChartOption {
  value: ChartType;
  label: string;
}

/**
 * Predefined chart options for UI select components
 */
export const CHART_OPTIONS: ChartOption[] = [
  { value: 'peak_throughput', label: 'Peak Throughput' },
  { value: 'average_throughput', label: 'Avg Throughput' },
  { value: 'latency', label: 'Latency' },
];

/**
 * Default chart type
 */
export const DEFAULT_CHART_TYPE: ChartType = 'peak_throughput';

/**
 * Chart data structure for line charts
 */
export interface ChartData {
  data: number[];
  labels: number[];
}
