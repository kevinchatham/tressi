import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

import { RequestExecutor } from '../request/request-executor';
import type {
  RequestResult,
  TressiConfig,
  TressiRequestConfig,
} from '../types';
import { AdaptiveConcurrencyManager } from './adaptive-concurrency-manager';
import { CentralizedRateLimiter } from './rate-limiter';
import { TimingCoordinator } from './timing-coordinator';

/**
 * Async request executor that replaces worker loops with centralized rate limiting
 * and adaptive concurrency management
 */
export class AsyncRequestExecutor extends EventEmitter {
  private isRunning = false;
  private startTime = 0;
  private endTime = 0;
  private activeRequests: Array<Promise<void>> = [];
  private completedRequests = 0;
  private failedRequests = 0;
  private rateLimiter: CentralizedRateLimiter;
  private concurrencyManager: AdaptiveConcurrencyManager;
  private requestExecutor: RequestExecutor;
  private timingCoordinator: TimingCoordinator;

  constructor(
    private config: TressiConfig,
    requestExecutor: RequestExecutor,
  ) {
    super();

    this.requestExecutor = requestExecutor;
    this.rateLimiter = new CentralizedRateLimiter(config.requests || []);
    this.concurrencyManager = new AdaptiveConcurrencyManager({
      maxConcurrency: config.options.adaptiveConcurrency?.maxConcurrency ?? 10,
      targetLatency: config.options.adaptiveConcurrency?.targetLatency ?? 100,
      memoryThreshold:
        config.options.adaptiveConcurrency?.memoryThreshold ?? 0.8,
      enableAdaptiveConcurrency:
        config.options.adaptiveConcurrency?.enabled ?? true,
      minConcurrency: config.options.adaptiveConcurrency?.minConcurrency ?? 1,
    });

    this.timingCoordinator = new TimingCoordinator({
      precisionMs: 1,
      driftCorrection: true,
    });
  }

  /**
   * Starts the async request execution
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.startTime = performance.now();
    this.isRunning = true;
    this.completedRequests = 0;
    this.failedRequests = 0;

    const { durationSec = 10 } = this.config.options;
    this.endTime = this.startTime + durationSec * 1000;

    await this.timingCoordinator.initialize();

    this.emit('executionStarted', {
      startTime: this.startTime,
      durationSec,
      totalEndpoints: this.config.requests?.length || 0,
      totalRPS:
        this.config.requests?.reduce((sum, req) => sum + (req.rps || 1), 0) ||
        0,
    });

    // Start the main execution loop
    await this.runExecutionLoop();

    this.emit('executionStopped', {
      duration: performance.now() - this.startTime,
      completedRequests: this.completedRequests,
      failedRequests: this.failedRequests,
    });
  }

  /**
   * Main execution loop that coordinates all requests
   */
  private async runExecutionLoop(): Promise<void> {
    while (this.isRunning && performance.now() < this.endTime) {
      const optimalConcurrency =
        await this.concurrencyManager.calculateOptimalConcurrency();
      const nextEndpoint = this.rateLimiter.getNextReadyEndpoint();

      // Check if we can start a new request
      if (nextEndpoint && this.activeRequests.length < optimalConcurrency) {
        const requestPromise = this.executeRequest(
          nextEndpoint.endpointKey,
          nextEndpoint.config,
        );
        this.activeRequests.push(requestPromise);

        // Clean up completed requests
        requestPromise.finally(() => {
          const index = this.activeRequests.indexOf(requestPromise);
          if (index > -1) {
            this.activeRequests.splice(index, 1);
          }
        });
      } else if (this.activeRequests.length > 0) {
        // Wait for any active request to complete
        await Promise.race(this.activeRequests);
      } else {
        // No active requests, wait for next endpoint
        const waitTime = this.rateLimiter.getMinWaitTime();
        if (waitTime > 0) {
          await this.timingCoordinator.waitUntil(performance.now() + waitTime);
        }
      }

      // Check for early exit conditions
      if (this.shouldEarlyExit()) {
        break;
      }
    }

    // Wait for all active requests to complete
    await Promise.allSettled(this.activeRequests);
  }

  /**
   * Executes a single request
   */
  private async executeRequest(
    endpointKey: string,
    config: TressiRequestConfig,
  ): Promise<void> {
    const startTime = performance.now();

    try {
      const result = await this.requestExecutor.executeRequest(
        config,
        this.config.options.headers,
      );

      const latency = performance.now() - startTime;
      this.concurrencyManager.recordLatency(latency);

      this.emit('requestCompleted', result);
      this.completedRequests++;
    } catch (error) {
      const latency = performance.now() - startTime;
      this.concurrencyManager.recordLatency(latency);

      const errorResult: RequestResult = {
        method: config.method,
        url: config.url,
        status: 0,
        latencyMs: latency,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: startTime,
      };

      this.emit('requestFailed', errorResult);
      this.failedRequests++;
    } finally {
      // Always record the request in the rate limiter
      this.rateLimiter.recordRequest(endpointKey);
    }
  }

  /**
   * Checks if early exit conditions are met
   */
  private shouldEarlyExit(): boolean {
    // This would be connected to result aggregator for early exit logic
    return false;
  }

  /**
   * Stops the execution
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    await this.timingCoordinator.shutdown();
  }

  /**
   * Gets current execution statistics
   */
  getStats(): {
    isRunning: boolean;
    startTime: number;
    duration: number;
    completedRequests: number;
    failedRequests: number;
    activeRequests: number;
    currentConcurrency: number;
    rateLimiterStats: Record<
      string,
      { targetRPS: number; requestCount: number; lastRequestTime: number }
    >;
  } {
    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      duration: this.isRunning ? performance.now() - this.startTime : 0,
      completedRequests: this.completedRequests,
      failedRequests: this.failedRequests,
      activeRequests: this.activeRequests.length,
      currentConcurrency: this.concurrencyManager.getCurrentConcurrency(),
      rateLimiterStats: this.rateLimiter.getStats(),
    };
  }

  /**
   * Updates configuration
   */
  updateConfig(config: TressiConfig): void {
    this.config = config;
    this.rateLimiter.updateEndpoints(config.requests || []);
  }
}
