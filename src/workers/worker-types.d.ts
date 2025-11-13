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

  // Latency data (8 bytes * bufferSize * workers)
  latencyBuffer: Float64Array; // Circular buffer per worker
  latencyWriteIndex: Int32Array; // Write index per worker

  // Control flags (4 bytes * workers + 4 bytes)
  workerStatus: Int32Array; // Worker state (0=ready, 1=running, 2=stopped, 3=error)
  shutdownFlag: Int32Array; // Global shutdown signal (0=continue, 1=shutdown)

  // Early exit coordination (NEW)
  earlyExitTriggered: Int32Array; // Global early exit flag (0=continue, 1=exit)
  endpointEarlyExit: Int32Array; // Per-endpoint exit flags (0=continue, 1=exit)
  globalErrorCount: Int32Array; // Atomic error counter for thresholds
  globalRequestCount: Int32Array; // Atomic request counter for rate calculation
}

export interface WorkerMessage {
  type: 'start' | 'stop' | 'config' | 'error' | 'heartbeat' | 'early_exit';
  payload?: unknown;
  workerId?: number;
}

export interface WorkerData {
  workerId: number;
  endpoints: TressiRequestConfig[];
  sharedBuffer: SharedArrayBuffer;
  memoryLimit: number;
  totalWorkers: number;
}

export interface WorkerResult {
  success: boolean;
  latency: number;
  endpointIndex: number;
}

export interface GlobalStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalErrors: number;
  errorRate: number;
}

export interface EndpointStats {
  [url: string]: {
    totalRequests: number;
    totalErrors: number;
    errorRate: number;
    errorCount: number;
  };
}
