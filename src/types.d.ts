import type { Dispatcher } from 'undici';
import z from 'zod';

import { RequestConfigSchema, TressiConfigSchema } from './config';

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
 * Represents an HTTP agent configuration for a specific endpoint.
 */
export type EndpointAgent = {
  /** The URL of the endpoint this agent is configured for. */
  url: string;
  /** The HTTP dispatcher/agent instance for making requests to this endpoint. */
  agent: Dispatcher;
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

/**
 * Defines the options for a Tressi load test run.
 */
export type RunOptions = {
  /** The configuration for the test. Can be a path to a file, a URL, or a configuration object. */
  config: string | TressiConfig;
  /** The number of concurrent workers to use. Defaults to 10. For autoscale, this is the max workers. */
  workers?: number;
  /** The total duration of the test in seconds. Defaults to 10. */
  durationSec?: number;
  /** The time in seconds to ramp up to the target RPS. Defaults to 0. */
  rampUpTimeSec?: number;
  /** The target requests per second. If not provided, the test will run at maximum possible speed. */
  rps?: number;
  /** Whether to enable autoscale mode. Defaults to false. --rps is required for this. */
  autoscale?: boolean;
  /** The base path for the exported report. If not provided, no report will be generated. */
  exportPath?: string | boolean;
  /** Whether to use the terminal UI. Defaults to true. */
  useUI?: boolean;
  /** Suppress all console output. Defaults to false. */
  silent?: boolean;
  /** Whether to enable early exit on error conditions. Defaults to false. */
  earlyExitOnError?: boolean;
  /** Error rate threshold (0.0-1.0) to trigger early exit. Requires earlyExitOnError=true. */
  errorRateThreshold?: number;
  /** Absolute error count threshold to trigger early exit. Requires earlyExitOnError=true. */
  errorCountThreshold?: number;
  /** Specific HTTP status codes that should trigger early exit. Requires earlyExitOnError=true. */
  errorStatusCodes?: number[];
  /** Number of concurrent requests per worker. Defaults to dynamic calculation based on target RPS. */
  concurrentRequestsPerWorker?: number;
};

/**
 * Type representing the Tressi configuration.
 */
export type TressiConfig = z.infer<typeof TressiConfigSchema>;

/**
 * Type representing a single request configuration.
 */
export type RequestConfig = z.infer<typeof RequestConfigSchema>;
