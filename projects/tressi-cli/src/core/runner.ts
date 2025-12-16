import EventEmitter from 'eventemitter3';
import os from 'os';
import { performance } from 'perf_hooks';
import type { TressiConfig } from 'tressi-common/config';
import type { AggregatedMetric } from 'tressi-common/metrics';

import { IRunnerEvents } from '../types/workers/interfaces';
import { WorkerPoolManager } from '../workers/worker-pool-manager';

/**
 * Core orchestration component for the Tressi load testing tool.
 * This class coordinates between all specialized components and manages the test lifecycle.
 */
export class Runner extends EventEmitter<IRunnerEvents> {
  private config: TressiConfig;
  private workerPool: WorkerPoolManager | null = null;
  private startTime: number = 0;

  /**
   * Creates a new CoreRunner instance.
   * @param config The Tressi configuration
   */
  constructor(config: TressiConfig) {
    super();
    this.config = config;
  }

  getAggregatedMetrics(): AggregatedMetric | undefined {
    return this.workerPool?.getAggregatedResults();
  }

  /**
   * Starts the load test execution.
   * This is the main entry point that coordinates all components.
   */
  public async run(): Promise<void> {
    this.startTime = performance.now();

    try {
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
    }
  }

  private async runWithWorkers(): Promise<void> {
    const cpuCount = os.cpus().length;

    const requestedThreads = this.config.options.threads ?? cpuCount;

    const maxWorkers =
      requestedThreads > cpuCount ? cpuCount : requestedThreads;

    this.workerPool = new WorkerPoolManager(this.config, maxWorkers);

    await this.workerPool.start();

    // Wait for workers to complete their execution using shared memory
    await this.workerPool.waitForWorkersComplete();

    // Get results from worker pool
    const results = this.workerPool.getAggregatedResults();

    // Emit completion event with actual results
    this.emit('complete', results);
  }

  /**
   * Stops the test execution.
   */
  public async stop(): Promise<void> {
    if (this.workerPool) {
      await this.workerPool.stop();
    }
  }

  /**
   * Gets the start time of the test.
   * @returns The start time as a Unix timestamp
   */
  public getStartTime(): number {
    return this.startTime;
  }
}
