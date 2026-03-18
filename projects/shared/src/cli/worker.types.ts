import { TressiRequestConfig } from '../common/config.types';
import type { IGlobalServerEvents, IRunnerEvents } from '../common/event.types';
import { LatencyHistogram, TestSummary } from '../common/reporting.types';
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

/**
 * Interfaces for worker-related components
 */

export interface ISSEClientManager {
  addClient(controller: ReadableStreamDefaultController): void;
  removeClient(controller: ReadableStreamDefaultController): void;
  broadcast(data: unknown): void;
  getClientCount(): number;
}

export { EndpointState, WorkerState };
export type { IGlobalServerEvents, IRunnerEvents };

export interface IStatsCounterManager {
  getEndpointsCount(): number;
  getEndpointCounters(index: number): EndpointCounters;
  getAllEndpointCounters(): EndpointCounters[];
  recordRequest(endpointIndex: number, success: boolean): void;
  recordStatusCode(endpointIndex: number, statusCode: number): void;
  recordBytesSent(endpointIndex: number, bytes: number): void;
  recordBytesReceived(endpointIndex: number, bytes: number): void;
}

export interface IEndpointStateManager {
  isEndpointRunning(index: number): boolean;
  stopEndpoint(index: number): void;
  getRunningEndpointsCount(): number;
  getTotalEndpoints(): number;
  getEndpointState?(index: number): number;
  setEndpointState?(index: number, state: number): void;
}

export interface IHdrHistogramManager {
  getAllEndpointHistograms(): LatencyHistogram[];
  recordLatency(endpointIndex: number, latency: number): void;
}

export interface IWorkerStateManager {
  setWorkerState(workerId: number, state: WorkerState): void;
  getWorkerState(workerId: number): WorkerState;
  waitForState(
    workerId: number,
    state: WorkerState,
    timeoutMs: number,
  ): boolean;
}

export interface IEarlyExitCoordinator {
  startMonitoring(): void;
  stopMonitoring(): void;
}

export interface IMetricsAggregator {
  startPolling(intervalMs?: number): void;
  stopPolling(): void;
  getResults(workersCount: number, endpoints: string[]): TestSummary;
  recordResponseSample(
    runId: string,
    url: string,
    statusCode: number,
    headers: Record<string, string>,
    body: string,
  ): void;
  getCollectedResponseSamples(runId: string): Map<string, ResponseSample[]>;
  cleanupResponseSamples(runId: string): void;
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
  totalCount: 0,
  min: 0,
  max: 0,
  mean: 0,
  stdDev: 0,
  percentiles: {},
  buckets: [],
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
