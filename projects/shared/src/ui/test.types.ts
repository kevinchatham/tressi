import type { MetricDocument, TestDocument } from '../common';
import type { TestSummary } from '../common/reporting.types';

/**
 * Test-related UI types for shared use
 */

/**
 * Structure for captured HTTP response samples
 */
export type ResponseSample = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

/**
 * UI-compatible test summary data for event streams
 */
export type TestSummaryData = {
  testId?: string;
  testSummary: TestSummary;
};

/**
 * Standardized tooltips for performance metrics
 */
export const METRIC_TOOLTIPS: Record<string, string> = {
  avgRps: 'Average requests per second throughout the test',
  cpuUsage: 'Average system CPU utilization during the test (Warning: >70%, Critical: >85%)',
  duration: 'Total duration of the test from start to completion',
  endpoints: 'Number of unique endpoints tested',
  errorRate: 'Percentage of requests that failed (non-2xx or network errors)',
  maxLatency: 'Maximum response time observed during the test (slowest)',
  maxThroughput: 'Theoretical maximum RPS based on average latency',
  memoryUsage:
    'Average process memory consumption during the test (Warning: >500MB, Critical: >1GB)',
  minLatency: 'Minimum response time observed during the test',
  networkReceived: 'Total bytes received in response bodies across all requests',
  networkSent: 'Total bytes sent in request bodies across all requests',
  networkThroughput: 'Average data transfer rate during the test',
  p50Latency: 'Median response time - 50% of requests were faster than this',
  p95Latency: '95th percentile - 95% of requests were faster than this (slow)',
  p99Latency: '99th percentile - 99% of requests were faster than this (slower)',
  peakRps: 'Highest instantaneous requests per second achieved during steady-state',
  targetAchieved: 'Percentage of target RPS that was actually achieved',
  totalRequests: 'Total number of requests made during the test',
};

/**
 * Data structure for resolved test details
 */
export type TestDetailResolvedData = {
  test: TestDocument;
  metrics: MetricDocument[];
};
