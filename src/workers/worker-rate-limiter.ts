import type { TressiRequestConfig } from '../types';

export class WorkerRateLimiter {
  private endpoints: TressiRequestConfig[];
  private lastRequestTime: number[] = [];
  private requestCounts: number[] = [];
  private intervalStart: number[] = [];
  private readonly INTERVAL_MS = 1000; // 1 second interval

  constructor(endpoints: TressiRequestConfig[]) {
    this.endpoints = endpoints;
    this.lastRequestTime = new Array(endpoints.length).fill(0);
    this.requestCounts = new Array(endpoints.length).fill(0);
    this.intervalStart = new Array(endpoints.length).fill(0);
  }

  async getNextRequest(
    startTime: number,
    durationSec: number,
  ): Promise<TressiRequestConfig | null> {
    const now = Date.now();
    const elapsedMs = now - startTime;
    const durationMs = durationSec * 1000;

    // Check if we've exceeded the test duration
    if (elapsedMs >= durationMs) {
      return null;
    }

    for (let i = 0; i < this.endpoints.length; i++) {
      const endpoint = this.endpoints[i];
      const rps = endpoint.rps || 1;

      // Check if we need to reset the interval
      if (now - this.intervalStart[i] >= this.INTERVAL_MS) {
        this.intervalStart[i] = now;
        this.requestCounts[i] = 0;
      }

      // Check if we can make a request
      const timeSinceLastRequest = now - this.lastRequestTime[i];
      const minInterval = 1000 / rps;

      if (this.requestCounts[i] < rps && timeSinceLastRequest >= minInterval) {
        this.lastRequestTime[i] = now;
        this.requestCounts[i]++;
        return endpoint;
      }
    }

    // Calculate the minimum wait time, but don't exceed remaining duration
    let minWaitTime = Infinity;
    for (let i = 0; i < this.endpoints.length; i++) {
      const endpoint = this.endpoints[i];
      const rps = endpoint.rps || 1;
      const minInterval = 1000 / rps;
      const timeSinceLastRequest = now - this.lastRequestTime[i];
      const waitTime = Math.max(0, minInterval - timeSinceLastRequest);
      minWaitTime = Math.min(minWaitTime, waitTime);
    }

    if (minWaitTime === Infinity) {
      minWaitTime = 1;
    }

    // Ensure we don't wait beyond the test duration
    const remainingMs = durationMs - elapsedMs;
    const actualWaitTime = Math.min(minWaitTime, remainingMs);

    if (actualWaitTime <= 0) {
      return null;
    }

    // Wait for the minimum time before checking again
    await new Promise((resolve) => setTimeout(resolve, actualWaitTime));
    return null;
  }

  getEndpointIndex(request: TressiRequestConfig): number {
    return this.endpoints.findIndex((ep) => ep.url === request.url);
  }

  reset(): void {
    this.lastRequestTime.fill(0);
    this.requestCounts.fill(0);
    this.intervalStart.fill(0);
  }
}
