import { IEndpointStateManager } from '../interfaces';
import { EndpointState } from '../types';

/**
 * EndpointStateManager - Track per-endpoint states for selective stopping
 * Provides atomic state management for individual endpoints across workers
 */
export class EndpointStateManager implements IEndpointStateManager {
  private readonly _sab: SharedArrayBuffer;
  private readonly _states: Int32Array;
  private readonly _totalEndpoints: number;

  constructor(totalEndpoints: number, externalBuffer?: SharedArrayBuffer) {
    this._totalEndpoints = totalEndpoints;

    const requiredSize = totalEndpoints * 4; // 4 bytes per Int32 state

    if (externalBuffer) {
      if (externalBuffer.byteLength < requiredSize) {
        throw new Error(
          `Buffer too small: expected ${requiredSize}, got ${externalBuffer.byteLength}`,
        );
      }
      this._sab = externalBuffer;
    } else {
      this._sab = new SharedArrayBuffer(requiredSize);
    }

    this._states = new Int32Array(this._sab);

    // Initialize all endpoints to RUNNING state
    if (!externalBuffer) {
      for (let i = 0; i < totalEndpoints; i++) {
        Atomics.store(this._states, i, EndpointState.RUNNING);
      }
    }
  }

  /**
   * Set endpoint state atomically
   */
  setEndpointState(endpointIndex: number, state: EndpointState): void {
    if (endpointIndex < 0 || endpointIndex >= this._totalEndpoints) {
      throw new Error(`Invalid endpoint index: ${endpointIndex}`);
    }

    Atomics.store(this._states, endpointIndex, state);
    Atomics.notify(this._states, endpointIndex, 1);
  }

  /**
   * Get endpoint state atomically
   */
  getEndpointState(endpointIndex: number): EndpointState {
    if (endpointIndex < 0 || endpointIndex >= this._totalEndpoints) {
      throw new Error(`Invalid endpoint index: ${endpointIndex}`);
    }

    return Atomics.load(this._states, endpointIndex) as EndpointState;
  }

  /**
   * Check if endpoint is running
   */
  isEndpointRunning(endpointIndex: number): boolean {
    return this.getEndpointState(endpointIndex) === EndpointState.RUNNING;
  }

  /**
   * Stop a specific endpoint
   */
  stopEndpoint(endpointIndex: number): void {
    this.setEndpointState(endpointIndex, EndpointState.STOPPED);
  }

  /**
   * Get count of running endpoints
   */
  getRunningEndpointsCount(): number {
    let count = 0;
    for (let i = 0; i < this._totalEndpoints; i++) {
      if (this.isEndpointRunning(i)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get underlying SharedArrayBuffer
   */
  getSharedBuffer(): SharedArrayBuffer {
    return this._sab;
  }

  /**
   * Get total number of endpoints
   */
  getTotalEndpoints(): number {
    return this._totalEndpoints;
  }
}
