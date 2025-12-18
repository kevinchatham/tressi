import { cpus } from 'os';
import { TressiConfig, TressiRequestConfig } from 'tressi-common/config';
import type { AggregatedMetric } from 'tressi-common/metrics';
import { Worker } from 'worker_threads';

import { FileUtils } from '../utils/file-utils';
import { EarlyExitCoordinator } from './early-exit-coordinator';
import { MetricsAggregator } from './metrics-aggregator';
import { BodySampleManager } from './shared-memory/body-sample-manager';
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
  private workers: Worker[] = [];
  private metricsAggregator: MetricsAggregator;
  private earlyExitCoordinator: EarlyExitCoordinator;
  private maxWorkers: number;
  private workerStateManager: WorkerStateManager;
  private endpointStateManager: EndpointStateManager;
  private endpoints: TressiRequestConfig[];
  private workerAssignments: TressiRequestConfig[][] = [];
  private hdrHistogramManagers: HdrHistogramManager[] = [];
  private statsCounterManagers: StatsCounterManager[] = [];
  private bodySampleManagers: BodySampleManager[] = [];

  constructor(
    private config: TressiConfig,
    maxWorkers?: number,
  ) {
    this.maxWorkers = maxWorkers || cpus().length;
    this.endpoints = config.requests;

    // Create managers using new SharedMemoryFactory
    const managers = SharedMemoryFactory.createManagers(
      this.maxWorkers,
      this.endpoints,
      {
        ringBufferSize: 100,
        bodySampleBufferSize: 1000,
      },
    );

    this.workerStateManager = managers.workerState;
    this.endpointStateManager = managers.endpointState;
    this.hdrHistogramManagers = managers.hdrHistogram;
    this.statsCounterManagers = managers.statsCounter;
    this.bodySampleManagers = managers.bodySample;

    // Create new metrics aggregator with new managers
    this.metricsAggregator = new MetricsAggregator(
      this.hdrHistogramManagers,
      this.statsCounterManagers,
      this.bodySampleManagers,
    );

    this.earlyExitCoordinator = new EarlyExitCoordinator(
      config,
      this.statsCounterManagers,
      this.endpointStateManager,
    );
  }

  async start(): Promise<void> {
    // Distribute endpoints to workers
    this.workerAssignments = this.distributeEndpoints();
    const actualWorkers = this.workerAssignments.length;

    // Initialize worker states
    for (let i = 0; i < actualWorkers; i++) {
      this.workerStateManager.setWorkerState(i, WorkerState.INITIALIZING);
    }

    const workerPath = FileUtils.getWorkerThreadPath();

    for (let i = 0; i < actualWorkers; i++) {
      const assignedEndpoints = this.workerAssignments[i];
      const endpointOffset = this.getEndpointOffset(i);

      const worker = new Worker(workerPath, {
        workerData: {
          workerId: i,
          assignedEndpoints,
          endpointOffset,
          statsBuffer: this.statsCounterManagers[i].getSharedBuffer(),
          histogramBuffer: this.hdrHistogramManagers[i].getSharedBuffer(),
          bodySampleBuffers: this.getBodySampleBuffersForWorker(i),
          workerStateBuffer: this.workerStateManager.getSharedBuffer(),
          endpointStateBuffer: this.endpointStateManager.getSharedBuffer(),
          memoryLimit: this.config.options.workerMemoryLimit,
          totalWorkers: actualWorkers,
          durationSec: this.config.options.durationSec || 10,
        },
        resourceLimits: {
          maxOldGenerationSizeMb: this.config.options.workerMemoryLimit,
        },
      });

      this.setupWorkerErrorHandling(worker, i);
      this.workers.push(worker);

      // Set worker to ready state
      this.workerStateManager.setWorkerState(i, WorkerState.READY);
    }

    // Start early exit monitoring
    this.earlyExitCoordinator.startMonitoring();

    // Set endpoints and start metrics aggregation polling
    const endpoints = this.config.requests.map((req) => req.url);
    this.metricsAggregator.setEndpoints(endpoints);
    this.metricsAggregator.startPolling();

    // Wait for all workers to be ready
    await this.waitForWorkersReady();
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
  private setupWorkerErrorHandling(worker: Worker, workerId: number): void {
    worker.on('error', (error) => {
      process.stderr.write(`Worker ${workerId} error: ${error.message}\n`);
      this.workerStateManager.setWorkerState(workerId, WorkerState.ERROR);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        process.stderr.write(`Worker ${workerId} exited with code ${code}\n`);
        this.workerStateManager.setWorkerState(workerId, WorkerState.ERROR);
      } else {
        this.workerStateManager.setWorkerState(workerId, WorkerState.FINISHED);
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
  private distributeEndpoints(): TressiRequestConfig[][] {
    const endpoints = this.config.requests;
    const workers = Math.min(this.maxWorkers, endpoints.length);
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
  private getEndpointOffset(workerId: number): number {
    let offset = 0;
    for (let i = 0; i < workerId; i++) {
      offset += this.workerAssignments[i].length;
    }
    return offset;
  }

  /**
   * Retrieves the body sample shared buffers for endpoints assigned to a specific worker.
   *
   * @param workerId - The worker identifier
   * @returns Array of SharedArrayBuffer instances for body sample storage
   *
   * @remarks
   * Each endpoint has its own body sample manager with a shared buffer.
   * This method maps the worker's assigned endpoints to their corresponding body sample buffers.
   */
  private getBodySampleBuffersForWorker(workerId: number): SharedArrayBuffer[] {
    const buffers: SharedArrayBuffer[] = [];
    const startIndex = this.getEndpointOffset(workerId);
    const endIndex = startIndex + this.workerAssignments[workerId].length;

    for (let i = startIndex; i < endIndex; i++) {
      buffers.push(this.bodySampleManagers[i].getSharedBuffer());
    }

    return buffers;
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
  private async waitForWorkersReady(): Promise<void> {
    const actualWorkers = this.workers.length;

    for (let i = 0; i < actualWorkers; i++) {
      const ready = this.workerStateManager.waitForState(
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
  getAggregatedResults(): AggregatedMetric {
    const endpoints = this.config.requests.map((req) => req.url);
    return this.metricsAggregator.getResults(this.workers.length, endpoints);
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
    const maxDurationMs = (this.config.options.durationSec || 10) * 1000 + 5000;
    const startTime = Date.now();
    const actualWorkers = this.workers.length;

    while (true) {
      // Check if all endpoints are stopped
      const allEndpointsStopped =
        this.endpointStateManager.getRunningEndpointsCount() === 0;
      if (allEndpointsStopped) {
        process.stdout.write('All endpoints stopped - terminating test\n');
        break;
      }

      // Check if all workers are complete
      const allComplete = Array.from({ length: actualWorkers }, (_, i) => {
        const state = this.workerStateManager.getWorkerState(i);
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
    this.earlyExitCoordinator.stopMonitoring();
    this.metricsAggregator.stopPolling();

    const actualWorkers = this.workers.length;
    for (let i = 0; i < actualWorkers; i++) {
      this.workerStateManager.setWorkerState(i, WorkerState.TERMINATED);
    }

    await this.waitForWorkersExit();

    for (const worker of this.workers) {
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
  private async waitForWorkersExit(): Promise<void> {
    const actualWorkers = this.workers.length;

    while (true) {
      const allExited = Array.from({ length: actualWorkers }, (_, i) => {
        const state = this.workerStateManager.getWorkerState(i);
        return (
          state === WorkerState.TERMINATED || state === WorkerState.FINISHED
        );
      }).every(Boolean);

      if (allExited) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
