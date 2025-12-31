/**
 * Chart type constants for shared use across UI components and schema validation
 * This provides a single source of truth for all chart-related types
 */

/**
 * Available chart types for displaying test metrics
 */
export const CHART_TYPES = ['throughput', 'latency', 'errorRate'] as const;

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
  { value: 'throughput', label: 'Throughput' },
  { value: 'latency', label: 'Latency' },
  { value: 'errorRate', label: 'Error Rate' },
];

/**
 * Default chart type
 */
export const DEFAULT_CHART_TYPE: ChartType = 'throughput';

/**
 * Chart data structure for line charts
 */
export interface ChartData {
  data: number[];
  labels: number[];
}
