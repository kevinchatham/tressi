import type { TressiRequestConfig } from '../types';

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
