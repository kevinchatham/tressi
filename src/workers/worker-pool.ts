import { EventEmitter } from 'events';

/**
 * Represents a worker with its associated promise and stop function.
 */
export interface Worker {
  promise: Promise<void>;
  stop: () => void;
}

/**
 * Manages a pool of workers for load testing.
 * This class handles worker lifecycle, scaling, and coordination.
 */
export class WorkerPool extends EventEmitter {
  private workers: Worker[] = [];
  private maxWorkers: number;

  constructor(maxWorkers: number = 10) {
    super();
    this.maxWorkers = maxWorkers;
  }

  /**
   * Gets the current number of active workers.
   * @returns The number of active workers
   */
  getWorkerCount(): number {
    return this.workers.length;
  }

  /**
   * Gets the maximum allowed workers.
   * @returns The maximum worker count
   */
  getMaxWorkers(): number {
    return this.maxWorkers;
  }

  /**
   * Adds a new worker to the pool.
   * @param workerFactory Function that creates a worker
   * @returns true if the worker was added, false if max workers reached
   */
  addWorker(workerFactory: () => Worker): boolean {
    if (this.workers.length >= this.maxWorkers) {
      return false;
    }

    const worker = workerFactory();
    this.workers.push(worker);

    // Emit event when worker is added
    this.emit('workerAdded', this.workers.length);

    // Clean up when worker promise resolves
    worker.promise.finally(() => {
      this.removeWorkerFromPool(worker);
    });

    return true;
  }

  /**
   * Removes a worker from the pool and stops it.
   * @returns The removed worker, or undefined if no workers available
   */
  removeWorker(): Worker | undefined {
    const worker = this.workers.pop();
    if (worker) {
      worker.stop();
      this.emit('workerRemoved', this.workers.length);
    }
    return worker;
  }

  /**
   * Removes a specific worker from the pool.
   * @param worker The worker to remove
   */
  private removeWorkerFromPool(worker: Worker): void {
    const index = this.workers.indexOf(worker);
    if (index !== -1) {
      this.workers.splice(index, 1);
      this.emit('workerRemoved', this.workers.length);
    }
  }

  /**
   * Stops all workers in the pool.
   */
  stopAllWorkers(): void {
    // Create a copy of the array to avoid modification during iteration
    const workersToStop = [...this.workers];

    for (const worker of workersToStop) {
      worker.stop();
    }

    this.workers = [];
    this.emit('allWorkersStopped', 0);
  }

  /**
   * Waits for all workers to complete.
   * @returns Promise that resolves when all workers are done
   */
  async waitForAllWorkers(): Promise<void> {
    if (this.workers.length === 0) {
      return;
    }

    await Promise.all(this.workers.map((worker) => worker.promise));
  }

  /**
   * Gets statistics about the worker pool.
   * @returns Worker pool statistics
   */
  getStats(): WorkerPoolStats {
    return {
      activeWorkers: this.workers.length,
      maxWorkers: this.maxWorkers,
      utilization:
        this.maxWorkers > 0 ? (this.workers.length / this.maxWorkers) * 100 : 0,
    };
  }

  /**
   * Clears all workers without stopping them (use with caution).
   * This is useful for cleanup scenarios where workers are already stopped.
   */
  clear(): void {
    this.workers = [];
    this.emit('allWorkersStopped', 0);
  }
}

/**
 * Statistics about the worker pool
 */
export interface WorkerPoolStats {
  activeWorkers: number;
  maxWorkers: number;
  utilization: number;
}
