import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import { z } from 'zod';

import {
  defineConfig,
  loadConfig,
  RequestConfig,
  TressiConfig,
} from './config';
import { exportToCsv } from './exporter';
import { Runner } from './runner';
import { average, percentile, RequestResult } from './stats';
import { TUI } from './ui';

export { defineConfig, TressiConfig, RequestConfig };

export interface RunOptions {
  config: string | TressiConfig;
  concurrency?: number;
  durationSec?: number;
  rampUpTimeSec?: number;
  rps?: number;
  csvPath?: string;
  useUI?: boolean;
}

function printSummary(results: RequestResult[], durationSec: number): void {
  const table = new Table({
    head: ['Stat', 'Value'],
    colWidths: [20, 20],
  });

  const totalRequests = results.length;
  const successCount = results.filter((r) => r.success).length;
  const latencies = results.map((r) => r.latencyMs);

  table.push(
    ['Duration', `${durationSec}s`],
    ['Total Requests', totalRequests],
    [chalk.green('Successful'), successCount],
    [chalk.red('Failed'), totalRequests - successCount],
    ['Avg Latency (ms)', average(latencies).toFixed(2)],
    ['Min Latency (ms)', Math.min(...latencies).toFixed(2)],
    ['Max Latency (ms)', Math.max(...latencies).toFixed(2)],
    ['p95 Latency (ms)', percentile(latencies, 95).toFixed(2)],
    ['p99 Latency (ms)', percentile(latencies, 99).toFixed(2)],
  );

  // eslint-disable-next-line no-console
  console.log('\n' + chalk.bold('Global Test Summary'));
  // eslint-disable-next-line no-console
  console.log(table.toString());

  const statusCodeMap: Record<number, number> = results.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {} as Record<number, number>,
  );

  const statusTable = new Table({
    head: ['Status Code', 'Count'],
    colWidths: [20, 20],
  });

  Object.entries(statusCodeMap)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .forEach(([code, count]) => {
      const color = code.startsWith('2')
        ? chalk.green
        : code.startsWith('5')
          ? chalk.red
          : chalk.yellow;
      statusTable.push([color(code), count]);
    });

  // eslint-disable-next-line no-console
  console.log(chalk.bold('\nResponses by Status Code:'));
  // eslint-disable-next-line no-console
  console.log(statusTable.toString());

  if (results.length > 0) {
    const resultsByUrl: Record<string, RequestResult[]> = results.reduce(
      (acc, r) => {
        if (!acc[r.url]) {
          acc[r.url] = [];
        }
        acc[r.url].push(r);
        return acc;
      },
      {} as Record<string, RequestResult[]>,
    );

    if (Object.keys(resultsByUrl).length > 1) {
      // eslint-disable-next-line no-console
      console.log('\n' + chalk.bold('Summary by Endpoint'));
      Object.entries(resultsByUrl)
        .sort(([urlA], [urlB]) => urlA.localeCompare(urlB))
        .forEach(([url, endpointResults]) => {
          const endpointLatencies = endpointResults.map((r) => r.latencyMs);
          const total = endpointResults.length;
          const successful = endpointResults.filter((r) => r.success).length;
          const failed = total - successful;

          const endpointTable = new Table({ colWidths: [30, 60] });
          endpointTable.push({ Endpoint: chalk.cyan(url) });
          endpointTable.push({ 'Total Requests': total });
          endpointTable.push({ Successful: chalk.green(successful) });
          endpointTable.push({ Failed: chalk.red(failed) });
          endpointTable.push({
            'Avg Latency (ms)': average(endpointLatencies).toFixed(2),
          });
          endpointTable.push({
            'p95 Latency (ms)': percentile(endpointLatencies, 95).toFixed(2),
          });
          endpointTable.push({
            'p99 Latency (ms)': percentile(endpointLatencies, 99).toFixed(2),
          });

          // eslint-disable-next-line no-console
          console.log(endpointTable.toString());
        });
    }
  }

  const errors = results.filter((r) => r.error).slice(0, 5);
  if (errors.length > 0) {
    // eslint-disable-next-line no-console
    console.log(chalk.bold.red('\nSampled Errors:'));
    errors.forEach((e) => {
      // eslint-disable-next-line no-console
      console.log(`- ${e.url}: ${e.error}`);
    });
  }
}

export async function runLoadTest(options: RunOptions): Promise<void> {
  const spinner = ora('Loading config...').start();
  let loadedConfig: TressiConfig;
  try {
    loadedConfig = await loadConfig(options.config);
    spinner.succeed(`Loaded ${loadedConfig.requests.length} request targets`);
  } catch (err) {
    if (err instanceof z.ZodError) {
      spinner.fail('Config validation failed:');
      // eslint-disable-next-line no-console
      console.error(JSON.stringify(err.errors, null, 2));
    } else {
      spinner.fail(`Failed to load config: ${(err as Error).message}`);
    }
    throw err;
  }

  const requests = loadedConfig.requests;
  const headers = loadedConfig.headers || {};

  let tui: TUI | undefined;
  // Instantiate TUI first, so we can pass it to the runner
  if (options.useUI) {
    tui = new TUI(() => runner.stop());
  }

  const runner = new Runner(options, requests, headers);

  // If we have a TUI, we need to handle its destruction and polling
  if (tui) {
    const tuiInterval = setInterval(() => {
      const currentResults = runner.getResults();
      const latencies = currentResults.map((r) => r.latencyMs);
      const statusCodes = currentResults.reduce(
        (acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1;
          return acc;
        },
        {} as Record<number, number>,
      );

      const startTime = runner.getStartTime();
      const elapsedSec = startTime > 0 ? (Date.now() - startTime) / 1000 : 0;
      const totalSec = options.durationSec || 10;

      tui.update(
        latencies,
        statusCodes,
        runner.getCurrentRpm(),
        elapsedSec,
        totalSec,
      );
    }, 500);

    runner.on('stop', () => {
      clearInterval(tuiInterval);
      tui?.destroy();
    });
  }

  const results = await runner.run();

  printSummary(results, options.durationSec || 10);

  if (options.csvPath) {
    await exportToCsv(options.csvPath, results);
  }
}
