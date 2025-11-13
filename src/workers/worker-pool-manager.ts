import { cpus } from 'os';
import { Worker } from 'worker_threads';

import type { TressiConfig, TressiRequestConfig } from '../types';
import { getWorkerThreadPath } from '../utils';
import { EarlyExitCoordinator } from './early-exit-coordinator';
import { MetricsAggregator } from './metrics-aggregator';
import { SharedMemoryManager } from './shared-memory-manager';

export class WorkerPoolManager {
  private workers: Worker[] = [];
  private sharedMemory: SharedMemoryManager;
  private metricsAggregator: MetricsAggregator;
  private earlyExitCoordinator: EarlyExitCoordinator;
  private maxWorkers: number;

  constructor(
    private config: TressiConfig,
    maxWorkers?: number,
  ) {
    this.maxWorkers = maxWorkers || cpus().length;
    this.sharedMemory = new SharedMemoryManager(
      this.maxWorkers,
      config.requests.length,
      10000, // buffer size per worker
    );

    this.metricsAggregator = new MetricsAggregator(this.sharedMemory);
    this.earlyExitCoordinator = new EarlyExitCoordinator(
      config,
      this.sharedMemory,
    );
  }

  async start(): Promise<void> {
    const workerConfigs = this.distributeEndpoints();

    // Reset shared memory
    this.sharedMemory.reset();

    const workerPath = getWorkerThreadPath();

    for (let i = 0; i < workerConfigs.length; i++) {
      const worker = new Worker(workerPath, {
        workerData: {
          workerId: i,
          endpoints: workerConfigs[i],
          sharedBuffer: this.sharedMemory.getBuffer(),
          memoryLimit: this.config.options.workerMemoryLimit,
          totalWorkers: workerConfigs.length,
          durationSec: this.config.options.durationSec || 10,
        },
        resourceLimits: {
          maxOldGenerationSizeMb: this.config.options.workerMemoryLimit,
        },
      });

      this.setupWorkerErrorHandling(worker, i);
      this.workers.push(worker);
    }

    // Start early exit monitoring
    this.earlyExitCoordinator.startMonitoring(this.workers);

    // Wait for all workers to be ready
    await this.waitForWorkersReady();
  }

  private setupWorkerErrorHandling(worker: Worker, workerId: number): void {
    worker.on('error', (error) => {
      process.stderr.write(`Worker ${workerId} error: ${error.message}\n`);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        process.stderr.write(`Worker ${workerId} exited with code ${code}\n`);
      }
    });
  }

  private distributeEndpoints(): TressiRequestConfig[][] {
    const endpoints = this.config.requests;
    const workers = Math.min(this.maxWorkers, endpoints.length);
    const distribution: TressiRequestConfig[][] = Array.from(
      { length: workers },
      () => [],
    );

    endpoints.forEach((endpoint, index) => {
      const workerIndex = index % workers;
      distribution[workerIndex].push(endpoint);
    });

    return distribution;
  }

  private async waitForWorkersReady(): Promise<void> {
    // Simple wait - in production you might want to implement proper readiness checks
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  async waitForCompletion(): Promise<void> {
    const maxDurationMs = (this.config.options.durationSec || 10) * 1000; // Add 5s buffer

    const workerPromises = this.workers.map(
      (worker) =>
        new Promise<void>((resolve) => {
          worker.on('exit', () => resolve());
        }),
    );

    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        // Force terminate workers if they haven't exited
        this.workers.forEach((worker) => {
          if (!worker.threadId) return; // Worker already terminated
          try {
            worker.terminate();
          } catch {
            // Ignore termination errors
          }
        });
        resolve();
      }, maxDurationMs);
    });

    await Promise.race([Promise.all(workerPromises), timeoutPromise]);
  }

  getAggregatedResults(): ReturnType<MetricsAggregator['getResults']> {
    return this.metricsAggregator.getResults(this.maxWorkers);
  }

  async stop(): Promise<void> {
    this.earlyExitCoordinator.stopMonitoring();
    this.sharedMemory.signalShutdown();

    for (const worker of this.workers) {
      worker.postMessage({ type: 'stop' });
    }

    await Promise.all(this.workers.map((worker) => worker.terminate()));
  }
}
