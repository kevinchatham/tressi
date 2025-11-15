import { parentPort, workerData } from 'worker_threads';

import { RequestExecutor } from '../http/request-executor';
import { ResponseSampler } from '../http/response-sampler';
import type { TressiRequestConfig } from '../types';
import { SharedMemoryManager } from './shared-memory-manager';
import { WorkerRateLimiter } from './worker-rate-limiter';
import type { WorkerData, WorkerMessage } from './worker-types';

export class WorkerThread {
  private rateLimiter: WorkerRateLimiter;
  private sharedMemory: SharedMemoryManager;
  private requestExecutor: RequestExecutor;
  private isRunning = false;
  private workerId: number;
  private endpoints: TressiRequestConfig[];
  private allEndpoints: TressiRequestConfig[];
  private startTime: number;
  private durationMs: number;

  constructor() {
    const data = workerData as WorkerData;
    this.workerId = data.workerId;
    this.endpoints = data.endpoints;
    this.allEndpoints = data.allEndpoints;
    this.sharedMemory = SharedMemoryManager.fromBuffer(
      data.sharedBuffer,
      data.totalWorkers || 1, // Use actual total workers count
      this.allEndpoints.length, // Use global endpoint count
    );
    this.rateLimiter = new WorkerRateLimiter(this.endpoints);
    this.requestExecutor = new RequestExecutor(new ResponseSampler(), 1000);
    this.startTime = Date.now();
    // Default to 10 seconds if not specified
    this.durationMs = (data.durationSec || 10) * 1000;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.sharedMemory.setWorkerStatus(this.workerId, 1); // running

    parentPort?.on('message', (message: WorkerMessage) => {
      if (message.type === 'stop') {
        this.stop();
      } else if (message.type === 'early_exit') {
        this.stop();
      }
    });

    while (this.isRunning && !this.sharedMemory.shouldShutdown()) {
      const elapsed = Date.now() - this.startTime;
      if (elapsed >= this.durationMs) {
        break;
      }

      const nextRequest = await this.rateLimiter.getNextRequest(
        this.startTime,
        this.durationMs / 1000,
      );

      // Check early exit flags before executing request
      if (nextRequest) {
        const endpointIndex = this.getEndpointIndex(nextRequest);
        if (this.sharedMemory.shouldEarlyExit(endpointIndex)) {
          continue; // Skip this endpoint
        }

        await this.executeRequest(nextRequest, endpointIndex);
      } else {
        // Check duration again before waiting
        const currentElapsed = Date.now() - this.startTime;
        if (currentElapsed >= this.durationMs) {
          break;
        }

        // Calculate remaining time to avoid overshooting
        const remaining = this.durationMs - currentElapsed;
        const waitTime = Math.min(remaining, 1);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    this.sharedMemory.setWorkerStatus(this.workerId, 2); // stopped
    process.exit(0); // Ensure worker exits cleanly
  }

  private async executeRequest(
    request: TressiRequestConfig,
    endpointIndex: number,
  ): Promise<void> {
    try {
      const startTime = performance.now();
      const result = await this.requestExecutor.executeRequest(request);
      const latency = performance.now() - startTime;

      // Debug: Log actual request execution
      // console.error(
      //   `Worker ${this.workerId}: Request to ${request.url} - Success: ${result.success}, Latency: ${latency}ms`,
      // );

      this.sharedMemory.recordResult(this.workerId, {
        success: result.success,
        latency,
        endpointIndex,
        statusCode: result.status,
      });

      // Release result object back to pool
      this.requestExecutor.releaseResultObject(result);
    } catch {
      this.sharedMemory.recordError(this.workerId, endpointIndex);
    }
  }

  private getEndpointIndex(request: TressiRequestConfig): number {
    // Use global endpoint index instead of worker-local index
    const index = this.allEndpoints.findIndex((ep) => ep.url === request.url);
    if (index === -1) {
      return 0; // Default to first endpoint
    }
    return index;
  }

  // waitForNextSlot method removed - using direct timeout instead

  private stop(): void {
    this.isRunning = false;
  }
}

// Worker entry point
if (parentPort) {
  const worker = new WorkerThread();
  worker.start().catch((error: Error) => {
    process.stderr.write(
      `Worker ${workerData.workerId} error: ${error.message}\n`,
    );
    process.stderr.write(
      `Worker ${workerData.workerId} stack: ${error.stack}\n`,
    );
    process.exit(1);
  });

  // Add global error handler
  process.on('uncaughtException', (error) => {
    process.stderr.write(
      `Worker ${workerData.workerId} uncaught: ${error.message}\n`,
    );
    process.exit(1);
  });
}
