import { randomUUID } from 'crypto';
import os from 'os';
import { Worker } from 'worker_threads';

import { TressiConfig, TressiRequestConfig } from '../common/config/types';
import type { AggregatedMetrics } from '../common/metrics';
import type { ResponseSamples, TestSummary } from '../reporting/types';
import { FileUtils } from '../utils/file-utils';
import { EarlyExitCoordinator } from './early-exit-coordinator';
import { MetricsAggregator } from './metrics-aggregator';
import { EndpointStateManager } from './shared-memory/endpoint-state-manager';
import { HdrHistogramManager } from './shared-memory/hdr-histogram-manager';
import { SharedMemoryFactory } from './shared-memory/shared-memory-factory';
import { StatsCounterManager } from './shared-memory/stats-counter-manager';
import { WorkerStateManager } from './shared-memory/worker-state-manager';
import { WorkerState } from './types';

/**
 * WorkerPoolManager - Core orchestration component for managing worker threads in Tressi load testing.
 *
 * This class coordinates the entire worker pool lifecycle, including:
 * - Worker thread creation and lifecycle management
 * - Endpoint distribution across workers using round-robin algorithm
 * - Shared memory architecture integration for inter-thread communication
 * - Metrics aggregation coordination
 * - Early exit condition monitoring
 * - Graceful shutdown handling
 *
 * @example
 * ```typescript
 * const manager = new WorkerPoolManager(config, maxWorkers);
 * await manager.start();
 * const results = manager.getAggregatedResults();
 * await manager.stop();
 * ```
 *
 * @remarks
 * The manager uses SharedArrayBuffer for zero-copy communication between the main thread
 * and worker threads, enabling efficient metrics collection and state synchronization.
 * Each worker is assigned a subset of endpoints using round-robin distribution.
 */
export class WorkerPoolManager {
  private _workers: Worker[] = [];
  private _metricsAggregator: MetricsAggregator;
  private _earlyExitCoordinator: EarlyExitCoordinator;
  private _maxWorkers: number;
  private _workerStateManager: WorkerStateManager;
  private _endpointStateManager: EndpointStateManager;
  private _endpoints: TressiRequestConfig[];
  private _workerAssignments: TressiRequestConfig[][] = [];
  private _hdrHistogramManagers: HdrHistogramManager[] = [];
  private _statsCounterManagers: StatsCounterManager[] = [];
  private readonly _runId = `ephemeral-${randomUUID()}`;
  constructor(private _config: TressiConfig) {
    const cpuCount = os.cpus().length;
    const requestedThreads = _config.options.threads ?? cpuCount;
    const maxWorkers =
      requestedThreads > cpuCount ? cpuCount : requestedThreads;

    this._maxWorkers = maxWorkers;
    this._endpoints = _config.requests;

    // Create managers using new SharedMemoryFactory
    const managers = SharedMemoryFactory.createManagers(
      this._maxWorkers,
      this._endpoints,
      {
        ringBufferSize: 100,
        bodySampleBufferSize: 1000,
      },
    );

    this._workerStateManager = managers.workerState;
    this._endpointStateManager = managers.endpointState;
    this._hdrHistogramManagers = managers.hdrHistogram;
    this._statsCounterManagers = managers.statsCounter;

    // Build endpoint method map from config
    const endpointMethodMap: Record<string, string> = {};
    for (const request of _config.requests) {
      endpointMethodMap[request.url] = request.method;
    }

    // Create new metrics aggregator with new managers and method map
    this._metricsAggregator = new MetricsAggregator(
      this._hdrHistogramManagers,
      this._statsCounterManagers,
      endpointMethodMap,
      this._runId,
    );

    // Set the config for metrics aggregation
    this._metricsAggregator.setConfig(_config);

    this._earlyExitCoordinator = new EarlyExitCoordinator(
      _config,
      this._statsCounterManagers,
      this._endpointStateManager,
    );
  }

  async start(): Promise<void> {
    // Distribute endpoints to workers
    this._workerAssignments = this._distributeEndpoints();
    const actualWorkers = this._workerAssignments.length;

    // Initialize worker states
    for (let i = 0; i < actualWorkers; i++) {
      this._workerStateManager.setWorkerState(i, WorkerState.INITIALIZING);
    }

    const workerPath = FileUtils.getWorkerThreadPath();

    for (let i = 0; i < actualWorkers; i++) {
      const assignedEndpoints = this._workerAssignments[i];
      const endpointOffset = this._getEndpointOffset(i);

      const worker = new Worker(workerPath, {
        workerData: {
          workerId: i,
          assignedEndpoints,
          endpointOffset,
          statsBuffer: this._statsCounterManagers[i].getSharedBuffer(),
          histogramBuffer: this._hdrHistogramManagers[i].getSharedBuffer(),
          workerStateBuffer: this._workerStateManager.getSharedBuffer(),
          endpointStateBuffer: this._endpointStateManager.getSharedBuffer(),
          memoryLimit: this._config.options.workerMemoryLimit,
          totalWorkers: actualWorkers,
          durationSec: this._config.options.durationSec || 10,
          rampUpDurationSec: this._config.options.rampUpDurationSec || 0,
        },
        resourceLimits: {
          maxOldGenerationSizeMb: this._config.options.workerMemoryLimit,
        },
      });

      this._setupWorkerErrorHandling(worker, i);
      this._workers.push(worker);

      // Set worker to ready state
      this._workerStateManager.setWorkerState(i, WorkerState.READY);
    }

    // Start early exit monitoring
    this._earlyExitCoordinator.startMonitoring();

    // Set endpoints and start metrics aggregation polling
    const endpoints = this._config.requests.map((req) => req.url);
    this._metricsAggregator.setEndpoints(endpoints);
    this._metricsAggregator.startPolling();

    // Wait for all workers to be ready
    await this._waitForWorkersReady();
  }

  /**
   * Sets up error and exit event handlers for a worker thread.
   *
   * @param worker - The worker thread instance
   * @param workerId - The unique identifier for this worker
   *
   * @remarks
   * Handles both error events (thrown exceptions) and exit events (normal/abnormal termination).
   * Updates worker state in shared memory to reflect error conditions.
   */
  private _setupWorkerErrorHandling(worker: Worker, workerId: number): void {
    worker.on('error', (error) => {
      process.stderr.write(`Worker ${workerId} error: ${error.message}\n`);
      this._workerStateManager.setWorkerState(workerId, WorkerState.ERROR);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        process.stderr.write(`Worker ${workerId} exited with code ${code}\n`);
        this._workerStateManager.setWorkerState(workerId, WorkerState.ERROR);
      } else {
        this._workerStateManager.setWorkerState(workerId, WorkerState.FINISHED);
      }
    });

    // Listen for body sample messages from worker
    worker.on('message', (message: unknown) => {
      if (
        message &&
        typeof message === 'object' &&
        'type' in message &&
        message.type === 'bodySample' &&
        'statusCode' in message &&
        'body' in message &&
        'url' in message
      ) {
        this._metricsAggregator.recordResponseSample(
          this._runId,
          message.url as string,
          message.statusCode as number,
          (message as { headers?: Record<string, string> }).headers || {},
          message.body as string,
        );
      }
    });
  }

  /**
   * Distributes endpoints across workers using round-robin algorithm.
   *
   * @returns Array of endpoint arrays, where each inner array contains endpoints assigned to a specific worker
   *
   * @remarks
   * Uses simple modulo operation to ensure even distribution. If there are more endpoints than workers,
   * some workers will handle multiple endpoints. If there are more workers than endpoints, some workers
   * will be idle (though this is prevented by the constructor logic).
   *
   * @example
   * ```typescript
   * // With 3 endpoints and 2 workers:
   * // Worker 0 gets endpoints [0, 2]
   * // Worker 1 gets endpoint [1]
   * ```
   */
  private _distributeEndpoints(): TressiRequestConfig[][] {
    const endpoints = this._config.requests;
    const workers = Math.min(this._maxWorkers, endpoints.length);
    const distribution: TressiRequestConfig[][] = Array.from(
      { length: workers },
      () => [],
    );

    endpoints.forEach((endpoint, index) => {
      const workerIndex = index % workers;
      distribution[workerIndex].push(endpoint);
    });

    return distribution;
  }

  /**
   * Calculates the global endpoint offset for a given worker.
   *
   * @param workerId - The worker identifier
   * @returns The starting global endpoint index for this worker
   *
   * @remarks
   * This offset is used to convert between local endpoint indices (0..n-1 within a worker)
   * and global endpoint indices (0..total_endpoints-1 across all workers).
   * Essential for shared memory coordination where endpoints are stored in global arrays.
   */
  private _getEndpointOffset(workerId: number): number {
    let offset = 0;
    for (let i = 0; i < workerId; i++) {
      offset += this._workerAssignments[i].length;
    }
    return offset;
  }

  /**
   * Waits for all workers to reach the RUNNING state.
   *
   * @returns Promise that resolves when all workers are ready or timeout occurs
   *
   * @remarks
   * Uses shared memory to poll worker states with a 5-second timeout per worker.
   * If a worker fails to become ready within the timeout, a warning is logged but execution continues.
   * This prevents the entire test from failing due to a single slow worker.
   */
  private async _waitForWorkersReady(): Promise<void> {
    const actualWorkers = this._workers.length;

    for (let i = 0; i < actualWorkers; i++) {
      const ready = this._workerStateManager.waitForState(
        i,
        WorkerState.RUNNING,
        5000,
      );

      if (!ready) {
        process.stderr.write(
          `Warning: Worker ${i} failed to reach ready state\n`,
        );
      }
    }
  }

  /**
   * Retrieves aggregated metrics from all workers and endpoints.
   *
   * @returns Complete aggregated metrics including global and per-endpoint statistics
   *
   * @remarks
   * This is the primary method for accessing test results after completion.
   * It combines histogram data, counters, and network metrics from all workers
   * into a single comprehensive metrics object.
   */
  getAggregatedResults(): AggregatedMetrics {
    const endpoints = this._config.requests.map((req) => req.url);
    return this._metricsAggregator.getResults(this._workers.length, endpoints);
  }

  /**
   * Get body samples collected during the test
   * @returns Record of endpoint URL to body samples
   */
  getResponseSamples(): ResponseSamples {
    const responseSamplesMap =
      this._metricsAggregator.getCollectedResponseSamples(this._runId);

    const result: ResponseSamples = {};
    responseSamplesMap.forEach((samples, url) => {
      result[url] = samples;
    });

    return result;
  }

  /**
   * Clean up body samples for this run
   */
  cleanupResponseSamples(): void {
    this._metricsAggregator.cleanupResponseSamples(this._runId);
  }

  /**
   * Set the testId for server mode persistence
   * @param testId The test ID from database
   */
  setTestId(testId: string): void {
    this._metricsAggregator.setTestId(testId);
  }

  /**
   * Set the start time for metrics aggregation
   * @param startTime Unix timestamp in milliseconds
   */
  public setStartTime(startTime: number): void {
    this._metricsAggregator.setStartTime(startTime);
  }

  /**
   * Get test summary for final report generation
   * @returns TestSummary object
   */
  public getTestSummary(): TestSummary {
    const endpoints = this._config.requests.map((req) => req.url);
    return this._metricsAggregator.getTestSummary(
      this._workers.length,
      endpoints,
    );
  }

  /**
   * Waits for test completion by monitoring worker states and endpoint status.
   *
   * @returns Promise that resolves when test is complete
   *
   * @remarks
   * Monitors multiple completion conditions:
   * - All endpoints stopped (early exit triggered)
   * - All workers finished or in error state
   * - Maximum duration timeout reached
   *
   * Uses a polling approach with 100ms intervals for responsive completion detection.
   */
  async waitForWorkersComplete(): Promise<void> {
    const maxDurationMs =
      (this._config.options.durationSec || 10) * 1000 + 5000;
    const startTime = Date.now();
    const actualWorkers = this._workers.length;

    while (true) {
      // Check if all endpoints are stopped
      const allEndpointsStopped =
        this._endpointStateManager.getRunningEndpointsCount() === 0;
      if (allEndpointsStopped) {
        process.stdout.write('All endpoints stopped - terminating test\n');
        break;
      }

      // Check if all workers are complete
      const allComplete = Array.from({ length: actualWorkers }, (_, i) => {
        const state = this._workerStateManager.getWorkerState(i);
        return state === WorkerState.FINISHED || state === WorkerState.ERROR;
      }).every(Boolean);

      if (allComplete) break;

      if (Date.now() - startTime > maxDurationMs) {
        process.stderr.write('Warning: Worker completion timeout reached\n');
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  /**
   * Initiates graceful shutdown of the worker pool.
   *
   * @returns Promise that resolves when all workers are terminated
   *
   * @remarks
   * Performs coordinated shutdown:
   * 1. Stops early exit monitoring
   * 2. Stops metrics aggregation polling
   * 3. Sets all workers to TERMINATED state
   * 4. Waits for workers to exit gracefully
   * 5. Forcefully terminates any remaining workers
   *
   * Designed to be called after test completion or on user interrupt.
   */
  async stop(): Promise<void> {
    this._earlyExitCoordinator.stopMonitoring();
    this._metricsAggregator.stopPolling();

    const actualWorkers = this._workers.length;
    for (let i = 0; i < actualWorkers; i++) {
      this._workerStateManager.setWorkerState(i, WorkerState.TERMINATED);
    }

    await this._waitForWorkersExit();

    for (const worker of this._workers) {
      if (worker.threadId) {
        try {
          await worker.terminate();
        } catch {
          // Ignore termination errors
        }
      }
    }
  }

  /**
   * Waits for all workers to reach TERMINATED or FINISHED state.
   *
   * @returns Promise that resolves when all workers have exited
   *
   * @remarks
   * Used during shutdown to ensure clean worker termination.
   * Polls worker states with 100ms intervals until all workers report completion.
   */
  private async _waitForWorkersExit(): Promise<void> {
    const actualWorkers = this._workers.length;

    while (true) {
      const allExited = Array.from({ length: actualWorkers }, (_, i) => {
        const state = this._workerStateManager.getWorkerState(i);
        return (
          state === WorkerState.TERMINATED || state === WorkerState.FINISHED
        );
      }).every(Boolean);

      if (allExited) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
