import { EventEmitter } from 'events';
import { build, Histogram } from 'hdr-histogram-js';

import { CircularBuffer } from './circular-buffer';
import { RequestConfig } from './config';
import { RunOptions } from './index';
import { RequestResult } from './stats';

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The main load test runner. It orchestrates the test execution, manages workers,
 * and collects results. It extends EventEmitter to provide hooks into its lifecycle.
 */
export class Runner extends EventEmitter {
  private options: RunOptions;
  private requests: RequestConfig[];
  private headers: Record<string, string>;
  private sampledResults: RequestResult[] = [];
  private histogram: Histogram;
  private endpointHistograms: Map<string, Histogram> = new Map();
  private recentLatenciesForSpinner: number[] = [];
  private recentRequestTimestamps: CircularBuffer<number>;
  private statusCodeMap: Record<number, number> = {};
  private stopped = false;
  private startTime: number = 0;
  private currentTargetRps: number;
  private sampledEndpointResponses: Map<string, Set<number>> = new Map();
  private successfulRequests = 0;
  private failedRequests = 0;
  private activeWorkers: { promise: Promise<void>; stop: () => void }[] = [];
  private testTimeout?: NodeJS.Timeout;
  private rampUpInterval?: NodeJS.Timeout;
  private autoscaleInterval?: NodeJS.Timeout;

  /**
   * Creates a new Runner instance.
   * @param options The run options.
   * @param requests An array of request configurations to be used in the test.
   * @param headers A record of global headers to be sent with each request.
   */
  constructor(
    options: RunOptions,
    requests: RequestConfig[],
    headers: Record<string, string>,
  ) {
    super();
    this.options = options;
    this.requests = requests;
    this.headers = headers;
    this.histogram = build();
    this.currentTargetRps =
      options.rampUpTimeSec && options.rps ? 0 : options.rps || 0;

    // Estimate buffer size: 2 seconds of requests at max RPS, or 10k, whichever is larger
    const maxRps = options.rps || 1000;
    const bufferSize = Math.max(10000, maxRps * 2);
    this.recentRequestTimestamps = new CircularBuffer<number>(bufferSize);
  }

  /**
   * Records a new request result, updating all relevant statistics.
   * @param result The `RequestResult` to record.
   */
  public onResult(result: RequestResult): void {
    if (this.sampledResults.length < 1000) {
      this.sampledResults.push(result);
    }

    this.histogram.recordValue(result.latencyMs);

    const endpointKey = `${result.method} ${result.url}`;
    if (!this.endpointHistograms.has(endpointKey)) {
      this.endpointHistograms.set(endpointKey, build());
    }
    this.endpointHistograms.get(endpointKey)!.recordValue(result.latencyMs);

    // Keep a small, rotating log of recent latencies for the non-UI spinner
    if (!this.options.useUI) {
      this.recentLatenciesForSpinner.push(result.latencyMs);
      if (this.recentLatenciesForSpinner.length > 1000) {
        this.recentLatenciesForSpinner.shift();
      }
    }

    this.recentRequestTimestamps.add(Date.now());
    this.statusCodeMap[result.status] =
      (this.statusCodeMap[result.status] || 0) + 1;

    if (result.success) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }
  }

  /**
   * Gets a sample of the results collected during the test run.
   * @returns An array of `RequestResult` objects.
   */
  public getSampledResults(): RequestResult[] {
    return this.sampledResults;
  }

  /**
   * Gets the histogram containing all latency values.
   * @returns The HDR histogram instance.
   */
  public getHistogram(): Histogram {
    return this.histogram;
  }

  /**
   * Gets the map of histograms for each endpoint.
   * @returns A map where keys are endpoint identifiers and values are HDR histograms.
   */
  public getEndpointHistograms(): Map<string, Histogram> {
    return this.endpointHistograms;
  }

  /**
   * Gets an array of recent latency values for the non-UI spinner.
   * @returns An array of latency numbers in milliseconds.
   */
  public getRecentLatencies(): number[] {
    return this.recentLatenciesForSpinner;
  }

  /**
   * Gets a map of status codes and their counts.
   * @returns A record where keys are status codes and values are their counts.
   */
  public getStatusCodeMap(): Record<number, number> {
    return this.statusCodeMap;
  }

  /**
   * Gets the total count of successful requests.
   * @returns The number of successful requests.
   */
  public getSuccessfulRequestsCount(): number {
    return this.successfulRequests;
  }

  /**
   * Gets the total count of failed requests.
   * @returns The number of failed requests.
   */
  public getFailedRequestsCount(): number {
    return this.failedRequests;
  }

  /**
   * Calculates and returns the average latency for all requests.
   * @returns The average latency in milliseconds.
   */
  public getAverageLatency(): number {
    return this.histogram.mean;
  }

  /**
   * Gets the timestamp when the test run started.
   * @returns The start time as a Unix timestamp.
   */
  public getStartTime(): number {
    return this.startTime;
  }

  /**
   * Gets the current target requests per second (Req/s).
   * This value changes during ramp-up.
   * @returns The current target Req/s.
   */
  public getCurrentTargetRps(): number {
    return Math.round(this.currentTargetRps);
  }

  /**
   * Calculates the actual requests per second (Req/s) over the last second.
   * @returns The current actual Req/s.
   */
  public getCurrentRps(): number {
    const now = Date.now();
    const oneSecondAgo = now - 1000;

    const timestamps = this.recentRequestTimestamps.getAll();
    let count = 0;
    // Iterate backwards since recent timestamps are at the end
    for (let i = timestamps.length - 1; i >= 0; i--) {
      if (timestamps[i] >= oneSecondAgo) {
        count++;
      } else {
        // The timestamps are ordered, so we can stop.
        break;
      }
    }
    return count;
  }

  /**
   * Gets the current number of active workers.
   * @returns The number of workers.
   */
  public getWorkerCount(): number {
    if (this.options.autoscale) {
      return this.activeWorkers.length;
    }
    return this.options.workers ?? 10;
  }

  /**
   * Starts the load test. This is the main entry point for the runner.
   * It sets up workers, timers, and ramp-up/autoscaling logic.
   */
  public async run(): Promise<void> {
    this.startTime = Date.now();

    const {
      workers = 10,
      durationSec = 10,
      rampUpTimeSec = 0,
      rps = 0,
      autoscale = false,
    } = this.options;

    // The main timer for the total test duration starts now
    const durationMs = durationSec * 1000;
    this.testTimeout = setTimeout(() => this.stop(), durationMs);

    // If ramp-up is enabled, start the governor
    if (rampUpTimeSec > 0) {
      this.rampUpInterval = setInterval(() => {
        const elapsedTimeSec = (Date.now() - this.startTime) / 1000;

        if (this.stopped) {
          clearInterval(this.rampUpInterval as NodeJS.Timeout);
          return;
        }

        const rampUpProgress = Math.min(elapsedTimeSec / rampUpTimeSec, 1);

        if (rps > 0) {
          // If a target RPS is set, ramp up to that value
          this.currentTargetRps = Math.round(rps * rampUpProgress);
        } else {
          // If no target RPS, ramp up to a theoretical max (e.g., 1k Req/s per worker)
          // This creates a steady increase with no upper bound.
          const arbitraryMaxRps = (this.options.workers || 10) * 1000;
          this.currentTargetRps = Math.round(arbitraryMaxRps * rampUpProgress);
        }
      }, 1000); // Update every second
    }

    if (autoscale) {
      // Start with one worker
      this.addWorker();

      this.autoscaleInterval = setInterval(() => {
        if (this.stopped) {
          clearInterval(this.autoscaleInterval as NodeJS.Timeout);
          return;
        }

        const currentRps = this.getCurrentRps();
        const currentWorkers = this.activeWorkers.length;

        if (currentWorkers === 0) {
          this.addWorker();
          return;
        }

        const targetRps = this.options.rps;
        if (!targetRps) return;

        const scaleUpThreshold = targetRps * 0.9;
        const scaleDownThreshold = targetRps * 1.1;

        if (currentRps < scaleUpThreshold && currentWorkers < workers) {
          const rpsDeficit = targetRps - currentRps;
          const avgRpsPerWorker =
            currentWorkers > 0 ? currentRps / currentWorkers : 10;
          const workersNeeded = rpsDeficit / avgRpsPerWorker;
          let workersToAdd = Math.ceil(workersNeeded * 0.25);
          workersToAdd = Math.max(1, workersToAdd);
          workersToAdd = Math.min(workersToAdd, workers - currentWorkers);

          for (let i = 0; i < workersToAdd; i++) {
            this.addWorker();
          }
        } else if (currentRps > scaleDownThreshold && currentWorkers > 1) {
          const rpsSurplus = currentRps - targetRps;
          const avgRpsPerWorker = currentRps / currentWorkers;
          const workersToCut = rpsSurplus / avgRpsPerWorker;
          let workersToRemove = Math.ceil(workersToCut * 0.25);
          workersToRemove = Math.max(1, workersToRemove);
          workersToRemove = Math.min(workersToRemove, currentWorkers - 1);

          for (let i = 0; i < workersToRemove; i++) {
            this.removeWorker();
          }
        }
      }, 2000); // Check every 2 seconds
      await Promise.all(this.activeWorkers.map((w) => w.promise));
    } else {
      const workerPromises = Array.from({ length: workers }, () =>
        this.runWorker(),
      );
      await Promise.all(workerPromises);
    }

    this.cleanup();
  }

  public stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.activeWorkers.forEach((w) => w.stop());
    this.cleanup();
    this.emit('stop');
  }

  /**
   * Cleans up all active timers and intervals.
   */
  private cleanup(): void {
    if (this.testTimeout) {
      clearTimeout(this.testTimeout);
      this.testTimeout = undefined;
    }
    if (this.rampUpInterval) {
      clearInterval(this.rampUpInterval);
      this.rampUpInterval = undefined;
    }
    if (this.autoscaleInterval) {
      clearInterval(this.autoscaleInterval);
      this.autoscaleInterval = undefined;
    }
  }

  /**
   * Adds a new worker to the pool. Used by the autoscaler.
   */
  private addWorker(): void {
    let workerStopped = false;
    const stop = (): void => {
      workerStopped = true;
    };
    const promise = this.runWorker(() => workerStopped);
    this.activeWorkers.push({ promise, stop });
  }

  /**
   * Removes a worker from the pool and stops it. Used by the autoscaler.
   */
  private removeWorker(): void {
    const worker = this.activeWorkers.pop();
    if (worker) {
      worker.stop();
    }
  }

  /**
   * The core worker function. It runs in a loop, making requests and respecting
   * the rate limit (RPS) until instructed to stop.
   * @param isStopped A function that returns true if the worker should stop.
   *                  Defaults to checking the main runner's stopped flag.
   */
  private async runWorker(
    isStopped: () => boolean = () => this.stopped,
  ): Promise<void> {
    while (!isStopped()) {
      const req =
        this.requests[Math.floor(Math.random() * this.requests.length)];
      const start = Date.now();

      try {
        const headers = { ...this.headers, ...req.headers };

        const res = await fetch(req.url, {
          method: req.method || 'GET',
          headers,
          body: req.payload ? JSON.stringify(req.payload) : undefined,
        });

        let body: string | undefined;
        const endpointIdentifier = `${req.method || 'GET'} ${req.url}`;
        if (!this.sampledEndpointResponses.has(endpointIdentifier)) {
          this.sampledEndpointResponses.set(endpointIdentifier, new Set());
        }
        const sampledCodesForEndpoint =
          this.sampledEndpointResponses.get(endpointIdentifier)!;

        // Check if we should sample this status code for this endpoint
        if (!sampledCodesForEndpoint.has(res.status)) {
          try {
            body = await res.text();
            sampledCodesForEndpoint.add(res.status);
          } catch (e) {
            // Ignore body read errors, it might be empty.
            body = `(Could not read body: ${(e as Error).message}`;
          }
        } else {
          // We still need to consume the body to not leave the connection hanging
          // and to get a more accurate latency measurement.
          await res.text().catch(() => {});
        }

        const latencyMs = Date.now() - start;
        this.onResult({
          method: req.method || 'GET',
          url: req.url,
          status: res.status,
          latencyMs,
          success: res.ok,
          body, // Will be undefined if not sampled
          timestamp: Date.now(),
        });
      } catch (err) {
        const latencyMs = Date.now() - start;
        this.onResult({
          method: req.method || 'GET',
          url: req.url,
          status: 0,
          latencyMs,
          success: false,
          error: (err as Error).message,
          timestamp: Date.now(),
        });
      }

      // Rate limiting logic
      // If a target RPS is set, calculate the necessary delay to maintain the rate.
      // This distributes the requests evenly over time for all workers.
      if (this.currentTargetRps > 0) {
        const workerCount = this.getWorkerCount();
        if (workerCount > 0) {
          // Calculate the delay needed for each worker to collectively meet the target RPS.
          const delay = (1000 * workerCount) / this.currentTargetRps;
          await sleep(delay);
        } else {
          await sleep(10); // Small delay if no workers are present
        }
      } else {
        // If no RPS is set, yield to the event loop to avoid blocking it completely.
        await sleep(0);
      }
    }
  }
}
