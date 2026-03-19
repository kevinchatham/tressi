/**
 * WorkerStateManager - Type-safe worker lifecycle management
 * Provides atomic state transitions for worker coordination
 */

import { type IWorkerStateManager, WorkerState } from '@tressi/shared/cli';

export class WorkerStateManager implements IWorkerStateManager {
  private readonly _sab: SharedArrayBuffer;
  private readonly _states: Int32Array;
  private readonly _maxWorkers: number;

  constructor(maxWorkers: number, externalBuffer?: SharedArrayBuffer) {
    this._maxWorkers = maxWorkers;

    // Calculate required buffer size
    const requiredSize = maxWorkers * 4;

    if (externalBuffer) {
      // Validate buffer size
      if (externalBuffer.byteLength < requiredSize) {
        throw new Error(
          `Buffer too small: expected ${requiredSize}, got ${externalBuffer.byteLength}`,
        );
      }
      this._sab = externalBuffer;
    } else {
      // Allocate 4 bytes per worker state (Int32)
      this._sab = new SharedArrayBuffer(requiredSize);
    }

    this._states = new Int32Array(this._sab);

    // Only initialize if we created the buffer
    if (!externalBuffer) {
      // Initialize all workers to INITIALIZING state
      for (let i = 0; i < maxWorkers; i++) {
        Atomics.store(this._states, i, WorkerState.INITIALIZING);
      }
    }
  }

  /**
   * Set worker state atomically
   */
  setWorkerState(workerId: number, state: WorkerState): void {
    if (workerId < 0 || workerId >= this._maxWorkers) {
      throw new Error(`Invalid worker ID: ${workerId}`);
    }

    Atomics.store(this._states, workerId, state);

    // Notify any waiters that the state has changed
    Atomics.notify(this._states, workerId, 1);
  }

  /**
   * Get worker state atomically
   */
  getWorkerState(workerId: number): WorkerState {
    if (workerId < 0 || workerId >= this._maxWorkers) {
      throw new Error(`Invalid worker ID: ${workerId}`);
    }

    return Atomics.load(this._states, workerId) as WorkerState;
  }

  /**
   * Wait for worker to reach target state
   * @param timeoutMs Timeout in milliseconds
   * @returns true if state reached, false if timeout
   */
  waitForState(workerId: number, targetState: WorkerState, timeoutMs: number): boolean {
    if (workerId < 0 || workerId >= this._maxWorkers) {
      throw new Error(`Invalid worker ID: ${workerId}`);
    }

    const startTime = Date.now();
    const timeoutTime = startTime + timeoutMs;

    while (Date.now() < timeoutTime) {
      const currentState = Atomics.load(this._states, workerId);
      if (currentState === targetState) {
        return true;
      }

      // Calculate remaining time for this wait iteration
      const remainingMs = Math.min(100, timeoutTime - Date.now());

      if (remainingMs <= 0) {
        break;
      }

      // Use Atomics.wait for efficient blocking
      const waitResult = Atomics.wait(this._states, workerId, currentState, remainingMs);

      // If notified or timed out, continue loop to check state
      if (waitResult === 'not-equal') {
      }
    }

    // Final check in case we timed out but state changed
    return Atomics.load(this._states, workerId) === targetState;
  }

  /**
   * Get the underlying SharedArrayBuffer
   */
  getSharedBuffer(): SharedArrayBuffer {
    return this._sab;
  }
}
