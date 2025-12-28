// Import types from rpc.service.ts
import type { TestDocument as RpcTestDocument } from '../../services/rpc.service';
import type { TestMetrics as RpcTestMetrics } from '../../services/rpc.service';
import type { GlobalMetric as RpcGlobalMetric } from '../../services/rpc.service';
import type { EndpointMetric as RpcEndpointMetric } from '../../services/rpc.service';

// Re-export types for convenience
export type TestDocument = RpcTestDocument;
export type TestMetrics = RpcTestMetrics;
export type GlobalMetric = RpcGlobalMetric;
export type EndpointMetric = RpcEndpointMetric;

/**
 * Generic metric data structure with epoch timestamp and typed metric value
 */
export interface MetricData<T> {
  epoch: number;
  metric: T;
}

/**
 * Data structure for export functionality
 */
export interface ExportData {
  test: TestDocument;
  metrics: TestMetrics;
  exportedAt: string;
}

/**
 * Chart data structure for line charts
 */
export interface ChartData {
  data: number[];
  labels: number[];
}

/**
 * Endpoint metrics with summary information
 */
export interface EndpointMetricsWithSummary {
  url: string;
  metrics: EndpointMetric[];
  summary: {
    avgThroughput: number;
    avgLatency: number;
    avgErrorRate: number;
  };
}

/**
 * Endpoint summary statistics
 */
export interface EndpointSummary {
  totalEndpoints: number;
  totalRequests: number;
  avgThroughput: number;
  avgLatency: number;
  avgErrorRate: number;
}

/**
 * Cache structure for endpoint chart data
 */
export type EndpointChartDataCache = Map<string, Map<string, ChartData>>;
