import { EventEmitter } from 'events';
import { cpus } from 'os';
import { performance } from 'perf_hooks';

import type { TressiConfig, TressiOptionsConfig } from '../types';
import { RateLimitValidator } from '../validation/rate-limit-validator';
import { AggregatedMetrics } from '../workers/metrics-aggregator';
import { WorkerPoolManager } from '../workers/worker-pool-manager';

/**
 * Core orchestration component for the Tressi load testing tool.
 * This class coordinates between all specialized components and manages the test lifecycle.
 */
export class Runner extends EventEmitter {
  private config: TressiConfig;
  private options: TressiOptionsConfig;
  private workerPool: WorkerPoolManager | null = null;
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
  }

  get aggregatedMetrics(): AggregatedMetrics | undefined {
    return this.workerPool?.getAggregatedResults();
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

      // Use worker threads for all execution
      await this.runWithWorkers();
    } catch (error) {
      this.emit('error', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async runWithWorkers(): Promise<void> {
    this.workerPool = new WorkerPoolManager(
      this.config,
      this.config.options.threads || cpus().length,
    );

    await this.workerPool.start();

    await this.workerPool.waitForCompletion();

    // Get results from worker pool
    const results = this.workerPool.getAggregatedResults();

    // TODO do not remove / do not eslint ignore
    console.log('\nDEBUG: Request Metrics', {
      ...results,
      statusCodeDistribution: JSON.stringify(results.statusCodeDistribution),
      endpointMetrics: Object.fromEntries(
        Object.entries(results.endpointMetrics).map(([url, data]) => [
          url,
          {
            ...data,
            statusCodeDistribution: JSON.stringify(data.statusCodeDistribution),
          },
        ]),
      ),
    });

    // Emit completion event with actual results
    this.emit('complete', results);
  }

  /**
   * Stops the test execution.
   */
  public async stop(): Promise<void> {
    if (this.stopped) return;

    this.stopped = true;

    if (this.workerPool) {
      await this.workerPool.stop();
    }

    this.emit('stop');
  }

  /**
   * Cleans up all resources.
   */
  private async cleanup(): Promise<void> {
    // Worker pool handles its own cleanup
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
