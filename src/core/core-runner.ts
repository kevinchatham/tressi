import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

import { RequestExecutor } from '../request/request-executor';
import { ResponseSampler } from '../request/response-sampler';
import { ResultAggregator } from '../stats/aggregators/result-aggregator';
import { RpsCalculator } from '../stats/calculators/rps-calculator';
import type {
  RequestResult,
  TressiConfig,
  TressiOptionsConfig,
} from '../types';
import { globalResourceManager } from '../utils/resource-manager';
import { RateLimitValidator } from '../validation/rate-limit-validator';
import { ExecutionEngine } from './execution-engine';

/**
 * Core orchestration component for the Tressi load testing tool.
 * This class coordinates between all specialized components and manages the test lifecycle.
 */
export class CoreRunner extends EventEmitter {
  private config: TressiConfig;
  private options: TressiOptionsConfig;
  private resultAggregator: ResultAggregator;
  private rpsCalculator: RpsCalculator;
  private requestExecutor: RequestExecutor;
  private responseSampler: ResponseSampler;
  private executionEngine: ExecutionEngine;
  private startTime: number = 0;
  private stopped = false;

  /**
   * Creates a new CoreRunner instance.
   * @param config The Tressi configuration
   */
  constructor(config: TressiConfig) {
    super();

    this.config = config;
    // Configuration has defaults applied via Zod, use directly
    this.options = config.options;

    // Initialize components in correct order
    this.responseSampler = new ResponseSampler();
    this.requestExecutor = new RequestExecutor(
      this.responseSampler,
      1000, // Default max pool size
    );
    this.resultAggregator = new ResultAggregator(
      this.options.useUI ?? true,
      1000, // Default max sample size
    );
    this.rpsCalculator = new RpsCalculator();
    this.executionEngine = new ExecutionEngine(this);

    // Set up event forwarding
    this.setupEventForwarding();
  }

  /**
   * Sets up event forwarding between components.
   */
  private setupEventForwarding(): void {
    // Forward execution engine events
    this.executionEngine.on('executionStarted', (data) => {
      this.emit('executionStarted', data);
    });

    this.executionEngine.on('executionStopped', (data) => {
      this.emit('executionStopped', data);
    });
  }

  /**
   * Starts the load test execution.
   * This is the main entry point that coordinates all components.
   */
  public async run(): Promise<void> {
    this.startTime = performance.now();
    this.stopped = false;

    try {
      // Validate configuration before starting
      const validationResult = RateLimitValidator.validate(this.config);
      if (!validationResult.isValid) {
        RateLimitValidator.logValidationResults(validationResult);
        throw new Error('Configuration validation failed');
      }

      // Log warnings and recommendations
      if (
        validationResult.warnings.length > 0 ||
        validationResult.recommendations.length > 0
      ) {
        RateLimitValidator.logValidationResults(validationResult);
      }

      // Emit start event
      this.emit('start', {
        config: this.config,
        startTime: this.startTime,
      });

      // Register resources for cleanup
      this.registerResources();

      // Start the execution engine
      await this.executionEngine.start();

      // Wait for completion or stop signal
      await this.waitForCompletion();

      // Emit completion event
      this.emit('complete', {
        duration: performance.now() - this.startTime,
        totalRequests: this.resultAggregator.getTotalRequestsCount(),
        successfulRequests: this.resultAggregator.getSuccessfulRequestsCount(),
        failedRequests: this.resultAggregator.getFailedRequestsCount(),
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Registers resources for automatic cleanup.
   */
  private registerResources(): void {
    // Register request executor pools
    globalResourceManager.registerResource('request-executor-pools', {
      cleanup: () => {
        this.requestExecutor.clearPools();
        this.responseSampler.clear();
      },
    });

    // Register result aggregator - don't clear it here, we need results for reporting
    globalResourceManager.registerResource('result-aggregator', {
      cleanup: () => {
        // Don't clear the result aggregator - results are needed for reporting
      },
    });
  }

  /**
   * Waits for test completion or stop signal.
   */
  private async waitForCompletion(): Promise<void> {
    const { durationSec = 10 } = this.config.options;
    const maxDurationMs = durationSec * 1000;

    return new Promise<void>((resolve) => {
      const timeoutId = setTimeout(async () => {
        await this.stop();
        resolve();
      }, maxDurationMs);

      this.once('stop', async () => {
        clearTimeout(timeoutId);
        resolve();
      });

      this.once('error', async () => {
        clearTimeout(timeoutId);
        await this.stop();
        resolve();
      });
    });
  }

  /**
   * Stops the test execution.
   */
  public async stop(): Promise<void> {
    if (this.stopped) return;

    this.stopped = true;
    await this.executionEngine.stop();
    this.emit('stop');
  }

  /**
   * Cleans up all resources.
   */
  private async cleanup(): Promise<void> {
    // Don't clear the result aggregator here - we need the results for reporting
    globalResourceManager.cleanupAll();
  }

  /**
   * Records a request result.
   * @param result The request result to record
   */
  public recordResult(result: RequestResult): void {
    this.resultAggregator.recordResult(result);
    this.rpsCalculator.recordRequest(result.timestamp);

    // Check for early exit conditions
    if (this.shouldEarlyExit()) {
      this.stop();
    }

    // Emit result event for UI updates
    this.emit('result', result);
  }

  /**
   * Checks if early exit conditions are met.
   * @returns true if early exit conditions are met
   */
  private shouldEarlyExit(): boolean {
    return this.resultAggregator.shouldEarlyExit(this.options);
  }

  /**
   * Gets the result aggregator for accessing statistics.
   * @returns The result aggregator instance
   */
  public getResultAggregator(): ResultAggregator {
    return this.resultAggregator;
  }

  /**
   * Gets the RPS calculator for accessing RPS statistics.
   * @returns The RPS calculator instance
   */
  public getRpsCalculator(): RpsCalculator {
    return this.rpsCalculator;
  }

  /**
   * Gets the request executor for making HTTP requests.
   * @returns The request executor instance
   */
  public getRequestExecutor(): RequestExecutor {
    return this.requestExecutor;
  }

  /**
   * Gets the execution engine.
   * @returns The execution engine instance
   */
  public getExecutionEngine(): ExecutionEngine {
    return this.executionEngine;
  }

  /**
   * Gets the configuration.
   * @returns The Tressi configuration
   */
  public getConfig(): TressiConfig {
    return this.config;
  }

  /**
   * Gets the validated options.
   * @returns The validated options
   */
  public getOptions(): TressiOptionsConfig {
    return this.options;
  }

  /**
   * Gets the start time of the test.
   * @returns The start time as a Unix timestamp
   */
  public getStartTime(): number {
    return this.startTime;
  }

  /**
   * Checks if the test is stopped.
   * @returns true if the test is stopped
   */
  public isStopped(): boolean {
    return this.stopped;
  }
}
