/**
 * Chart data structure for line charts
 */
export interface ChartData {
  data: number[];
  labels: number[];
}

/**
 * Cache structure for endpoint chart data
 */
export type EndpointChartDataCache = Map<string, Map<string, ChartData>>;
