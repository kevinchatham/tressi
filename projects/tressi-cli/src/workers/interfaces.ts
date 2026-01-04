import { TressiConfig } from '../common/config/types';
import { AggregatedMetrics } from '../common/metrics';
import { ServerEvents, TestEventData } from '../events/event-types';
import type { TestSummary } from '../reporting/types';
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
  [ServerEvents.METRICS]: (data: {
    testId?: string;
    testSummary: TestSummary;
  }) => void;
  [ServerEvents.TEST.STARTED]: (data: TestEventData) => void;
  [ServerEvents.TEST.COMPLETED]: (data: TestEventData) => void;
  [ServerEvents.TEST.FAILED]: (data: TestEventData) => void;
}

export interface IRunnerEvents {
  start: (data: { config: TressiConfig; startTime: number }) => void;
  complete: (results: AggregatedMetrics | undefined) => void;
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
  getResults(workersCount: number, endpoints: string[]): AggregatedMetrics;
  recordResponseSample(
    runId: string,
    url: string,
    statusCode: number,
    headers: Record<string, string>,
    body: string,
  ): void;
  getCollectedResponseSamples(
    runId: string,
  ): Map<string, Array<{ statusCode: number; body: string }>>;
  cleanupResponseSamples(runId: string): void;
}
