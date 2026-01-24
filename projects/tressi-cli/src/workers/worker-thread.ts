import { parentPort, workerData } from 'worker_threads';

import { TressiRequestConfig } from '../common/config/types';
import { RequestExecutor } from '../http/request-executor';
import { ResponseSampler } from '../http/response-sampler';
import { terminal } from '../tui/terminal';
import { EndpointStateManager } from './shared-memory/endpoint-state-manager';
import { HdrHistogramManager } from './shared-memory/hdr-histogram-manager';
import { StatsCounterManager } from './shared-memory/stats-counter-manager';
import { WorkerStateManager } from './shared-memory/worker-state-manager';
import { WorkerData, WorkerState } from './types';
import { WorkerRateLimiter } from './worker-rate-limiter';

/**
 * WorkerThread - Individual worker thread implementation for Tressi load testing.
 *
 * This class represents a single worker thread that executes HTTP requests for a subset
 * of endpoints. It implements a pipeline architecture for high-throughput request execution
 * with integrated rate limiting and shared memory coordination.
 *
 * @example
 * ```typescript
 * // Worker entry point (automatically executed in worker thread)
 * const worker = new WorkerThread();
 * await worker.start();
 * ```
 *
 * @remarks
 * The worker uses a pipeline approach with configurable depth to maintain high concurrency
 * without blocking. It coordinates with the main thread through SharedArrayBuffer for
 * metrics collection and state synchronization. Rate limiting is implemented using a
 * token bucket algorithm that allows burst traffic while maintaining target RPS.
 */
export class WorkerThread {
  private rateLimiter: WorkerRateLimiter;
  private statsCounterManager: StatsCounterManager;
  private hdrHistogramManager: HdrHistogramManager;
  private workerStateManager: WorkerStateManager;
  private endpointStateManager: EndpointStateManager;
  private requestExecutor: RequestExecutor;
  private isRunning = false;
  private workerId: number;
  private assignedEndpoints: TressiRequestConfig[];
  private endpointOffset: number;
  private startTime: number;
  private durationMs: number;
  private totalWorkers: number;

  constructor() {
    const data = workerData as WorkerData;
    this.workerId = data.workerId;
    this.assignedEndpoints = data.assignedEndpoints;
    this.endpointOffset = data.endpointOffset;
    this.totalWorkers = data.totalWorkers;

    // Create managers with provided buffers
    this.statsCounterManager = new StatsCounterManager(
      this.assignedEndpoints.length,
      100,
      data.statsBuffer,
    );

    this.hdrHistogramManager = new HdrHistogramManager(
      this.assignedEndpoints.length,
      3,
      1,
      120_000_000,
      data.histogramBuffer,
    );

    this.workerStateManager = new WorkerStateManager(
      this.totalWorkers,
      data.workerStateBuffer,
    );

    const totalEndpoints = data.endpointStateBuffer.byteLength / 4; // 4 bytes per Int32
    this.endpointStateManager = new EndpointStateManager(
      totalEndpoints,
      data.endpointStateBuffer,
    );

    this.rateLimiter = new WorkerRateLimiter(
      this.assignedEndpoints,
      data.rampUpDurationSec,
    );
    this.requestExecutor = new RequestExecutor(new ResponseSampler(), 1000);
    this.startTime = Date.now();
    this.durationMs = data.durationSec * 1000;
  }

  /**
   * Starts the worker thread's main execution loop.
   *
   * @returns Promise that resolves when the worker finishes execution
   *
   * @remarks
   * Implements a pipeline architecture with the following key features:
   * - Configurable pipeline depth (default: 15 concurrent requests)
   * - Non-blocking request execution using Promise sets
   * - Rate-limited request batching
   * - Early exit condition checking
   * - Graceful shutdown on duration completion
   *
   * The pipeline maintains a set of in-flight requests and continuously
   * adds new requests as others complete, ensuring maximum throughput.
   */
  async start(): Promise<void> {
    this.isRunning = true;
    this.workerStateManager.setWorkerState(this.workerId, WorkerState.RUNNING);

    // Pipeline configuration
    const PIPELINE_DEPTH = 15; // Number of concurrent requests
    const inFlightRequests = new Set<Promise<void>>();

    while (this.isRunning) {
      const elapsed = Date.now() - this.startTime;
      if (elapsed >= this.durationMs) break;
      if (this.allEndpointsStopped()) break;

      // Get batch of available requests (NON-BLOCKING)
      const requests = this.rateLimiter.getAvailableRequests(
        PIPELINE_DEPTH,
        elapsed,
      );

      if (requests.length > 0) {
        // CRITICAL: Fire requests WITHOUT waiting - TRUE PIPELINING
        requests.forEach((request, index) => {
          const localEndpointIndex = this.getLocalEndpointIndex(request);
          const globalEndpointIndex = this.endpointOffset + localEndpointIndex;

          if (
            this.endpointStateManager.isEndpointRunning(globalEndpointIndex)
          ) {
            // Add small stagger to smooth out traffic (2ms between requests)
            const pipelineDelay = index * 2;

            const requestPromise = this.delayedExecute(
              request,
              localEndpointIndex,
              globalEndpointIndex,
              pipelineDelay,
            );

            inFlightRequests.add(requestPromise);
            requestPromise.finally(() =>
              inFlightRequests.delete(requestPromise),
            );
          }
        });

        // Don't wait for completion - keep pipeline full
        // Yield to prevent event loop starvation
        await new Promise((resolve) => setImmediate(resolve));
      } else {
        // No tokens available, minimal wait
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    // Wait for all in-flight requests to complete
    await Promise.allSettled(inFlightRequests);
    this.workerStateManager.setWorkerState(this.workerId, WorkerState.FINISHED);
  }

  /**
   * Executes a request with an optional delay for pipeline staggering.
   *
   * @param request - The endpoint configuration to execute
   * @param localEndpointIndex - Local index within this worker (0..n-1)
   * @param globalEndpointIndex - Global index across all workers
   * @param delayMs - Milliseconds to delay before execution
   *
   * @remarks
   * Used to stagger requests within a pipeline batch, creating smoother traffic patterns.
   * The 2ms default stagger between requests helps prevent thundering herd effects.
   */
  private async delayedExecute(
    request: TressiRequestConfig,
    localEndpointIndex: number,
    globalEndpointIndex: number,
    delayMs: number,
  ): Promise<void> {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    await this.executeRequest(request, localEndpointIndex, globalEndpointIndex);
  }

  /**
   * Executes a single HTTP request and records metrics.
   *
   * @param request - The endpoint configuration to execute
   * @param localEndpointIndex - Local index within this worker
   * @param globalEndpointIndex - Global index across all workers
   *
   * @remarks
   * This is the core request execution method that:
   * - Executes the HTTP request using RequestExecutor
   * - Records latency using high-resolution performance timing
   * - Updates success/failure counters in shared memory
   * - Records network metrics (bytes sent/received)
   * - Samples response bodies for debugging
   * - Updates HDR histogram for latency distribution analysis
   *
   * All metrics are written to shared memory for aggregation by the main thread.
   */
  private async executeRequest(
    request: TressiRequestConfig,
    localEndpointIndex: number,
    globalEndpointIndex: number,
  ): Promise<void> {
    try {
      const startTime = performance.now();
      const result = await this.requestExecutor.executeRequest(request);
      const latency = performance.now() - startTime;

      // Record success/failure
      this.statsCounterManager.recordRequest(
        localEndpointIndex,
        result.success,
      );

      // Record status code
      if (result.status) {
        this.statsCounterManager.recordStatusCode(
          localEndpointIndex,
          result.status,
        );
      }

      // Record network metrics
      if (result.bytesSent !== undefined) {
        this.statsCounterManager.recordBytesSent(
          localEndpointIndex,
          result.bytesSent,
        );
      }
      if (result.bytesReceived !== undefined) {
        this.statsCounterManager.recordBytesReceived(
          localEndpointIndex,
          result.bytesReceived,
        );
      }

      // Record latency
      this.hdrHistogramManager.recordLatency(localEndpointIndex, latency);

      // Send body sample to main thread if response body exists
      if (result.body && result.status && parentPort) {
        parentPort.postMessage({
          type: 'bodySample',
          endpointIndex: globalEndpointIndex,
          statusCode: result.status,
          body: result.body,
          headers: result.headers,
          url: request.url,
          method: request.method || 'GET',
        });
      }

      // Release result object back to pool
      this.requestExecutor.releaseResultObject(result);
    } catch {
      // Record failure
      this.statsCounterManager.recordRequest(localEndpointIndex, false);
      // Record 0 bytes received for failed requests
      this.statsCounterManager.recordBytesReceived(localEndpointIndex, 0);
      terminal.print('request failure');
    }
  }
  /**
   * Check if all endpoints assigned to this worker are stopped
   */
  private allEndpointsStopped(): boolean {
    for (let i = 0; i < this.assignedEndpoints.length; i++) {
      const globalEndpointIndex = this.endpointOffset + i;
      if (this.endpointStateManager.isEndpointRunning(globalEndpointIndex)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Converts a request configuration to a local endpoint index.
   *
   * @param request - The endpoint configuration to lookup
   * @returns Local index (0..n-1) within this worker's assigned endpoints
   *
   * @remarks
   * Essential for mapping requests to their corresponding shared memory indices.
   * Uses URL matching to find the correct local index for metrics recording.
   * Returns 0 as fallback for safety (though this should not occur in normal operation).
   */
  private getLocalEndpointIndex(request: TressiRequestConfig): number {
    const index = this.assignedEndpoints.findIndex(
      (ep) => ep.url === request.url,
    );
    if (index === -1) {
      return 0;
    }
    return index;
  }
}

// Worker entry point
if (parentPort) {
  const worker = new WorkerThread();

  worker.start().catch((error: Error) => {
    process.stderr.write(
      `Worker ${workerData.workerId} error: ${error.message}\n`,
    );
    process.stderr.write(
      `Worker ${workerData.workerId} stack: ${error.stack}\n`,
    );
    process.exit(1);
  });

  // Add global error handler
  process.on('uncaughtException', (error) => {
    process.stderr.write(
      `Worker ${workerData.workerId} uncaught: ${error.message}\n`,
    );
    process.exit(1);
  });
}
