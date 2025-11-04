import { performance } from 'perf_hooks';

import { CircularBuffer } from '../../utils/circular-buffer';

/**
 * Calculates requests per second (RPS) metrics for load testing.
 * This class tracks request timestamps and calculates current RPS over time windows.
 */
export class RpsCalculator {
  private recentRequestTimestamps: CircularBuffer<number>;
  private bufferSize: number;

  /**
   * Creates a new RpsCalculator instance.
   * @param maxRps The maximum expected RPS (used to size the buffer)
   * @param bufferSize Optional buffer size (defaults to maxRps * 2 or 10000, whichever is larger)
   */
  constructor(maxRps: number = 1000, bufferSize?: number) {
    // Estimate buffer size: 2 seconds of requests at max RPS, or 10k, whichever is larger
    this.bufferSize = bufferSize || Math.max(10000, maxRps * 2);
    this.recentRequestTimestamps = new CircularBuffer<number>(this.bufferSize);
  }

  /**
   * Records a request timestamp.
   * @param timestamp Optional timestamp (defaults to current time)
   */
  recordRequest(timestamp?: number): void {
    const requestTimestamp = timestamp || performance.now();
    this.recentRequestTimestamps.add(requestTimestamp);
  }

  /**
   * Calculates the actual requests per second over the last second.
   * @param timeWindowMs The time window in milliseconds (defaults to 1000ms)
   * @returns The current actual RPS
   */
  getCurrentRps(timeWindowMs: number = 1000): number {
    const now = performance.now();
    const timeWindowAgo = now - timeWindowMs;

    const timestamps = this.recentRequestTimestamps.getAll();
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
   * Calculates RPS over a custom time window.
   * @param timeWindowMs The time window in milliseconds
   * @returns The RPS for the specified time window
   */
  getRpsForWindow(timeWindowMs: number): number {
    if (timeWindowMs <= 0) return 0;

    const requestCount = this.getRequestCountForWindow(timeWindowMs);
    return (requestCount * 1000) / timeWindowMs; // Convert to requests per second
  }

  /**
   * Gets the count of requests within a time window.
   * @param timeWindowMs The time window in milliseconds
   * @returns The number of requests in the time window
   */
  getRequestCountForWindow(timeWindowMs: number): number {
    const now = performance.now();
    const timeWindowAgo = now - timeWindowMs;

    const timestamps = this.recentRequestTimestamps.getAll();
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
   * Gets the peak RPS observed.
   * @returns The peak RPS observed
   */
  getPeakRps(): number {
    // This is a simplified implementation - in a real scenario, you might want to
    // track peak RPS over time or use a more sophisticated algorithm
    const timestamps = this.recentRequestTimestamps.getAll();
    if (timestamps.length === 0) return 0;

    // Calculate RPS for the entire available data range
    const oldestTimestamp = timestamps[0];
    const newestTimestamp = timestamps[timestamps.length - 1];
    const timeSpanMs = newestTimestamp - oldestTimestamp;

    if (timeSpanMs <= 0) return 0;

    // For now, we calculate RPS over the entire available data range
    // In a more sophisticated implementation, we could use the timeWindowMs parameter
    // to calculate peak RPS over sliding windows
    return (timestamps.length * 1000) / timeSpanMs;
  }

  /**
   * Gets all recorded timestamps.
   * @returns An array of timestamps
   */
  getTimestamps(): number[] {
    return this.recentRequestTimestamps.getAll();
  }

  /**
   * Clears all recorded timestamps.
   */
  clear(): void {
    // Note: CircularBuffer doesn't have a clear method, but we could implement one
    // For now, we'll create a new instance
    this.recentRequestTimestamps = new CircularBuffer<number>(this.bufferSize);
  }

  /**
   * Gets the current buffer size.
   * @returns The buffer size
   */
  getBufferSize(): number {
    return this.bufferSize;
  }

  /**
   * Gets the number of timestamps currently stored.
   * @returns The number of timestamps
   */
  getTimestampCount(): number {
    return this.recentRequestTimestamps.size();
  }
}
