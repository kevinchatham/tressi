import { EventEmitter } from 'events';
import { RequestConfig, TressiConfig } from './config';
import { RunOptions } from './index';
import { RequestResult } from './stats';
import { TUI } from './ui';

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface LoadTestOptions {
  config: string | TressiConfig;
  headersPath?: string;
  concurrency?: number;
  durationSec?: number;
  rpm?: number;
  csvPath?: string;
  useUI?: boolean;
}

export class Runner extends EventEmitter {
  private options: RunOptions;
  private requests: RequestConfig[];
  private headers: Record<string, string>;
  private results: RequestResult[] = [];
  private tui?: TUI;
  private stopped = false;
  private startTime: number = 0;
  private currentRpm: number;

  constructor(
    options: RunOptions,
    requests: RequestConfig[],
    headers: Record<string, string>,
    tui?: TUI,
  ) {
    super();
    this.options = options;
    this.requests = requests;
    this.headers = headers;
    this.tui = tui;
    this.currentRpm =
      options.rampUpTimeSec && options.rpm ? 0 : options.rpm || 0;
  }

  public onResult(result: RequestResult): void {
    this.results.push(result);
  }

  public getResults(): RequestResult[] {
    return this.results;
  }

  public async run(): Promise<RequestResult[]> {
    this.startTime = Date.now();

    const {
      concurrency = 10,
      durationSec = 10,
      rampUpTimeSec = 0,
      rpm = 0,
    } = this.options;

    // The main timer for the total test duration starts now
    const durationMs = durationSec * 1000;
    const testTimeout = setTimeout(() => this.stop(), durationMs);

    // If ramp-up is enabled, start the governor
    if (rampUpTimeSec > 0 && rpm > 0) {
      const rampUpInterval = setInterval(() => {
        const elapsedTimeSec = (Date.now() - this.startTime) / 1000;

        if (this.stopped || elapsedTimeSec >= rampUpTimeSec) {
          this.currentRpm = rpm; // Lock to the final RPM
          clearInterval(rampUpInterval);
        } else {
          // Linearly increase the RPM
          const rampUpProgress = elapsedTimeSec / rampUpTimeSec;
          this.currentRpm = Math.round(rpm * rampUpProgress);
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

        this.onResult({
          url: req.url,
          status: res.status,
          latencyMs: Date.now() - start,
          success: res.ok,
        });
      } catch (err) {
        this.onResult({
          url: req.url,
          status: 0,
          latencyMs: Date.now() - start,
          success: false,
          error: (err as Error).message,
        });
      }

      this.updateTui();

      if (this.currentRpm > 0 && this.options.concurrency) {
        const totalRequestsPerSecond = this.currentRpm / 60;
        const delayPerWorkerMs =
          (this.options.concurrency * 1000) / totalRequestsPerSecond;
        await sleep(delayPerWorkerMs);
      }
    }
  }

  private updateTui(): void {
    if (!this.tui) return;

    const latencies = this.results.map((r) => r.latencyMs);
    const statusCodes = this.results.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>,
    );
    this.tui.updateCharts(latencies, statusCodes);
  }
}
