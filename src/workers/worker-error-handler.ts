import { Worker } from 'worker_threads';

import type { WorkerMessage } from './worker-types';

export interface WorkerErrorContext {
  workerId: number;
  error: Error;
  endpoint?: string;
  retryCount: number;
}

export class WorkerErrorHandler {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // 1 second

  static async handleWorkerError(
    context: WorkerErrorContext,
    worker: Worker,
    restartCallback: (workerId: number) => Promise<void>,
  ): Promise<void> {
    process.stderr.write(
      `Worker ${context.workerId} error: ${context.error.message}\n`,
    );

    if (context.retryCount < WorkerErrorHandler.MAX_RETRIES) {
      process.stdout.write(
        `Restarting worker ${context.workerId} (attempt ${context.retryCount + 1})\n`,
      );

      // Graceful shutdown
      worker.postMessage({ type: 'stop' } as WorkerMessage);

      // Wait for cleanup
      await new Promise((resolve) =>
        setTimeout(resolve, WorkerErrorHandler.RETRY_DELAY),
      );

      // Restart worker
      await restartCallback(context.workerId);
    } else {
      process.stderr.write(
        `Worker ${context.workerId} failed after ${WorkerErrorHandler.MAX_RETRIES} attempts\n`,
      );
      // Mark worker as permanently failed
      process.exitCode = 1;
    }
  }

  static logWorkerEvent(
    workerId: number,
    event: string,
    details?: unknown,
  ): void {
    const timestamp = new Date().toISOString();
    process.stdout.write(
      `[${timestamp}] Worker ${workerId}: ${event} ${details ? JSON.stringify(details) : ''}\n`,
    );
  }
}
