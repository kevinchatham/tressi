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
import { LoadTestOptions, Runner } from './runner';
import { average, percentile, RequestResult } from './stats';
import { TUI } from './ui';

export { defineConfig, TressiConfig, RequestConfig };

function printSummary(
  results: RequestResult[],
  latencies: number[],
  statusCodeMap: Record<number, number>,
): void {
  const table = new Table({
    head: ['Stat', 'Value'],
    colWidths: [20, 20],
  });

  const totalRequests = results.length;
  const successCount = results.filter((r) => r.success).length;

  table.push(
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
          endpointTable.push(
            { Endpoint: chalk.cyan(url) },
            { 'Total Requests': total },
            { Successful: chalk.green(successful) },
            { Failed: chalk.red(failed) },
            { 'Avg Latency (ms)': average(endpointLatencies).toFixed(2) },
            {
              'p95 Latency (ms)': percentile(endpointLatencies, 95).toFixed(2),
            },
            {
              'p99 Latency (ms)': percentile(endpointLatencies, 99).toFixed(2),
            },
          );
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

export async function runLoadTest(options: LoadTestOptions): Promise<void> {
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

  const { useUI, csvPath } = options;
  const requests = loadedConfig.requests;
  const headers = loadedConfig.headers || {};

  const runner = new Runner(options, requests, headers);

  let tui: TUI | undefined;
  if (useUI) {
    tui = new TUI(() => {
      runner.aborted = true;
    });
  }

  await runner.run(tui);

  tui?.destroy();

  printSummary(runner.results, runner.latencies, runner.statusCodeMap);

  if (csvPath) {
    await exportToCsv(csvPath, runner.results);
  }
}
