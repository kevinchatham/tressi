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
  private activeWorkers: { promise: Promise<void>; stop: () => void }[] = [];
  private testTimeout?: NodeJS.Timeout;
  private rampUpInterval?: NodeJS.Timeout;
  private autoscaleInterval?: NodeJS.Timeout;

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

  public getWorkerCount(): number {
    if (this.options.autoscale) {
      return this.activeWorkers.length;
    }
    return this.options.workers ?? 10;
  }

  public async run(): Promise<RequestResult[]> {
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
          this.currentRpm = Math.round(rps * rampUpProgress);
        } else {
          // If no target RPS, ramp up to a theoretical max (e.g., 1k RPS per worker)
          // This creates a steady increase with no upper bound.
          const arbitraryMaxRps = (this.options.workers || 10) * 1000;
          this.currentRpm = Math.round(arbitraryMaxRps * rampUpProgress);
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
    return this.results;
  }

  public stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.activeWorkers.forEach((w) => w.stop());
    this.cleanup();
    this.emit('stop');
  }

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

  private addWorker(): void {
    let workerStopped = false;
    const stop = (): void => {
      workerStopped = true;
    };
    const promise = this.runWorker(() => workerStopped);
    this.activeWorkers.push({ promise, stop });
  }

  private removeWorker(): void {
    const worker = this.activeWorkers.pop();
    if (worker) {
      worker.stop();
    }
  }

  private async runWorker(
    isStopped: () => boolean = () => this.stopped,
  ): Promise<void> {
    while (!isStopped()) {
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

      const { rps } = this.options;

      // If no RPS is specified, run at max speed but yield to the event loop.
      if (!rps) {
        await sleep(0);
        continue;
      }

      // If RPS is specified, this.currentRpm holds the dynamic target.
      // At the start of a ramp-up, currentRpm can be 0. We must wait for the governor.
      if (this.currentRpm === 0) {
        await sleep(50);
        continue;
      }

      const workerCount = this.getWorkerCount();
      // Note: this.currentRpm is actually the target RPS, the variable is just misnamed.
      const idealDelay = (1000 * workerCount) / this.currentRpm;

      await sleep(idealDelay);
    }
  }
}
