/**
 * Configuration options for HTTP agents used in load testing.
 */
export type AgentConfig = {
  /** Maximum number of concurrent connections per origin. */
  connections?: number;
  /** Timeout for idle keep-alive connections in milliseconds. */
  keepAliveTimeout?: number;
  /** Maximum timeout for keep-alive connections in milliseconds. */
  keepAliveMaxTimeout?: number;
  /** Timeout for receiving response headers in milliseconds. */
  headersTimeout?: number;
  /** Timeout for receiving response body in milliseconds. */
  bodyTimeout?: number;
};

/**
 * Metadata information for test reports.
 */
export type ReportMetadata = {
  /** The name used for exporting the report file. */
  exportName?: string;
  /** The date and time when the test run was executed. */
  runDate?: Date;
};

/**
 * Display options for configuration display
 */
export type DisplayOptions = {
  json?: boolean;
  raw?: boolean;
  source?: string;
};

/**
 * HDR histogram bucket for latency distribution
 */
export type LatencyHistogramBucket = {
  /** Lower bound of the bucket in milliseconds */
  lowerBound: number;
  /** Upper bound of the bucket in milliseconds */
  upperBound: number;
  /** Number of requests in this bucket */
  count: number;
};

/**
 * Latency histogram data structure for detailed latency distribution
 */
export type LatencyHistogram = {
  /** Total number of samples in the histogram */
  totalCount: number;
  /** Minimum latency value in milliseconds */
  min: number;
  /** Maximum latency value in milliseconds */
  max: number;
  /** Mean latency value in milliseconds */
  mean: number;
  /** Standard deviation of latency values in milliseconds */
  stdDev: number;
  /** Percentile values (1st, 5th, 10th, 25th, 50th, 75th, 90th, 95th, 99th) */
  percentiles: Record<number, number>;
  /** Bucket distribution for histogram visualization */
  buckets: LatencyHistogramBucket[];
};

/**
 * Summary statistics for a single endpoint during load testing.
 */
export type EndpointSummary = {
  /** The HTTP method used for requests to this endpoint. */
  method: string;
  /** The URL of the endpoint. */
  url: string;
  /** Total number of requests made to this endpoint. */
  totalRequests: number;
  /** Number of successful requests (2xx status codes). */
  successfulRequests: number;
  /** Number of failed requests (non-2xx status codes or network errors). */
  failedRequests: number;
  /** Minimum latency in milliseconds observed for this endpoint. */
  minLatencyMs: number;
  /** Maximum latency in milliseconds observed for this endpoint. */
  maxLatencyMs: number;
  /** 50th percentile latency in milliseconds across all requests. */
  p50LatencyMs: number;
  /** 95th percentile latency in milliseconds (95% of requests were faster). */
  p95LatencyMs: number;
  /** 99th percentile latency in milliseconds (99% of requests were faster). */
  p99LatencyMs: number;
  /** Average requests per second achieved for this endpoint. */
  averageRequestsPerSecond: number;
  /** Last one sec requests per second achieved for this endpoint. */
  peakRequestsPerSecond: number;
  /** Percentage of configured RPS achieved, derived from actualRps */
  targetAchieved: number;
  /** Theoretical maximum requests per second based on average latency. */
  theoreticalMaxRps: number;
  /** Response body samples captured for this endpoint during the test. */
  responseSamples?: Array<{
    /** The HTTP status code of the sampled response. */
    statusCode: number;
    /** The HTTP headers of the samples response */
    headers: Record<string, string>;
    /** The sampled response body. */
    body: string;
  }>;
  /** Distribution of HTTP status codes received for this endpoint */
  statusCodeDistribution: Record<number, number>;
  /** error rate as a decimal */
  errorRate: number;
  /** The aggregated histogram of the test */
  histogram: LatencyHistogram;
};

/**
 * Global summary statistics across all endpoints in the load test.
 */
export type GlobalSummary = {
  /** Total number of unique endpoints tested. */
  totalEndpoints: number;
  /** Total number of requests made across all endpoints. */
  totalRequests: number;
  /** Total number of successful requests across all endpoints. */
  successfulRequests: number;
  /** Total number of failed requests across all endpoints. */
  failedRequests: number;
  /** Minimum latency in milliseconds observed across all requests. */
  minLatencyMs: number;
  /** Maximum latency in milliseconds observed across all requests. */
  maxLatencyMs: number;
  /** 50th percentile latency in milliseconds across all requests. */
  p50LatencyMs: number;
  /** 95th percentile latency in milliseconds across all requests. */
  p95LatencyMs: number;
  /** 99th percentile latency in milliseconds across all requests. */
  p99LatencyMs: number;
  /** Total duration of the test in seconds. */
  finalDurationSec: number;
  /** Time of test start. */
  epochStartedAt: number;
  /** Time of test end. */
  epochEndedAt: number;
  /** error rate as a decimal */
  errorRate: number;
  /** Average requests per second achieved for this endpoint. */
  averageRequestsPerSecond: number;
  /** Last one sec requests per second achieved for this endpoint. */
  peakRequestsPerSecond: number;
  /** Total number of bytes sent across all requests. */
  networkBytesSent: number;
  /** Total number of bytes received across all responses. */
  networkBytesReceived: number;
  /** Network throughput in bytes per second. */
  networkBytesPerSec: number;
  /** Average system CPU usage percentage during the test (based on load average) */
  avgSystemCpuUsagePercent: number;
  /** Average process heap memory usage in MB during the test */
  avgProcessMemoryUsageMB: number;
  /** Average percentage of configured RPS achieved across all endpoints */
  targetAchieved: number;
  /** The aggregated histogram of the test */
  histogram: LatencyHistogram;
};

/**
 * Complete test summary containing both global and per-endpoint statistics.
 */
import { TressiConfig } from './config.types';

/**
 * Complete test summary containing both global and per-endpoint statistics.
 */
export type TestSummary = {
  /** The version of Tressi used to run the test. */
  tressiVersion: string;
  /** Snapshot of TressiConfig when test was run */
  configSnapshot: TressiConfig;
  /** Global summary statistics across all endpoints. */
  global: GlobalSummary;
  /** Array of summary statistics for each individual endpoint. */
  endpoints: EndpointSummary[];
};

/**
 * Represents the result of a single request made during the load test.
 */
export type RequestResult = {
  /** The HTTP method used for the request. */
  method: string;
  /** The URL that was requested. */
  url: string;
  /** The HTTP status code of the response. */
  status: number;
  /** The time taken for the request to complete, in milliseconds. */
  latencyMs: number;
  /** Whether the request was considered successful. */
  success: boolean;
  /** Any error message if the request failed. */
  error?: string;
  /** The timestamp when the request was completed. */
  timestamp: number;
  /** The sampled response body, if captured. */
  body?: string;
  /** The HTTP response headers. */
  headers?: Record<string, unknown>;
  /** Number of bytes sent in the request body. */
  bytesSent?: number;
  /** Number of bytes received in the response body. */
  bytesReceived?: number;
};

/**
 * Map of HTTP status codes to their frequency counts
 */
export type StatusCodeMap = Record<number, number>;

/**
 * Response samples collected during load testing
 * Key: Endpoint URL
 * Value: Array of response samples with status code, headers, and body
 */
export type ResponseSamples = Record<
  string,
  Array<{
    statusCode: number;
    headers: Record<string, unknown>;
    body: string;
  }>
>;
