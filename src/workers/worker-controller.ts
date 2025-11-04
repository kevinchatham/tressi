import { performance } from 'perf_hooks';

import { EndpointRateLimiterManager } from '../core/runner/endpoint-rate-limiter-manager';
import type { RequestExecutor } from '../request/request-executor';
import type { ResultAggregator } from '../stats/aggregators/result-aggregator';
import type {
  RequestResult,
  TressiOptionsConfig,
  TressiRequestConfig,
} from '../types';

/**
 * Controls the execution of individual worker processes.
 * This class manages the worker lifecycle, request execution, and result processing.
 */
export class WorkerController {
  private stopped = false;
  private requestExecutor: RequestExecutor;
  private resultAggregator: ResultAggregator;
  private options: TressiOptionsConfig;
  private requests: TressiRequestConfig[];
  private currentTargetRps: number;
  private rateLimiterManager: EndpointRateLimiterManager;

  constructor(
    requestExecutor: RequestExecutor,
    resultAggregator: ResultAggregator,
    options: TressiOptionsConfig,
    requests: TressiRequestConfig[],
    currentTargetRps: number,
  ) {
    this.requestExecutor = requestExecutor;
    this.resultAggregator = resultAggregator;
    this.options = options;
    this.requests = requests;
    this.currentTargetRps = currentTargetRps;

    // Initialize rate limiter manager with global RPS
    this.rateLimiterManager = new EndpointRateLimiterManager({
      globalRps: currentTargetRps,
    });

    // Initialize rate limiters for all endpoints
    this.rateLimiterManager.initializeForRequests(requests);
  }

  /**
   * The core worker function that runs in a loop, making concurrent requests
   * and respecting the rate limit (RPS) until instructed to stop.
   * @param isStopped A function that returns true if the worker should stop
   * @returns Promise that resolves when the worker stops
   */
  async runWorker(
    isStopped: () => boolean = () => this.stopped,
  ): Promise<void> {
    let lastRequestTime = 0;
    const targetIntervalMs =
      this.currentTargetRps > 0 ? 1000 / this.currentTargetRps : 0;

    while (!isStopped()) {
      // Check for early exit conditions before making requests
      if (this.shouldEarlyExit()) {
        this.stop();
        return;
      }

      // Calculate optimal concurrency for this worker
      const requestsToMake = this.calculateOptimalConcurrency();

      // Select random requests for this batch
      const batchRequests = Array.from(
        { length: requestsToMake },
        () => this.requests[Math.floor(Math.random() * this.requests.length)],
      );

      // Apply per-endpoint rate limiting before executing requests
      const rateLimitedRequests =
        await this.applyPerEndpointRateLimiting(batchRequests);

      if (rateLimitedRequests.length === 0) {
        // All requests were rate limited, yield to prevent busy waiting
        await this.sleep(1);
        continue;
      }

      // Execute all requests concurrently
      const requestPromises = rateLimitedRequests.map((req) =>
        this.requestExecutor.executeRequest(req, this.options.headers),
      );
      const results = await Promise.allSettled(requestPromises);

      // Process all results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          this.resultAggregator.recordResult(result.value);
        } else {
          // Handle rejected promises (shouldn't normally happen with our implementation)
          const errorResult: RequestResult = {
            method: 'GET',
            url: 'unknown',
            status: 0,
            latencyMs: 0,
            success: false,
            error: result.reason?.toString() || 'Unknown error',
            timestamp: performance.now(),
          };
          this.resultAggregator.recordResult(errorResult);
        }
      }

      // Check for early exit conditions after processing all results
      if (this.shouldEarlyExit()) {
        this.stop();
        return;
      }

      // Pace requests to achieve target RPS
      if (this.currentTargetRps > 0) {
        const now = performance.now();
        const nextRequestTime = lastRequestTime + targetIntervalMs;
        const waitTime = Math.max(0, nextRequestTime - now);

        if (waitTime > 0) {
          await this.sleep(waitTime);
        }

        lastRequestTime = performance.now();
      }
    }
  }

  /**
   * Stops the worker.
   */
  stop(): void {
    this.stopped = true;
  }

  /**
   * Checks if early exit conditions are met based on configured thresholds.
   * @returns true if early exit conditions are met, false otherwise
   */
  private shouldEarlyExit(): boolean {
    return this.resultAggregator.shouldEarlyExit({
      earlyExitOnError: this.options.earlyExitOnError,
      errorRateThreshold: this.options.errorRateThreshold,
      errorCountThreshold: this.options.errorCountThreshold,
      errorStatusCodes: this.options.errorStatusCodes,
    });
  }

  /**
   * Calculates the optimal concurrency level for this worker based on target RPS and worker count.
   * @returns The number of concurrent requests this worker should make
   */
  private calculateOptimalConcurrency(): number {
    const workerCount = 1; // This is per worker, so count is 1
    const targetRps = this.currentTargetRps;

    if (targetRps <= 0 || workerCount <= 0) {
      // Default concurrency when no RPS target or no workers
      return 1; // Reduced from 10 to prevent ungoverned requests
    }

    // Calculate optimal concurrency based on target RPS per worker
    const targetRpsPerWorker = targetRps / workerCount;

    // Constrain concurrency to respect rate limiting
    // Allow max 2×RPS for burst, but ensure we don't exceed reasonable limits
    const dynamicConcurrency = Math.min(
      Math.max(1, Math.ceil(targetRpsPerWorker)),
      10, // Reduced max from 50 to prevent overwhelming rate limiting
    );

    return dynamicConcurrency;
  }

  /**
   * Applies per-endpoint rate limiting for the current batch of requests.
   * @param requests Array of requests to apply rate limiting to
   * @returns Array of requests that can be executed immediately
   */
  private async applyPerEndpointRateLimiting(
    requests: TressiRequestConfig[],
  ): Promise<TressiRequestConfig[]> {
    const allowedRequests: TressiRequestConfig[] = [];

    for (const request of requests) {
      const limiter = this.rateLimiterManager.getLimiter(request.url, request);

      // Try to consume a token immediately
      if (limiter.tryConsume(1)) {
        allowedRequests.push(request);
      } else {
        // Wait for token availability
        await limiter.waitForTokens(1);
        allowedRequests.push(request);
      }
    }

    return allowedRequests;
  }

  /**
   * Sleeps for the specified number of milliseconds.
   * @param ms The number of milliseconds to sleep
   * @returns Promise that resolves after the sleep duration
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Updates the current target RPS for this worker.
   * @param targetRps The new target RPS
   */
  updateTargetRps(targetRps: number): void {
    this.currentTargetRps = targetRps;
  }

  /**
   * Gets the current target RPS for this worker.
   * @returns The current target RPS
   */
  getCurrentTargetRps(): number {
    return this.currentTargetRps;
  }

  /**
   * Checks if the worker is currently stopped.
   * @returns true if stopped, false otherwise
   */
  isStopped(): boolean {
    return this.stopped;
  }
}
