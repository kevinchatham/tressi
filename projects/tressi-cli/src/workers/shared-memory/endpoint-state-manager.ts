import { IEndpointStateManager } from '../interfaces';
import { EndpointState } from '../types';

/**
 * EndpointStateManager - Track per-endpoint states for selective stopping
 * Provides atomic state management for individual endpoints across workers
 */
export class EndpointStateManager implements IEndpointStateManager {
  private readonly sab: SharedArrayBuffer;
  private readonly states: Int32Array;
  private readonly totalEndpoints: number;

  constructor(totalEndpoints: number, externalBuffer?: SharedArrayBuffer) {
    this.totalEndpoints = totalEndpoints;

    const requiredSize = totalEndpoints * 4; // 4 bytes per Int32 state

    if (externalBuffer) {
      if (externalBuffer.byteLength < requiredSize) {
        throw new Error(
          `Buffer too small: expected ${requiredSize}, got ${externalBuffer.byteLength}`,
        );
      }
      this.sab = externalBuffer;
    } else {
      this.sab = new SharedArrayBuffer(requiredSize);
    }

    this.states = new Int32Array(this.sab);

    // Initialize all endpoints to RUNNING state
    if (!externalBuffer) {
      for (let i = 0; i < totalEndpoints; i++) {
        Atomics.store(this.states, i, EndpointState.RUNNING);
      }
    }
  }

  /**
   * Set endpoint state atomically
   */
  setEndpointState(endpointIndex: number, state: EndpointState): void {
    if (endpointIndex < 0 || endpointIndex >= this.totalEndpoints) {
      throw new Error(`Invalid endpoint index: ${endpointIndex}`);
    }

    Atomics.store(this.states, endpointIndex, state);
    Atomics.notify(this.states, endpointIndex, 1);
  }

  /**
   * Get endpoint state atomically
   */
  getEndpointState(endpointIndex: number): EndpointState {
    if (endpointIndex < 0 || endpointIndex >= this.totalEndpoints) {
      throw new Error(`Invalid endpoint index: ${endpointIndex}`);
    }

    return Atomics.load(this.states, endpointIndex) as EndpointState;
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
    for (let i = 0; i < this.totalEndpoints; i++) {
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
    return this.sab;
  }

  /**
   * Get total number of endpoints
   */
  getTotalEndpoints(): number {
    return this.totalEndpoints;
  }
}
