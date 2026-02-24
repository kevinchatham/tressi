import { TressiRequestConfig } from '../common/config/types';

// Re-export latency histogram types from reporting module (single source of truth)
export type {
  LatencyHistogram,
  LatencyHistogramBucket,
} from '../reporting/types';

/**
 * Endpoint counters for tracking request statistics
 */
export type EndpointCounters = {
  successCount: number;
  failureCount: number;
  bytesSent: number;
  bytesReceived: number;
  statusCodeCounts: Record<number, number>;
  sampledStatusCodes: number[];
  bodySampleIndices: number[];
};

/**
 * Body sample data structure
 */
export type BodySample = {
  sampleIndex: number;
  statusCode: number;
};

export type SharedMemoryOptions = {
  significantFigures?: number;
  lowestTrackableValue?: number;
  highestTrackableValue?: number;
  ringBufferSize?: number;
  bodySampleBufferSize?: number;
};

/**
 * Worker states for lifecycle management
 */
export enum WorkerState {
  INITIALIZING = 1,
  READY = 2,
  RUNNING = 3,
  PAUSED = 4,
  FINISHED = 5,
  ERROR = 6,
  TERMINATED = 7,
}

/**
 * Endpoint states for selective stopping
 */
export enum EndpointState {
  RUNNING = 1,
  STOPPED = 2,
  ERROR = 3,
}

/**
 * Data structure passed to worker threads
 */
export type WorkerData = {
  workerId: number;
  totalWorkers: number;
  durationSec: number;
  rampUpDurationSec: number;
  assignedEndpoints: TressiRequestConfig[];
  endpointOffset: number;
  statsBuffer: SharedArrayBuffer;
  histogramBuffer: SharedArrayBuffer;
  bodySampleBuffers: SharedArrayBuffer[];
  workerStateBuffer: SharedArrayBuffer;
  endpointStateBuffer: SharedArrayBuffer;
};

/**
 * Early exit thresholds configuration
 */
export type EarlyExitThresholds = {
  perEndpoint: Map<
    string,
    {
      errorRate?: number;
      errorCount?: number;
      exitStatusCodes: Set<number>;
      monitoringWindowMs: number;
    }
  >;
  monitoringWindowMs: number;
};
