import { TressiConfig } from 'tressi-common/config';
import { AggregatedMetric } from 'tressi-common/metrics';

import { EndpointCounters, LatencyHistogram, WorkerState } from './types';

/**
 * SSE client management interface
 */
export interface ISSEClientManager {
  addClient(controller: ReadableStreamDefaultController): void;
  removeClient(controller: ReadableStreamDefaultController): void;
  broadcast(data: unknown): void;
  getClientCount(): number;
}

export interface IGlobalServerEvents {
  metrics: (metrics: AggregatedMetric) => void;
}

export interface IRunnerEvents {
  start: (data: { config: TressiConfig; startTime: number }) => void;
  complete: (results: AggregatedMetric | undefined) => void;
  error: (err: unknown) => void;
}

/**
 * Interface for managing statistics counters across endpoints
 */
export interface IStatsCounterManager {
  getEndpointsCount(): number;
  getEndpointCounters(index: number): EndpointCounters;
  getAllEndpointCounters(): EndpointCounters[];
  recordRequest(endpointIndex: number, success: boolean): void;
  recordStatusCode(endpointIndex: number, statusCode: number): void;
  recordBytesSent(endpointIndex: number, bytes: number): void;
  recordBytesReceived(endpointIndex: number, bytes: number): void;
}

/**
 * Interface for managing endpoint states
 */
export interface IEndpointStateManager {
  isEndpointRunning(index: number): boolean;
  stopEndpoint(index: number): void;
  getRunningEndpointsCount(): number;
  getTotalEndpoints(): number;
  getEndpointState?(index: number): number;
  setEndpointState?(index: number, state: number): void;
}

/**
 * Interface for managing HDR histograms
 */
export interface IHdrHistogramManager {
  getAllEndpointHistograms(): LatencyHistogram[];
  recordLatency(endpointIndex: number, latency: number): void;
}

/**
 * Interface for managing body samples
 */
export interface IBodySampleManager {
  getBodySampleIndices(
    endpointIndex: number,
  ): Array<{ sampleIndex: number; statusCode: number }>;
  recordBodySample(
    endpointIndex: number,
    sampleIndex: number,
    statusCode: number,
  ): void;
  clearBodySamples(endpointIndex: number): void;
  getEndpointsCount(): number;
}

/**
 * Interface for managing worker states
 */
export interface IWorkerStateManager {
  setWorkerState(workerId: number, state: WorkerState): void;
  getWorkerState(workerId: number): WorkerState;
  waitForState(
    workerId: number,
    state: WorkerState,
    timeoutMs: number,
  ): boolean;
}

/**
 * Interface for early exit coordination
 */
export interface IEarlyExitCoordinator {
  startMonitoring(): void;
  stopMonitoring(): void;
}

/**
 * Interface for metrics aggregation
 */
export interface IMetricsAggregator {
  startPolling(intervalMs?: number): void;
  stopPolling(): void;
  getResults(workersCount: number, endpoints: string[]): AggregatedMetric;
  getBodySamplesForEndpoint(
    endpointIndex: number,
  ): Array<{ sampleIndex: number; statusCode: number }>;
  reset(): void;
}
