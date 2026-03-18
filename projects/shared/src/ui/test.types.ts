import { MetricDocument, TestDocument } from '../common';
import { TestSummary } from '../common/reporting.types';

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
  minLatency: 'Minimum response time observed during the test',
  p50Latency: 'Median response time - 50% of requests were faster than this',
  p95Latency: '95th percentile - 95% of requests were faster than this (slow)',
  p99Latency:
    '99th percentile - 99% of requests were faster than this (slower)',
  maxLatency: 'Maximum response time observed during the test (slowest)',
  duration: 'Total duration of the test from start to completion',
  endpoints: 'Number of unique endpoints tested',
  targetAchieved: 'Percentage of target RPS that was actually achieved',
  maxThroughput: 'Theoretical maximum RPS based on average latency',
  avgRps: 'Average requests per second throughout the test',
  peakRps: 'Highest requests per second achieved in any 1-second window',
  totalRequests: 'Total number of requests made during the test',
  errorRate: 'Percentage of requests that failed (non-2xx or network errors)',
  networkThroughput: 'Average data transfer rate during the test',
  networkSent: 'Total bytes sent in request bodies across all requests',
  networkReceived:
    'Total bytes received in response bodies across all requests',
  cpuUsage:
    'Average system CPU utilization during the test (Warning: >70%, Critical: >85%)',
  memoryUsage:
    'Average process memory consumption during the test (Warning: >500MB, Critical: >1GB)',
};

/**
 * Data structure for resolved test details
 */
export type TestDetailResolvedData = {
  test: TestDocument;
  metrics: MetricDocument[];
};
