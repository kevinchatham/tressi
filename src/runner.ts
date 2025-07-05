import { RequestConfig, TressiConfig } from './config';
import { RequestResult } from './stats';
import { TUI } from './ui';

async function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
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

export class Runner {
  public latencies: number[] = [];
  public results: RequestResult[] = [];
  public statusCodeMap: Record<number, number> = {};
  public aborted = false;

  constructor(
    private options: LoadTestOptions,
    private requests: RequestConfig[],
    private headers: Record<string, string>,
  ) {}

  public async run(tui?: TUI): Promise<void> {
    const { concurrency, durationSec, rpm } = this.options;
    const rateLimitMsPerWorker = rpm
      ? Math.floor((60_000 / rpm) * concurrency!)
      : undefined;

    const updateUI = tui
      ? (): void => {
          tui.updateCharts(this.latencies, this.statusCodeMap);
        }
      : undefined;

    const end = Date.now() + durationSec! * 1000;

    await Promise.all(
      Array.from({ length: concurrency! }, () =>
        this.runWorker(end, rateLimitMsPerWorker, updateUI),
      ),
    );
  }

  private async runWorker(
    endTime: number,
    rateLimitPerWorkerMs?: number,
    uiUpdater?: () => void,
  ): Promise<void> {
    while (Date.now() < endTime && !this.aborted) {
      const req =
        this.requests[Math.floor(Math.random() * this.requests.length)];
      const start = Date.now();

      const res = await fetch(req.url, {
        method: req.method,
        headers: this.headers,
        body: JSON.stringify(req.payload),
      });

      const latency = Date.now() - start;
      const success = res.status >= 200 && res.status < 300;
      this.latencies.push(latency);
      this.statusCodeMap[res.status] =
        (this.statusCodeMap[res.status] || 0) + 1;

      this.results.push({
        url: req.url,
        status: res.status,
        latencyMs: latency,
        success,
      });

      uiUpdater?.();

      if (rateLimitPerWorkerMs) {
        await sleep(rateLimitPerWorkerMs);
      }
    }
  }
}
