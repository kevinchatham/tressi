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
    console.log('DEBUG: WorkerPoolManager constructor called');
    this.maxWorkers = maxWorkers || cpus().length;
    console.log('DEBUG: maxWorkers:', this.maxWorkers);

    console.log('DEBUG: Creating SharedMemoryManager...');
    this.sharedMemory = new SharedMemoryManager(
      this.maxWorkers,
      config.requests.length,
      10000, // buffer size per worker
    );
    console.log('DEBUG: SharedMemoryManager created');

    this.metricsAggregator = new MetricsAggregator(this.sharedMemory);
    this.earlyExitCoordinator = new EarlyExitCoordinator(
      config,
      this.sharedMemory,
    );
    console.log('DEBUG: WorkerPoolManager constructor completed');
  }

  async start(): Promise<void> {
    console.log('DEBUG: WorkerPoolManager.start() called');
    const workerConfigs = this.distributeEndpoints();
    console.log(
      'DEBUG: Worker configs distributed:',
      workerConfigs.length,
      'workers',
    );

    // Reset shared memory
    this.sharedMemory.reset();
    console.log('DEBUG: Shared memory reset');

    const workerPath = getWorkerThreadPath();
    console.log('DEBUG: Worker path resolved:', workerPath);

    for (let i = 0; i < workerConfigs.length; i++) {
      console.log(`DEBUG: Creating worker ${i}...`);
      const worker = new Worker(workerPath, {
        workerData: {
          workerId: i,
          endpoints: workerConfigs[i],
          sharedBuffer: this.sharedMemory.getBuffer(),
          memoryLimit: this.config.options.workerMemoryLimit,
          totalWorkers: workerConfigs.length,
        },
        resourceLimits: {
          maxOldGenerationSizeMb: this.config.options.workerMemoryLimit,
        },
      });
      console.log(`DEBUG: Worker ${i} created`);

      this.setupWorkerErrorHandling(worker, i);
      this.workers.push(worker);
    }

    console.log('DEBUG: Starting early exit monitoring...');
    // Start early exit monitoring
    this.earlyExitCoordinator.startMonitoring(this.workers);

    console.log('DEBUG: Waiting for workers to be ready...');
    // Wait for all workers to be ready
    await this.waitForWorkersReady();
    console.log('DEBUG: All workers ready');
  }

  private setupWorkerErrorHandling(worker: Worker, workerId: number): void {
    worker.on('error', (error) => {
      process.stderr.write(`Worker ${workerId} error: ${error.message}\n`);
      this.handleWorkerFailure(workerId);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        process.stderr.write(`Worker ${workerId} exited with code ${code}\n`);
        this.handleWorkerFailure(workerId);
      }
    });
  }

  private async handleWorkerFailure(workerId: number): Promise<void> {
    // Restart failed worker
    const workerConfigs = this.distributeEndpoints();
    const workerPath = getWorkerThreadPath();
    const newWorker = new Worker(workerPath, {
      workerData: {
        workerId,
        endpoints: workerConfigs[workerId],
        sharedBuffer: this.sharedMemory.getBuffer(),
        memoryLimit: this.config.options.workerMemoryLimit,
        totalWorkers: workerConfigs.length,
      },
    });

    this.workers[workerId] = newWorker;
    this.setupWorkerErrorHandling(newWorker, workerId);
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
    await Promise.all(
      this.workers.map(
        (worker) =>
          new Promise<void>((resolve) => {
            worker.on('exit', () => resolve());
          }),
      ),
    );
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
