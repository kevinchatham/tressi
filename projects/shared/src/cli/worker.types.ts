import type { TressiRequestConfig } from '../common/config.types';
import type { IGlobalServerEvents, IRunnerEvents } from '../common/event.types';
import type { LatencyHistogram, TestSummary } from '../common/reporting.types';
import { EndpointState, WorkerState } from '../common/test.types';

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
 * Data structure passed to worker threads
 */
export type WorkerData = {
  workerId: number;
  totalWorkers: number;
  durationSec: number;
  rampUpDurationSec: number;
  assignedEndpoints: TressiRequestConfig[];
  globalHeaders?: Record<string, string>;
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
      monitoringWindowSeconds: number;
    }
  >;
  monitoringWindowSeconds: number;
};

/**
 * Interfaces for worker-related components
 */

export interface ISSEClientManager {
  addClient(controller: ReadableStreamDefaultController): void;
  broadcast(data: unknown): void;
  getClientCount(): number;
  removeClient(controller: ReadableStreamDefaultController): void;
}

export type { IGlobalServerEvents, IRunnerEvents };
export { EndpointState, WorkerState };

export interface IStatsCounterManager {
  getAllEndpointCounters(): EndpointCounters[];
  getEndpointCounters(index: number): EndpointCounters;
  getEndpointsCount(): number;
  recordBytesReceived(endpointIndex: number, bytes: number): void;
  recordBytesSent(endpointIndex: number, bytes: number): void;
  recordRequest(endpointIndex: number, success: boolean): void;
  recordStatusCode(endpointIndex: number, statusCode: number): void;
}

export interface IEndpointStateManager {
  getEndpointState?(index: number): number;
  getRunningEndpointsCount(): number;
  getTotalEndpoints(): number;
  isEndpointRunning(index: number): boolean;
  setEndpointState?(index: number, state: number): void;
  stopEndpoint(index: number): void;
}

export interface IHdrHistogramManager {
  getAllEndpointHistograms(): LatencyHistogram[];
  recordLatency(endpointIndex: number, latency: number): void;
}

export interface IWorkerStateManager {
  getWorkerState(workerId: number): WorkerState;
  setWorkerState(workerId: number, state: WorkerState): void;
  waitForState(workerId: number, state: WorkerState, timeoutMs: number): boolean;
}

export interface IEarlyExitCoordinator {
  startMonitoring(): void;
  stopMonitoring(): void;
}

export interface IMetricsAggregator {
  cleanupResponseSamples(runId: string): void;
  getCollectedResponseSamples(runId: string): Map<string, ResponseSample[]>;
  getResults(workersCount: number, endpoints: string[]): TestSummary;
  recordResponseSample(
    runId: string,
    url: string,
    statusCode: number,
    headers: Record<string, string>,
    body: string,
  ): void;
  startPolling(intervalMs?: number): void;
  stopPolling(): void;
}

export type AggregatedWorkerData = {
  totalSuccess: number;
  totalFailure: number;
  totalRequests: number;
  totalBytesSent: number;
  totalBytesReceived: number;
  endpointHistograms: Record<string, LatencyHistogram[]>;
  endpointStatusCounts: Record<string, Record<number, number>>;
  currentEndpointCounts: Record<string, { success: number; failure: number }>;
};

export const EMPTY_HISTOGRAM: LatencyHistogram = {
  buckets: [],
  max: 0,
  mean: 0,
  min: 0,
  percentiles: {},
  stdDev: 0,
  totalCount: 0,
};

export type GlobalLatencyStats = {
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
};

export type EndpointLatencyStats = GlobalLatencyStats & {
  totalCount: number;
};

export type ResponseSample = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};
