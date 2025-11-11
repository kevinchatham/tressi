import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

import { RequestExecutor } from '../request/request-executor';
import type { RequestResult, TressiConfig } from '../types';
import { globalResourceManager } from '../utils/resource-manager';
import { AsyncRequestExecutor } from './async-request-executor';
import { CoreRunner } from './core-runner';

/**
 * Refactored ExecutionEngine using centralized rate limiting and adaptive concurrency.
 * Eliminates worker-based architecture in favor of direct async execution.
 */
export class ExecutionEngine extends EventEmitter {
  private config: TressiConfig;
  private coreRunner: CoreRunner;
  private requestExecutor: RequestExecutor;
  private asyncExecutor: AsyncRequestExecutor;

  private isRunning = false;
  private startTime = 0;
  private completedRequests = 0;
  private failedRequests = 0;

  /**
   * Creates a new ExecutionEngine instance.
   * @param coreRunner The core runner instance
   */
  constructor(coreRunner: CoreRunner) {
    super();

    this.coreRunner = coreRunner;
    this.config = coreRunner.getConfig();
    this.requestExecutor = coreRunner.getRequestExecutor();
    this.asyncExecutor = new AsyncRequestExecutor(
      this.config,
      this.requestExecutor,
    );

    this.setupEventForwarding();
  }

  /**
   * Starts the test execution engine.
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;

    this.startTime = performance.now();
    this.isRunning = true;
    this.completedRequests = 0;
    this.failedRequests = 0;

    const { durationSec = 10 } = this.config.options;
    // Calculate end time but don't store it as it's not used

    this.registerResources();

    const totalRPS = this.calculateTotalRPS();

    this.emit('executionStarted', {
      startTime: this.startTime,
      durationSec,
      totalEndpoints: this.config.requests?.length || 0,
      totalRPS,
    });

    // Start async execution
    await this.asyncExecutor.start();

    this.emit('executionStopped', {
      duration: performance.now() - this.startTime,
      completedRequests: this.completedRequests,
      failedRequests: this.failedRequests,
      totalRPS,
    });
  }

  /**
   * Calculates total RPS across all endpoints
   */
  private calculateTotalRPS(): number {
    return this.config.requests.reduce((sum, req) => sum + (req.rps || 1), 0);
  }

  /**
   * Sets up event forwarding from async executor
   */
  private setupEventForwarding(): void {
    this.asyncExecutor.on('requestCompleted', (result: RequestResult) => {
      this.coreRunner.recordResult(result);
      this.completedRequests++;
    });

    this.asyncExecutor.on('requestFailed', (result: RequestResult) => {
      this.coreRunner.recordResult(result);
      this.failedRequests++;
    });
  }

  /**
   * Stops the test execution.
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    await this.asyncExecutor.stop();
  }

  /**
   * Registers resources for cleanup
   */
  private registerResources(): void {
    globalResourceManager.registerResource('execution-engine', {
      cleanup: async () => {
        await this.stop();
      },
    });
  }

  /**
   * Gets current execution statistics
   */
  public getStats(): Record<string, unknown> {
    const asyncStats = this.asyncExecutor.getStats();

    return {
      totalRPS: this.calculateTotalRPS(),
      ...asyncStats,
    };
  }
}
