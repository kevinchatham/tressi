/**
 * Type for formatted statistics output
 */
export type FormattedStats = {
  global: {
    totalRequests: string;
    successfulRequests: string;
    failedRequests: string;
    avgLatencyMs: string;
    minLatencyMs: string;
    maxLatencyMs: string;
    p95LatencyMs: string;
    p99LatencyMs: string;
    actualRps: string;
    theoreticalMaxRps: string;
    achievedPercentage: string;
    duration: string;
  };
  endpoints: Array<{
    method: string;
    url: string;
    totalRequests: string;
    successfulRequests: string;
    failedRequests: string;
    avgLatencyMs: string;
    minLatencyMs: string;
    maxLatencyMs: string;
    p95LatencyMs: string;
    p99LatencyMs: string;
    failureRate: string;
  }>;
};

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
  /** Average latency in milliseconds across all requests. */
  avgLatencyMs: number;
  /** Minimum latency in milliseconds observed for this endpoint. */
  minLatencyMs: number;
  /** Maximum latency in milliseconds observed for this endpoint. */
  maxLatencyMs: number;
  /** 95th percentile latency in milliseconds (95% of requests were faster). */
  p95LatencyMs: number;
  /** 99th percentile latency in milliseconds (99% of requests were faster). */
  p99LatencyMs: number;
};

/**
 * Global summary statistics across all endpoints in the load test.
 */
export type GlobalSummary = {
  /** Total number of requests made across all endpoints. */
  totalRequests: number;
  /** Total number of successful requests across all endpoints. */
  successfulRequests: number;
  /** Total number of failed requests across all endpoints. */
  failedRequests: number;
  /** Average latency in milliseconds across all requests. */
  avgLatencyMs: number;
  /** Minimum latency in milliseconds observed across all requests. */
  minLatencyMs: number;
  /** Maximum latency in milliseconds observed across all requests. */
  maxLatencyMs: number;
  /** 95th percentile latency in milliseconds across all requests. */
  p95LatencyMs: number;
  /** 99th percentile latency in milliseconds across all requests. */
  p99LatencyMs: number;
  /** Actual requests per second achieved during the test. */
  actualRps: number;
  /** Theoretical maximum requests per second based on average latency. */
  theoreticalMaxRps: number;
  /** Percentage of theoretical maximum RPS that was achieved. */
  achievedPercentage: number;
  /** Total duration of the test in seconds. */
  duration: number;
};

/**
 * Complete test summary containing both global and per-endpoint statistics.
 */
export type TestSummary = {
  /** The version of Tressi used to run the test. */
  tressiVersion: string;
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
  /** Number of bytes sent in the request body. */
  bytesSent?: number;
  /** Number of bytes received in the response body. */
  bytesReceived?: number;
};
