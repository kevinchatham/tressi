import EventEmitter from 'eventemitter3';
import { performance } from 'perf_hooks';

import { TressiConfig } from '../common/config/types';
import type { AggregatedMetric } from '../common/metrics';
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

  getAggregatedMetrics(): AggregatedMetric {
    return this.workerPool.getAggregatedResults();
  }

  /**
   * Starts the load test execution.
   * This is the main entry point that coordinates all components.
   */
  public async run(): Promise<void> {
    this.startTime = performance.now();

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
}
