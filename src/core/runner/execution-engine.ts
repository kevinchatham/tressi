import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

import { RequestExecutor } from '../../request/request-executor';
import { ResultAggregator } from '../../stats/aggregators/result-aggregator';
import type {
  RequestResult,
  SafeTressiConfig,
  TressiRequestConfig,
} from '../../types';
import { globalResourceManager } from '../../utils/resource-manager';
import { ConcurrencyCalculator } from '../../workers/concurrency-calculator';
import { WorkerPool } from '../../workers/worker-pool';
import { CoreRunner } from './core-runner';
import { RateLimiter } from './rate-limiter';

/**
 * Execution engine that manages the test execution loop, ramp-up, rate limiting,
 * and worker lifecycle. This class handles the core execution logic of the load test.
 */
export class ExecutionEngine extends EventEmitter {
  private config: SafeTressiConfig;
  private coreRunner: CoreRunner;
  private rateLimiter: RateLimiter;
  private workerPool: WorkerPool;
  private concurrencyCalculator: ConcurrencyCalculator;
  private requestExecutor: RequestExecutor;
  private resultAggregator: ResultAggregator;

  private testTimeout?: NodeJS.Timeout;
  private rampUpInterval?: NodeJS.Timeout;
  private autoscaleInterval?: NodeJS.Timeout;
  private startTime: number = 0;
  private currentTargetRps: number = 0;
  private stopped = false;

  /**
   * Creates a new ExecutionEngine instance.
   * @param coreRunner The core runner instance
   */
  constructor(coreRunner: CoreRunner) {
    super();

    this.coreRunner = coreRunner;
    this.config = coreRunner.getConfig();

    // Get components from core runner
    this.workerPool = coreRunner.getWorkerPool();
    this.requestExecutor = coreRunner.getRequestExecutor();
    this.resultAggregator = coreRunner.getResultAggregator();

    // Initialize specialized components
    this.rateLimiter = new RateLimiter();
    this.concurrencyCalculator = new ConcurrencyCalculator({
      maxWorkers: this.config.options.workers ?? 10,
      targetRps: this.config.options.rps ?? 0,
      scaleUpThreshold: 0.9,
      scaleDownThreshold: 1.1,
      scaleFactor: 0.25,
    });
  }

  /**
   * Starts the test execution engine.
   * This manages the main execution loop, timers, and worker coordination.
   */
  public async start(): Promise<void> {
    this.startTime = performance.now();
    this.stopped = false;

    const {
      durationSec = 10,
      rampUpTimeSec = 0,
      rps = 0,
    } = this.config.options;

    // Set up test duration timer
    const durationMs = durationSec * 1000;
    this.testTimeout = setTimeout(() => this.stop(), durationMs);

    // Initialize target RPS
    this.currentTargetRps = rampUpTimeSec > 0 ? 0 : rps;

    // Set up ramp-up interval if enabled
    if (rampUpTimeSec > 0) {
      this.setupRampUp(rampUpTimeSec, rps);
    }

    // Set up dynamic worker scaling
    this.setupAutoscaling();

    // Register resources for cleanup
    this.registerResources();

    // Emit start event
    this.emit('executionStarted', {
      startTime: this.startTime,
      durationSec,
      rampUpTimeSec,
      targetRps: rps,
      workerCount: this.workerPool.getWorkerCount(),
    });
  }

  /**
   * Sets up ramp-up logic to gradually increase RPS.
   * @param rampUpTimeSec Ramp-up duration in seconds
   * @param targetRps Target RPS after ramp-up
   */
  private setupRampUp(rampUpTimeSec: number, targetRps: number): void {
    this.rampUpInterval = setInterval(() => {
      if (this.stopped) {
        clearInterval(this.rampUpInterval as NodeJS.Timeout);
        return;
      }

      const elapsedTimeSec = (performance.now() - this.startTime) / 1000;
      const rampUpProgress = Math.min(elapsedTimeSec / rampUpTimeSec, 1);
      this.currentTargetRps = Math.round(targetRps * rampUpProgress);

      this.emit('rampUpProgress', {
        progress: rampUpProgress,
        currentRps: this.currentTargetRps,
        targetRps,
      });
    }, 1000); // Update every second
  }

  /**
   * Sets up dynamic worker scaling to achieve target RPS.
   */
  private setupAutoscaling(): void {
    this.autoscaleInterval = setInterval(() => {
      if (this.stopped) {
        clearInterval(this.autoscaleInterval as NodeJS.Timeout);
        return;
      }

      this.performAutoscaling();
    }, 2000); // Check every 2 seconds
  }

  /**
   * Performs dynamic worker scaling based on current performance.
   */
  private performAutoscaling(): void {
    const currentRps = this.calculateCurrentRps();
    const currentWorkers = this.workerPool.getWorkerCount();
    const targetRps = this.config.options.rps ?? 0;

    if (currentWorkers === 0) {
      this.addWorker();
      return;
    }

    this.concurrencyCalculator.updateMetrics(currentRps, currentWorkers);
    const adjustment = this.concurrencyCalculator.calculateWorkerAdjustment();

    if (adjustment.action === 'SCALE_UP' && adjustment.workersToAdd) {
      for (let i = 0; i < adjustment.workersToAdd; i++) {
        this.addWorker();
      }
    } else if (
      adjustment.action === 'SCALE_DOWN' &&
      adjustment.workersToRemove
    ) {
      for (let i = 0; i < adjustment.workersToRemove; i++) {
        this.removeWorker();
      }
    }

    if (adjustment.action !== 'MAINTAIN') {
      this.emit('autoscaling', {
        action: adjustment.action,
        workersChanged:
          adjustment.workersToAdd || adjustment.workersToRemove || 0,
        currentWorkers: this.workerPool.getWorkerCount(),
        currentRps,
        targetRps,
        reason: adjustment.reason,
      });
    }
  }

  /**
   * Calculates current RPS based on recent request timestamps.
   * @returns Current requests per second
   */
  private calculateCurrentRps(): number {
    // This would typically come from the result aggregator
    // For now, we'll use a placeholder that can be implemented later
    const recentLatencies = this.resultAggregator.getRecentLatencies();
    const timestamps = recentLatencies.map(
      (_, index) => performance.now() - (recentLatencies.length - index) * 10,
    );

    const now = performance.now();
    const oneSecondAgo = now - 1000;

    let count = 0;
    // Iterate backwards since recent timestamps are at the end
    for (let i = timestamps.length - 1; i >= 0; i--) {
      if (timestamps[i] >= oneSecondAgo) {
        count++;
      } else {
        // The timestamps are ordered, so we can stop.
        break;
      }
    }
    return count;
  }

  /**
   * Adds a new worker to the pool.
   */
  private addWorker(): void {
    // This would be implemented by creating a worker factory
    // For now, we'll emit an event that the core runner can handle
    this.emit('addWorkerRequested');
  }

  /**
   * Removes a worker from the pool.
   */
  private removeWorker(): void {
    // This would be implemented by removing a worker
    // For now, we'll emit an event that the core runner can handle
    this.emit('removeWorkerRequested');
  }

  /**
   * Creates a worker function for execution.
   * @param isStopped Function to check if worker should stop
   * @returns Worker execution function
   */
  public createWorkerFunction(isStopped: () => boolean): () => Promise<void> {
    return async () => {
      while (!isStopped() && !this.stopped) {
        await this.executeWorkerIteration();

        // Rate limiting
        if (this.currentTargetRps > 0) {
          await this.rateLimiter.waitForNextRequest(this.currentTargetRps);
        } else {
          // If no RPS target, yield to event loop
          await this.rateLimiter.yield();
        }
      }
    };
  }

  /**
   * Executes a single worker iteration.
   */
  private async executeWorkerIteration(): Promise<void> {
    // Check for early exit conditions before starting
    if (this.shouldEarlyExit()) {
      this.stop();
      return;
    }

    // Calculate optimal concurrency for this worker
    const requestsToMake = this.calculateOptimalConcurrency();

    // Select random requests for this batch
    const batchRequests = Array.from(
      { length: requestsToMake },
      () =>
        this.config.requests[
          Math.floor(Math.random() * this.config.requests.length)
        ],
    );

    // Execute all requests concurrently
    const requestPromises = batchRequests.map((req) =>
      this.executeRequest(req),
    );
    const results = await Promise.allSettled(requestPromises);

    // Process all results and record them
    for (const result of results) {
      if (result.status === 'fulfilled') {
        this.coreRunner.recordResult(result.value);
        // Don't release the result object back to the pool - it will be released by the result aggregator after sampling
      } else {
        // Handle rejected promises
        const errorResult = this.createErrorResult(result.reason);
        this.coreRunner.recordResult(errorResult);
        // Don't release the error result object back to the pool - it will be released by the result aggregator after sampling
      }
    }

    // Check for early exit conditions after processing results
    if (this.shouldEarlyExit()) {
      this.stop();
    }
  }

  /**
   * Executes a single HTTP request.
   * @param req The request configuration
   * @returns Promise<RequestResult> The request result
   */
  private async executeRequest(
    req: TressiRequestConfig,
  ): Promise<RequestResult> {
    return this.requestExecutor.executeRequest(
      req,
      this.config.options.headers,
    );
  }

  /**
   * Creates an error result for failed requests.
   * @param reason The error reason
   * @returns RequestResult with error information
   */
  private createErrorResult(reason: unknown): RequestResult {
    return {
      method: 'GET',
      url: 'unknown',
      status: 0,
      latencyMs: 0,
      success: false,
      error: reason?.toString() || 'Unknown error',
      timestamp: performance.now(),
    };
  }

  /**
   * Calculates optimal concurrency level for a worker.
   * @returns Number of concurrent requests this worker should make
   */
  private calculateOptimalConcurrency(): number {
    const workerCount = this.workerPool.getWorkerCount();
    const targetRps = this.currentTargetRps;

    if (targetRps <= 0 || workerCount <= 0) {
      // Default concurrency when no RPS target or no workers
      return 10;
    }

    // Calculate optimal concurrency based on target RPS per worker
    const targetRpsPerWorker = targetRps / workerCount;

    // Dynamic calculation: ensure we can meet target RPS with reasonable concurrency
    // Allow up to 50 concurrent requests per worker, but at least 1
    const dynamicConcurrency = Math.min(
      50,
      Math.max(1, Math.ceil(targetRpsPerWorker)),
    );

    return dynamicConcurrency;
  }

  /**
   * Checks if early exit conditions are met.
   * @returns true if early exit conditions are met
   */
  private shouldEarlyExit(): boolean {
    return this.resultAggregator.shouldEarlyExit(this.config.options);
  }

  /**
   * Stops the execution engine.
   */
  public stop(): void {
    if (this.stopped) return;

    this.stopped = true;

    // Clear all intervals and timeouts
    if (this.testTimeout) {
      clearTimeout(this.testTimeout);
      this.testTimeout = undefined;
    }

    if (this.rampUpInterval) {
      clearInterval(this.rampUpInterval);
      this.rampUpInterval = undefined;
    }

    if (this.autoscaleInterval) {
      clearInterval(this.autoscaleInterval);
      this.autoscaleInterval = undefined;
    }

    this.emit('executionStopped', {
      duration: performance.now() - this.startTime,
      finalRps: this.currentTargetRps,
    });
  }

  /**
   * Registers resources for automatic cleanup.
   */
  private registerResources(): void {
    // Register timers and intervals
    globalResourceManager.registerResource('execution-engine-timers', {
      cleanup: () => {
        if (this.testTimeout) clearTimeout(this.testTimeout);
        if (this.rampUpInterval) clearInterval(this.rampUpInterval);
        if (this.autoscaleInterval) clearInterval(this.autoscaleInterval);
      },
    });
  }

  /**
   * Gets the current target RPS.
   * @returns Current target requests per second
   */
  public getCurrentTargetRps(): number {
    return this.currentTargetRps;
  }

  /**
   * Gets the rate limiter instance.
   * @returns The rate limiter
   */
  public getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  /**
   * Checks if the execution engine is stopped.
   * @returns true if stopped
   */
  public isStopped(): boolean {
    return this.stopped;
  }
}
