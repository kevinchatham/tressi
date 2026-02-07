/**
 * WorkerStateManager - Type-safe worker lifecycle management
 * Provides atomic state transitions for worker coordination
 */

import { IWorkerStateManager } from '../interfaces';
import { WorkerState } from '../types';

export class WorkerStateManager implements IWorkerStateManager {
  private readonly sab: SharedArrayBuffer;
  private readonly states: Int32Array;
  private readonly maxWorkers: number;

  constructor(maxWorkers: number, externalBuffer?: SharedArrayBuffer) {
    this.maxWorkers = maxWorkers;

    // Calculate required buffer size
    const requiredSize = maxWorkers * 4;

    if (externalBuffer) {
      // Validate buffer size
      if (externalBuffer.byteLength < requiredSize) {
        throw new Error(
          `Buffer too small: expected ${requiredSize}, got ${externalBuffer.byteLength}`,
        );
      }
      this.sab = externalBuffer;
    } else {
      // Allocate 4 bytes per worker state (Int32)
      this.sab = new SharedArrayBuffer(requiredSize);
    }

    this.states = new Int32Array(this.sab);

    // Only initialize if we created the buffer
    if (!externalBuffer) {
      // Initialize all workers to INITIALIZING state
      for (let i = 0; i < maxWorkers; i++) {
        Atomics.store(this.states, i, WorkerState.INITIALIZING);
      }
    }
  }

  /**
   * Set worker state atomically
   */
  setWorkerState(workerId: number, state: WorkerState): void {
    if (workerId < 0 || workerId >= this.maxWorkers) {
      throw new Error(`Invalid worker ID: ${workerId}`);
    }

    Atomics.store(this.states, workerId, state);

    // Notify any waiters that the state has changed
    Atomics.notify(this.states, workerId, 1);
  }

  /**
   * Get worker state atomically
   */
  getWorkerState(workerId: number): WorkerState {
    if (workerId < 0 || workerId >= this.maxWorkers) {
      throw new Error(`Invalid worker ID: ${workerId}`);
    }

    return Atomics.load(this.states, workerId) as WorkerState;
  }

  /**
   * Wait for worker to reach target state
   * @param timeoutMs Timeout in milliseconds
   * @returns true if state reached, false if timeout
   */
  waitForState(
    workerId: number,
    targetState: WorkerState,
    timeoutMs: number,
  ): boolean {
    if (workerId < 0 || workerId >= this.maxWorkers) {
      throw new Error(`Invalid worker ID: ${workerId}`);
    }

    const startTime = Date.now();
    const timeoutTime = startTime + timeoutMs;

    while (Date.now() < timeoutTime) {
      const currentState = Atomics.load(this.states, workerId);
      if (currentState === targetState) {
        return true;
      }

      // Calculate remaining time for this wait iteration
      const remainingMs = Math.min(100, timeoutTime - Date.now());

      if (remainingMs <= 0) {
        break;
      }

      // Use Atomics.wait for efficient blocking
      const waitResult = Atomics.wait(
        this.states,
        workerId,
        currentState,
        remainingMs,
      );

      // If notified or timed out, continue loop to check state
      if (waitResult === 'not-equal') {
        continue;
      }
    }

    // Final check in case we timed out but state changed
    return Atomics.load(this.states, workerId) === targetState;
  }

  /**
   * Get the underlying SharedArrayBuffer
   */
  getSharedBuffer(): SharedArrayBuffer {
    return this.sab;
  }
}
