import { parentPort, workerData } from 'worker_threads';

import { RequestExecutor } from '../request/request-executor';
import { ResponseSampler } from '../request/response-sampler';
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

  constructor() {
    const data = workerData as WorkerData;
    this.workerId = data.workerId;
    this.endpoints = data.endpoints;
    this.sharedMemory = SharedMemoryManager.fromBuffer(
      data.sharedBuffer,
      1, // workersCount - not used in worker context
      this.endpoints.length,
    );
    this.rateLimiter = new WorkerRateLimiter(this.endpoints);
    this.requestExecutor = new RequestExecutor(new ResponseSampler(), 1000);
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
      const nextRequest = await this.rateLimiter.getNextRequest();

      // Check early exit flags before executing request
      if (nextRequest) {
        const endpointIndex = this.getEndpointIndex(nextRequest);
        if (this.sharedMemory.shouldEarlyExit(endpointIndex)) {
          continue; // Skip this endpoint
        }

        await this.executeRequest(nextRequest, endpointIndex);
      } else {
        await this.waitForNextSlot();
      }
    }

    this.sharedMemory.setWorkerStatus(this.workerId, 2); // stopped
  }

  private async executeRequest(
    request: TressiRequestConfig,
    endpointIndex: number,
  ): Promise<void> {
    try {
      const startTime = performance.now();
      const result = await this.requestExecutor.executeRequest(request);
      const latency = performance.now() - startTime;

      this.sharedMemory.recordResult(this.workerId, {
        success: result.success,
        latency,
        endpointIndex,
      });

      // Release result object back to pool
      this.requestExecutor.releaseResultObject(result);
    } catch {
      this.sharedMemory.recordError(this.workerId, endpointIndex);
    }
  }

  private getEndpointIndex(request: TressiRequestConfig): number {
    return this.endpoints.findIndex((ep) => ep.url === request.url);
  }

  private async waitForNextSlot(): Promise<void> {
    // Small delay to prevent busy waiting
    await new Promise((resolve) => setTimeout(resolve, 1));
  }

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
    process.exit(1);
  });
}
