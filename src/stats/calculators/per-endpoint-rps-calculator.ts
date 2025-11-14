import { performance } from 'perf_hooks';

import { CircularBuffer } from '../../utils/circular-buffer';

/**
 * Tracks per-endpoint request timestamps for RPS calculation.
 */
interface EndpointTimestampTracker {
  [endpointKey: string]: CircularBuffer<number>;
}

/**
 * Calculates requests per second (RPS) metrics for individual endpoints.
 * This class tracks request timestamps per endpoint and calculates current RPS over time windows.
 */
export class PerEndpointRpsCalculator {
  private endpointTimestamps: EndpointTimestampTracker;
  private bufferSize: number;

  /**
   * Creates a new PerEndpointRpsCalculator instance.
   * @param bufferSize Optional buffer size (defaults to 1000 per endpoint)
   */
  constructor(bufferSize?: number) {
    this.bufferSize = bufferSize || 1000;
    this.endpointTimestamps = {};
  }

  /**
   * Records a request timestamp for a specific endpoint.
   * @param endpointKey The endpoint identifier (e.g., "GET /api/users")
   * @param timestamp Optional timestamp (defaults to current time)
   */
  recordRequest(endpointKey: string, timestamp?: number): void {
    const requestTimestamp = timestamp || performance.now();

    if (!this.endpointTimestamps[endpointKey]) {
      this.endpointTimestamps[endpointKey] = new CircularBuffer<number>(
        this.bufferSize,
      );
    }

    this.endpointTimestamps[endpointKey].add(requestTimestamp);
  }

  /**
   * Calculates the actual requests per second for a specific endpoint over the last second.
   * @param endpointKey The endpoint identifier
   * @param timeWindowMs The time window in milliseconds (defaults to 1000ms)
   * @returns The current actual RPS for the endpoint
   */
  getCurrentRps(endpointKey: string, timeWindowMs: number = 1000): number {
    if (!this.endpointTimestamps[endpointKey]) {
      return 0;
    }

    const now = performance.now();
    const timeWindowAgo = now - timeWindowMs;

    const timestamps = this.endpointTimestamps[endpointKey].getAll();
    let count = 0;

    // Iterate backwards since recent timestamps are at the end
    for (let i = timestamps.length - 1; i >= 0; i--) {
      if (timestamps[i] >= timeWindowAgo) {
        count++;
      } else {
        // The timestamps are ordered, so we can stop.
        break;
      }
    }

    return count;
  }

  /**
   * Calculates RPS for a specific endpoint over a custom time window.
   * @param endpointKey The endpoint identifier
   * @param timeWindowMs The time window in milliseconds
   * @returns The RPS for the specified time window
   */
  getRpsForWindow(endpointKey: string, timeWindowMs: number): number {
    if (timeWindowMs <= 0 || !this.endpointTimestamps[endpointKey]) return 0;

    const requestCount = this.getRequestCountForWindow(
      endpointKey,
      timeWindowMs,
    );
    return (requestCount * 1000) / timeWindowMs; // Convert to requests per second
  }

  /**
   * Gets the count of requests for a specific endpoint within a time window.
   * @param endpointKey The endpoint identifier
   * @param timeWindowMs The time window in milliseconds
   * @returns The number of requests in the time window
   */
  getRequestCountForWindow(endpointKey: string, timeWindowMs: number): number {
    if (!this.endpointTimestamps[endpointKey]) return 0;

    const now = performance.now();
    const timeWindowAgo = now - timeWindowMs;

    const timestamps = this.endpointTimestamps[endpointKey].getAll();
    let count = 0;

    // Iterate backwards since recent timestamps are at the end
    for (let i = timestamps.length - 1; i >= 0; i--) {
      if (timestamps[i] >= timeWindowAgo) {
        count++;
      } else {
        // The timestamps are ordered, so we can stop.
        break;
      }
    }

    return count;
  }

  /**
   * Gets the peak RPS observed for a specific endpoint.
   * @param endpointKey The endpoint identifier
   * @returns The peak RPS observed for the endpoint
   */
  getPeakRps(endpointKey: string): number {
    if (!this.endpointTimestamps[endpointKey]) return 0;

    const timestamps = this.endpointTimestamps[endpointKey].getAll();
    if (timestamps.length === 0) return 0;

    // Calculate RPS for the entire available data range
    const oldestTimestamp = timestamps[0];
    const newestTimestamp = timestamps[timestamps.length - 1];
    const timeSpanMs = newestTimestamp - oldestTimestamp;

    if (timeSpanMs <= 0) return 0;

    return (timestamps.length * 1000) / timeSpanMs;
  }

  /**
   * Gets all recorded timestamps for a specific endpoint.
   * @param endpointKey The endpoint identifier
   * @returns An array of timestamps for the endpoint
   */
  getTimestamps(endpointKey: string): number[] {
    if (!this.endpointTimestamps[endpointKey]) return [];
    return this.endpointTimestamps[endpointKey].getAll();
  }

  /**
   * Gets all endpoint keys that have been recorded.
   * @returns An array of endpoint identifiers
   */
  getAllEndpoints(): string[] {
    return Object.keys(this.endpointTimestamps);
  }

  /**
   * Clears all recorded timestamps for a specific endpoint.
   * @param endpointKey The endpoint identifier
   */
  clearEndpoint(endpointKey: string): void {
    if (this.endpointTimestamps[endpointKey]) {
      this.endpointTimestamps[endpointKey] = new CircularBuffer<number>(
        this.bufferSize,
      );
    }
  }

  /**
   * Clears all recorded timestamps for all endpoints.
   */
  clearAll(): void {
    this.endpointTimestamps = {};
  }

  /**
   * Gets the current buffer size.
   * @returns The buffer size
   */
  getBufferSize(): number {
    return this.bufferSize;
  }

  /**
   * Gets the number of timestamps currently stored for a specific endpoint.
   * @param endpointKey The endpoint identifier
   * @returns The number of timestamps
   */
  getTimestampCount(endpointKey: string): number {
    if (!this.endpointTimestamps[endpointKey]) return 0;
    return this.endpointTimestamps[endpointKey].size();
  }
}
