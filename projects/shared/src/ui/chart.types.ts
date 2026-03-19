import type {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexGrid,
  ApexMarkers,
  ApexStroke,
  ApexTitleSubtitle,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
} from 'ng-apexcharts';

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
  { label: 'Target Achieved', value: 'target_achieved' },
  { label: 'Peak RPS', value: 'peak_throughput' },
  { label: 'Average RPS', value: 'average_throughput' },

  // Latency Category
  { label: 'P50 Latency', value: 'latency' },
  { label: 'P95 Latency', value: 'latency_p95' },
  { label: 'P99 Latency', value: 'latency_p99' },

  // Reliability Category
  { label: 'Success Rate', value: 'success_rate' },
  { label: 'Error Rate', value: 'error_rate' },
  { label: 'Failed Requests', value: 'failed_requests' },

  // Network Category
  { label: 'Bytes Throughput', value: 'network_throughput' },
  { label: 'Bytes Sent', value: 'network_bytes_sent' },
  { label: 'Bytes Received', value: 'network_bytes_received' },
];

/**
 * Default chart type
 */
export const DEFAULT_CHART_TYPE: ChartType = 'target_achieved';

/**
 * Default polling interval for line chart update mechanism
 */
export const DEFAULT_CHART_POLLING_INTERVAL = 1000;

/**
 * Chart data structure for line charts
 * Supports both single series and multi-series data
 */
export type ChartData = {
  data: number[] | { [seriesName: string]: number[] };
  labels: number[];
};

/**
 * Polling interval options for realtime updates
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

/**
 * Chart synchronization state for multiple charts
 */
export type ChartSyncState = {
  xAxisMin: number | null;
  xAxisMax: number | null;
  selectionStart: number | null;
  selectionEnd: number | null;
  lastInteractedChartId: string | null;
};

/**
 * Cache structure for endpoint chart data
 * Key 1: Endpoint URL
 * Key 2: Chart Type (e.g., 'latency', 'rps')
 */
export type EndpointChartDataCache = Map<string, Map<string, ChartData>>;

/**
 * Event data for chart interactions
 */
export type ChartEventData = {
  event: MouseEvent;
  chartContext: unknown;
  config: unknown;
};

/**
 * Configuration options for line charts
 */
export type LineChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  dataLabels: ApexDataLabels;
  stroke: ApexStroke;
  title: ApexTitleSubtitle;
  grid: ApexGrid;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  tooltip: ApexTooltip;
  markers: ApexMarkers;
};
