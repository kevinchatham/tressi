import { EventEmitter } from 'events';

import { RequestConfig } from './config';
import { RunOptions } from './index';
import { average, RequestResult } from './stats';

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class Runner extends EventEmitter {
  private options: RunOptions;
  private requests: RequestConfig[];
  private headers: Record<string, string>;
  private results: RequestResult[] = [];
  private latencies: number[] = [];
  private statusCodeMap: Record<number, number> = {};
  private stopped = false;
  private startTime: number = 0;
  private currentRpm: number;
  private successfulRequests = 0;
  private failedRequests = 0;

  constructor(
    options: RunOptions,
    requests: RequestConfig[],
    headers: Record<string, string>,
  ) {
    super();
    this.options = options;
    this.requests = requests;
    this.headers = headers;
    this.currentRpm =
      options.rampUpTimeSec && options.rps ? 0 : options.rps || 0;
  }

  public onResult(result: RequestResult): void {
    this.results.push(result);
    this.latencies.push(result.latencyMs);
    this.statusCodeMap[result.status] =
      (this.statusCodeMap[result.status] || 0) + 1;

    if (result.success) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }
  }

  public getResults(): RequestResult[] {
    return this.results;
  }

  public getLatencies(): number[] {
    return this.latencies;
  }

  public getStatusCodeMap(): Record<number, number> {
    return this.statusCodeMap;
  }

  public getSuccessfulRequestsCount(): number {
    return this.successfulRequests;
  }

  public getFailedRequestsCount(): number {
    return this.failedRequests;
  }

  public getAverageLatency(): number {
    return average(this.latencies);
  }

  public getStartTime(): number {
    return this.startTime;
  }

  public getCurrentRpm(): number {
    return Math.round(this.currentRpm);
  }

  public getCurrentRps(): number {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const recentRequests = this.results.filter(
      (r) => r.timestamp >= oneSecondAgo,
    );
    return recentRequests.length;
  }

  public async run(): Promise<RequestResult[]> {
    this.startTime = Date.now();

    const {
      concurrency = 10,
      durationSec = 10,
      rampUpTimeSec = 0,
      rps = 0,
    } = this.options;

    // The main timer for the total test duration starts now
    const durationMs = durationSec * 1000;
    const testTimeout = setTimeout(() => this.stop(), durationMs);

    // If ramp-up is enabled, start the governor
    if (rampUpTimeSec > 0) {
      const rampUpInterval = setInterval(() => {
        const elapsedTimeSec = (Date.now() - this.startTime) / 1000;

        if (this.stopped) {
          clearInterval(rampUpInterval);
          return;
        }

        const rampUpProgress = Math.min(elapsedTimeSec / rampUpTimeSec, 1);

        if (rps > 0) {
          // If a target RPS is set, ramp up to that value
          this.currentRpm = Math.round(rps * rampUpProgress);
        } else {
          // If no target RPS, ramp up to a theoretical max (e.g., 1k RPS per worker)
          // This creates a steady increase with no upper bound.
          const arbitraryMaxRps = (this.options.concurrency || 10) * 1000;
          this.currentRpm = Math.round(arbitraryMaxRps * rampUpProgress);
        }
      }, 1000); // Update every second
    }

    const workers = Array.from({ length: concurrency }, () => this.runWorker());
    await Promise.all(workers);

    clearTimeout(testTimeout);
    return this.results;
  }

  public stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.emit('stop');
  }

  private async runWorker(): Promise<void> {
    while (!this.stopped) {
      const req =
        this.requests[Math.floor(Math.random() * this.requests.length)];
      const start = Date.now();

      try {
        const res = await fetch(req.url, {
          method: req.method || 'GET',
          headers: this.headers,
          body: req.payload ? JSON.stringify(req.payload) : undefined,
        });

        const latencyMs = Date.now() - start;
        this.onResult({
          url: req.url,
          status: res.status,
          latencyMs,
          success: res.ok,
          timestamp: Date.now(),
        });
      } catch (err) {
        const latencyMs = Date.now() - start;
        this.onResult({
          url: req.url,
          status: 0,
          latencyMs,
          success: false,
          error: (err as Error).message,
          timestamp: Date.now(),
        });
      }

      // If a target RPS is set for the test, we need to manage the request rate.
      if (this.options.rps && this.options.concurrency) {
        if (this.currentRpm > 0) {
          // The current RPS is non-zero, so we calculate a delay to match it.
          const targetDelayMs =
            (this.options.concurrency * 1000) / this.currentRpm;

          // Account for the request's own latency to improve accuracy
          const delayToApply = Math.max(
            0,
            targetDelayMs - (Date.now() - start),
          );

          await sleep(delayToApply);
        } else {
          // A target RPM is set, but the current RPM is 0 (start of ramp-up).
          // We must sleep briefly to prevent a busy-loop that would block the governor.
          await sleep(50);
        }
      }
      // If no `options.rpm` is set, the loop proceeds without delay for maximum speed.
    }
  }
}
