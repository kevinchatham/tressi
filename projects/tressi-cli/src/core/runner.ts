import EventEmitter from 'eventemitter3';
import { performance } from 'perf_hooks';

import { TressiConfig } from '../common/config/types';
import type { AggregatedMetrics } from '../common/metrics';
import type { ResponseSamples, TestSummary } from '../reporting/types';
import { IRunnerEvents } from '../workers/interfaces';
import { WorkerPoolManager } from '../workers/worker-pool-manager';

/**
 * Core orchestration component for the Tressi load testing tool.
 * This class coordinates between all specialized components and manages the test lifecycle.
 */
export class Runner extends EventEmitter<IRunnerEvents> {
  private _workerPool: WorkerPoolManager;
  private _startTime: number = 0;
  private _isCanceled: boolean = false;

  /**
   * Creates a new CoreRunner instance.
   * @param _config The Tressi configuration
   */
  constructor(private _config: TressiConfig) {
    super();
    this._workerPool = new WorkerPoolManager(_config);
  }

  getAggregatedMetrics(): AggregatedMetrics {
    return this._workerPool.getAggregatedResults();
  }

  /**
   * Starts the load test execution.
   * This is the main entry point that coordinates all components.
   */
  public async run(): Promise<void> {
    this._startTime = performance.now();

    // Sync start time with metrics aggregator
    this._workerPool.setStartTime(this._startTime);

    try {
      this.emit('start', {
        config: this._config,
        startTime: this._startTime,
      });
      await this._runWithWorkers();
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private async _runWithWorkers(): Promise<void> {
    await this._workerPool.start();
    await this._workerPool.waitForWorkersComplete();
    const results = this._workerPool.getAggregatedResults();
    this.emit('complete', results);
  }

  /**
   * Stops the test execution.
   */
  public async stop(): Promise<void> {
    await this._workerPool.stop();
  }

  public async cancel(): Promise<void> {
    this._isCanceled = true;
    await this._workerPool.stop();
  }

  /**
   * Checks if the test was manually stopped.
   * @returns True if the test was stopped, false otherwise
   */
  public isCanceled(): boolean {
    return this._isCanceled;
  }

  /**
   * Gets the start time of the test.
   * @returns The start time as a Unix timestamp
   */
  public getStartTime(): number {
    return this._startTime;
  }

  /**
   * Set the start time for metrics aggregation
   * @param startTime Unix timestamp in milliseconds
   */
  public setStartTime(startTime: number): void {
    this._workerPool.setStartTime(startTime);
  }

  /**
   * Gets the Tressi configuration.
   * @returns The TressiConfig used for this test run
   */
  public getConfig(): TressiConfig {
    return this._config;
  }

  /**
   * Get test summary for report generation
   * @returns TestSummary object
   */
  public getTestSummary(): TestSummary {
    return this._workerPool.getTestSummary();
  }

  /**
   * Gets body samples collected during the test.
   * @returns Record of endpoint URL to body samples
   */
  public getResponseSamples(): ResponseSamples {
    return this._workerPool.getResponseSamples();
  }

  /**
   * Clean up body samples for this run.
   */
  public cleanupResponseSamples(): void {
    this._workerPool.cleanupResponseSamples();
  }

  public setTestId(testId: string): void {
    this._workerPool.setTestId(testId);
  }
}
