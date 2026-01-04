import EventEmitter from 'eventemitter3';
import { performance } from 'perf_hooks';

import { TressiConfig } from '../common/config/types';
import type { AggregatedMetrics } from '../common/metrics';
import type { TestSummary } from '../reporting/types';
import { IRunnerEvents } from '../workers/interfaces';
import { WorkerPoolManager } from '../workers/worker-pool-manager';

/**
 * Core orchestration component for the Tressi load testing tool.
 * This class coordinates between all specialized components and manages the test lifecycle.
 */
export class Runner extends EventEmitter<IRunnerEvents> {
  private workerPool: WorkerPoolManager;
  private startTime: number = 0;

  /**
   * Creates a new CoreRunner instance.
   * @param config The Tressi configuration
   */
  constructor(private config: TressiConfig) {
    super();
    this.workerPool = new WorkerPoolManager(config);
  }

  getAggregatedMetrics(): AggregatedMetrics {
    return this.workerPool.getAggregatedResults();
  }

  /**
   * Starts the load test execution.
   * This is the main entry point that coordinates all components.
   */
  public async run(): Promise<void> {
    this.startTime = performance.now();

    // Sync start time with metrics aggregator
    this.workerPool.setStartTime(this.startTime);

    try {
      this.emit('start', {
        config: this.config,
        startTime: this.startTime,
      });
      await this.runWithWorkers();
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private async runWithWorkers(): Promise<void> {
    await this.workerPool.start();
    await this.workerPool.waitForWorkersComplete();
    const results = this.workerPool.getAggregatedResults();
    this.emit('complete', results);
  }

  /**
   * Stops the test execution.
   */
  public async stop(): Promise<void> {
    await this.workerPool.stop();
  }

  /**
   * Gets the start time of the test.
   * @returns The start time as a Unix timestamp
   */
  public getStartTime(): number {
    return this.startTime;
  }

  /**
   * Set the start time for metrics aggregation
   * @param startTime Unix timestamp in milliseconds
   */
  public setStartTime(startTime: number): void {
    this.workerPool.setStartTime(startTime);
  }

  /**
   * Gets the Tressi configuration.
   * @returns The TressiConfig used for this test run
   */
  public getConfig(): TressiConfig {
    return this.config;
  }

  /**
   * Get test summary for report generation
   * @returns TestSummary object
   */
  public getTestSummary(): TestSummary {
    return this.workerPool.getTestSummary();
  }

  /**
   * Gets body samples collected during the test.
   * @returns Record of endpoint URL to body samples
   */
  public getResponseSamples(): Record<
    string,
    Array<{ statusCode: number; body: string }>
  > {
    return this.workerPool.getResponseSamples();
  }

  /**
   * Clean up body samples for this run.
   */
  public cleanupResponseSamples(): void {
    this.workerPool.cleanupResponseSamples();
  }

  public setTestId(testId: string): void {
    this.workerPool.setTestId(testId);
  }
}
