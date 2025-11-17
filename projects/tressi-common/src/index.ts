import z from 'zod';

/**
 * Zod schema for a single request configuration.
 */
export const TressiRequestConfigSchema = z.object({
  /** The URL to send the request to. */
  url: z.string().url(),
  /** The request payload. Can be a JSON object or an array. */
  payload: z
    .record(z.string(), z.unknown())
    .or(z.array(z.unknown()))
    .optional(),
  /** The HTTP method to use for the request. Defaults to GET. */
  method: z
    .preprocess(
      (val) => (typeof val === 'string' ? val.toUpperCase() : val),
      z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
    )
    .default('GET'),
  /** Headers to be sent with this specific request. Merged with global headers. */
  headers: z.record(z.string(), z.string()).optional(),
  /** Per-endpoint requests per second limit. Defaults to 1. */
  rps: z.number().int().min(1).default(1),
});

export const TressiOptionsConfigSchema = z
  .object({
    /** The total duration of the test in seconds. Defaults to 10. */
    durationSec: z.number().int().positive().default(10),
    /** The time in seconds to ramp up to the target RPS. Defaults to 0. */
    rampUpTimeSec: z.number().int().nonnegative().default(0),
    /** The base path for the exported report. If not provided, no report will be generated. */
    exportPath: z.union([z.string(), z.boolean()]).optional(),
    /** Whether to use the terminal UI. Defaults to true. */
    useUI: z.boolean().default(true),
    /** Suppress all console output. Defaults to false. */
    silent: z.boolean().default(false),
    /** Whether to enable early exit on error conditions. Defaults to false. */
    earlyExitOnError: z.boolean().default(false),
    /** Error rate threshold (0.0-1.0) to trigger early exit. Requires earlyExitOnError=true. */
    errorRateThreshold: z.number().min(0).max(1).optional(),
    /** Absolute error count threshold to trigger early exit. Requires earlyExitOnError=true. */
    errorCountThreshold: z.number().int().positive().optional(),
    /** Specific HTTP status codes that should trigger early exit. Requires earlyExitOnError=true. */
    errorStatusCodes: z.array(z.number().int().positive()).optional(),
    /** Global headers to be sent with every request. */
    headers: z.record(z.string(), z.string()).optional(),
    threads: z
      .number()
      .int()
      .min(1)
      .max(32)
      .optional()
      .describe('Number of worker threads to use (defaults to CPU count)'),
    workerMemoryLimit: z
      .number()
      .int()
      .min(16)
      .max(512)
      .default(128)
      .describe('Memory limit per worker in MB'),
    workerEarlyExit: z
      .object({
        /** Enable early exit coordination across all workers */
        enabled: z.boolean().default(false),
        /** Global error rate threshold (0.0-1.0) across all workers */
        globalErrorRateThreshold: z.number().min(0).max(1).optional(),
        /** Global error count threshold across all workers */
        globalErrorCountThreshold: z.number().int().positive().optional(),
        /** Per-endpoint error rate thresholds */
        perEndpointThresholds: z
          .array(
            z.object({
              url: z.string(),
              errorRateThreshold: z.number().min(0).max(1),
              errorCountThreshold: z.number().int().positive().optional(),
            }),
          )
          .optional(),
        /** Specific HTTP status codes that trigger immediate worker shutdown */
        workerExitStatusCodes: z.array(z.number().int().positive()).optional(),
        /** Time window in milliseconds for threshold calculation */
        monitoringWindowMs: z.number().int().positive().default(1000),
        /** Whether to stop individual endpoints vs entire test */
        stopMode: z.enum(['endpoint', 'global']).default('endpoint'),
      })
      .optional()
      .default({
        enabled: false,
        monitoringWindowMs: 1000,
        stopMode: 'endpoint',
      }),
  })
  .refine(
    (data) => {
      // If earlyExitOnError is enabled, at least one threshold must be provided
      if (data.earlyExitOnError) {
        return !!(
          data.errorRateThreshold ||
          data.errorCountThreshold ||
          data.errorStatusCodes
        );
      }
      return true;
    },
    {
      message:
        'At least one of errorRateThreshold, errorCountThreshold, or errorStatusCodes must be provided when earlyExitOnError is enabled',
      path: ['earlyExitOnError'],
    },
  )
  .refine(
    (data) => {
      // useUI and silent cannot both be true
      return !(data.useUI && data.silent);
    },
    {
      message:
        'useUI and silent options cannot both be true. The TUI requires output, but silent mode suppresses all output.',
      path: ['useUI', 'silent'],
    },
  )
  .refine(
    (data) => {
      // Validate worker early exit configuration
      if (data.workerEarlyExit?.enabled) {
        const hasGlobalThreshold = !!(
          data.workerEarlyExit.globalErrorRateThreshold ||
          data.workerEarlyExit.globalErrorCountThreshold ||
          data.workerEarlyExit.workerExitStatusCodes
        );
        const hasPerEndpoint = !!(
          data.workerEarlyExit.perEndpointThresholds &&
          data.workerEarlyExit.perEndpointThresholds.length > 0
        );
        return hasGlobalThreshold || hasPerEndpoint;
      }
      return true;
    },
    {
      message:
        'At least one threshold must be provided when workerEarlyExit is enabled',
      path: ['workerEarlyExit'],
    },
  );

export const defaultTressiOptions = TressiOptionsConfigSchema.parse({
  durationSec: 10,
  rampUpTimeSec: 0,
  useUI: true,
  silent: false,
  earlyExitOnError: false,
  workerMemoryLimit: 128,
  workerEarlyExit: {
    enabled: false,
    monitoringWindowMs: 1000,
    stopMode: 'endpoint',
  },
});

/**
 * Zod schema for the main Tressi configuration.
 */
export const TressiConfigSchema = z.object({
  /** A URL to the JSON schema for this configuration file. */
  $schema: z.string(),
  /** An array of request configurations. */
  requests: z.array(TressiRequestConfigSchema),
  /** Configuration options for the test runner. */
  options: TressiOptionsConfigSchema.default(defaultTressiOptions),
});

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

export type DisplayOptions = {
  json?: boolean;
  raw?: boolean;
  source?: string;
};

/**
 * Type representing the Tressi configuration.
 */
export type TressiConfig = z.infer<typeof TressiConfigSchema>;

/**
 * Type representing the options configuration.
 */
export type TressiOptionsConfig = z.infer<typeof TressiOptionsConfigSchema>;

/**
 * Type representing a single request configuration.
 */
export type TressiRequestConfig = z.infer<typeof TressiRequestConfigSchema>;

// TODO ORGANIZE - WORKER TYPES BELOW
export interface SharedMetrics {
  // Global counters (20 bytes total)
  totalRequests: Int32Array; // 4 bytes - atomic counter
  successfulRequests: Int32Array; // 4 bytes - atomic counter
  failedRequests: Int32Array; // 4 bytes - atomic counter
  startTime: Float64Array; // 8 bytes - test start time

  // Per-endpoint counters (12 bytes * endpoints * workers)
  endpointRequests: Int32Array; // 4 bytes per endpoint per worker
  endpointSuccess: Int32Array; // 4 bytes per endpoint per worker
  endpointFailures: Int32Array; // 4 bytes per endpoint per worker

  // Global latency data (8 bytes * bufferSize * workers) - for backward compatibility
  latencyBuffer: Float64Array; // Circular buffer per worker
  latencyWriteIndex: Int32Array; // Write index per worker

  // Per-endpoint latency data (8 bytes * bufferSize * workers * endpoints)
  endpointLatencyBuffer: Float64Array; // Circular buffer per worker per endpoint
  endpointLatencyWriteIndex: Int32Array; // Write index per worker per endpoint

  // Control flags (4 bytes * workers + 4 bytes)
  workerStatus: Int32Array; // Worker state (0=ready, 1=running, 2=stopped, 3=error)
  shutdownFlag: Int32Array; // Global shutdown signal (0=continue, 1=shutdown)

  // Early exit coordination
  earlyExitTriggered: Int32Array; // Global early exit flag (0=continue, 1=exit)
  endpointEarlyExit: Int32Array; // Per-endpoint exit flags (0=continue, 1=exit)
  globalErrorCount: Int32Array; // Atomic error counter for thresholds
  globalRequestCount: Int32Array; // Atomic request counter for rate calculation

  // Network bandwidth tracking
  networkBytesSent: Float64Array; // Total bytes sent (8 bytes)
  networkBytesReceived: Float64Array; // Total bytes received (8 bytes)
  endpointNetworkBytesSent: Float64Array; // Per-endpoint bytes sent (8 bytes * endpoints * workers)
  endpointNetworkBytesReceived: Float64Array; // Per-endpoint bytes received (8 bytes * endpoints * workers)

  // Status code tracking
  statusCodeCounts: Int32Array; // Global status code counts (indices 100-599)
  endpointStatusCodeCounts: Int32Array; // Per-endpoint status codes (600 * endpoints * workers)
}

export interface WorkerMessage {
  type: 'start' | 'stop' | 'config' | 'error' | 'heartbeat' | 'early_exit';
  payload?: unknown;
  workerId?: number;
}

export interface WorkerData {
  workerId: number;
  endpoints: TressiRequestConfig[];
  allEndpoints: TressiRequestConfig[];
  sharedBuffer: SharedArrayBuffer;
  memoryLimit: number;
  totalWorkers: number;
  durationSec: number;
}

export interface WorkerResult {
  success: boolean;
  latency: number;
  endpointIndex: number;
  bytesSent?: number;
  bytesReceived?: number;
}

export interface GlobalStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalErrors: number;
  errorRate: number;
  networkBytesSent: number;
  networkBytesReceived: number;
}

export interface EndpointStats {
  [url: string]: {
    totalRequests: number;
    totalErrors: number;
    errorRate: number;
    errorCount: number;
    networkBytesSent: number;
    networkBytesReceived: number;
  };
}
