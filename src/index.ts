import chalk from 'chalk';
import Table from 'cli-table3';
import { promises as fs } from 'fs';
import ora from 'ora';
import path from 'path';
import { z } from 'zod';

import {
  defineConfig,
  loadConfig,
  RequestConfig,
  TressiConfig,
} from './config';
import { exportDataFiles } from './exporter';
import { Runner } from './runner';
import { average, RequestResult } from './stats';
import { generateMarkdownReport, generateSummary } from './summarizer';
import { TUI } from './ui';

export { defineConfig, TressiConfig, RequestConfig };

/**
 * Defines the options for a Tressi load test run.
 */
export interface RunOptions {
  /** The configuration for the test. Can be a path to a file, a URL, or a configuration object. */
  config: string | TressiConfig;
  /** The number of concurrent workers to use. Defaults to 10. For autoscale, this is the max workers. */
  workers?: number;
  /** The total duration of the test in seconds. Defaults to 10. */
  durationSec?: number;
  /** The time in seconds to ramp up to the target RPS. Defaults to 0. */
  rampUpTimeSec?: number;
  /** The target requests per second. If not provided, the test will run at maximum possible speed. */
  rps?: number;
  /** Whether to enable autoscale mode. Defaults to false. --rps is required for this. */
  autoscale?: boolean;
  /** The base path for the exported report. If not provided, no report will be generated. */
  exportPath?: string | boolean;
  /** Whether to use the terminal UI. Defaults to true. */
  useUI?: boolean;
}

/**
 * Prints a detailed summary of the load test results to the console.
 * @param results An array of `RequestResult` objects from the test run.
 * @param options The original `RunOptions` used for the test.
 */
function printSummary(results: RequestResult[], options: RunOptions): void {
  const {
    workers = 10,
    durationSec = 10,
    rps,
    rampUpTimeSec,
    autoscale,
  } = options;

  const summary = generateSummary(results, options);
  const { global: globalSummary, endpoints: endpointSummaries } = summary;

  const configTable = new Table({ colWidths: [30, 20] });
  configTable.push(
    { Workers: autoscale ? `Up to ${workers}` : workers },
    { Duration: `${durationSec}s` },
  );

  if (autoscale) {
    configTable.push({ Autoscale: 'Enabled' });
  }

  if (rps) {
    configTable.push({ 'Target RPS': rps });
    configTable.push({ 'Target RPM': rps * 60 });
  }

  if (rampUpTimeSec) {
    configTable.push({ 'Ramp-up Time': `${rampUpTimeSec}s` });
  }

  // eslint-disable-next-line no-console
  console.log('\n' + chalk.bold('Run Configuration'));
  // eslint-disable-next-line no-console
  console.log(configTable.toString());

  const table = new Table({
    head: ['Stat', 'Value'],
    colWidths: [30, 20],
  });

  const latencies = results.map((r) => r.latencyMs); // Keep for warning message logic

  if (rps) {
    const avgLatencyMs = average(latencies);
    if (avgLatencyMs > 0) {
      const maxRpsPerWorker = 1000 / avgLatencyMs;
      const maxPossibleRps = maxRpsPerWorker * workers;

      if (rps > maxPossibleRps) {
        const suggestedWorkers = Math.ceil(rps / maxRpsPerWorker);
        let warningMessage: string;

        if (autoscale) {
          warningMessage =
            `\n⚠️  Warning: Target of ${rps} RPS may be unreachable.` +
            `\n   The autoscaler hit the maximum of ${workers} workers.` +
            `\n   With an average latency of ~${Math.ceil(
              avgLatencyMs,
            )}ms, the theoretical max is only ~${Math.floor(
              maxPossibleRps,
            )} RPS.` +
            `\n   To meet the target, try increasing the --workers limit to at least ${suggestedWorkers}.`;
        } else {
          warningMessage =
            `\n⚠️  Warning: Target of ${rps} RPS may be unreachable with ${workers} workers.` +
            `\n   With an average latency of ~${Math.ceil(
              avgLatencyMs,
            )}ms, the theoretical max is only ~${Math.floor(
              maxPossibleRps,
            )} RPS.` +
            `\n   To meet the target, try increasing workers to at least ${suggestedWorkers}.`;
        }
        // eslint-disable-next-line no-console
        console.log(chalk.yellow(warningMessage));
      }
    }
  }

  table.push(
    ['Duration', `${durationSec}s`],
    ['Total Requests', globalSummary.totalRequests],
  );

  if (rps && globalSummary.theoreticalMaxRps) {
    table.push(
      ['RPS (Actual/Target)', `${Math.ceil(globalSummary.actualRps)} / ${rps}`],
      [
        'RPM (Actual/Target)',
        `${Math.ceil(globalSummary.actualRps * 60)} / ${rps * 60}`,
      ],
      ['Theoretical Max Reqs', globalSummary.theoreticalMaxRps],
      ['Achieved %', `${globalSummary.achievedPercentage}%`],
    );
  } else {
    table.push(
      ['RPS', Math.ceil(globalSummary.actualRps)],
      ['RPM', Math.ceil(globalSummary.actualRps * 60)],
    );
  }

  table.push(
    [chalk.green('Successful'), globalSummary.successfulRequests],
    [chalk.red('Failed'), globalSummary.failedRequests],
    ['Avg Latency (ms)', Math.ceil(globalSummary.avgLatencyMs)],
    ['Min Latency (ms)', Math.ceil(globalSummary.minLatencyMs)],
    ['Max Latency (ms)', Math.ceil(globalSummary.maxLatencyMs)],
    ['p95 Latency (ms)', Math.ceil(globalSummary.p95LatencyMs)],
    ['p99 Latency (ms)', Math.ceil(globalSummary.p99LatencyMs)],
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

  if (statusTable.length > 0) {
    // eslint-disable-next-line no-console
    console.log(chalk.bold('\nResponses by Status Code:'));
    // eslint-disable-next-line no-console
    console.log(statusTable.toString());
  }

  if (endpointSummaries.length > 1) {
    // eslint-disable-next-line no-console
    console.log('\n' + chalk.bold('Summary by Endpoint'));
    endpointSummaries.forEach((endpointSummary) => {
      const {
        url,
        totalRequests,
        successfulRequests,
        failedRequests,
        avgLatencyMs,
        p95LatencyMs,
        p99LatencyMs,
      } = endpointSummary;
      const endpointTable = new Table({ colWidths: [30, 60] });
      endpointTable.push({ Endpoint: chalk.cyan(url) });
      endpointTable.push({ 'Total Requests': totalRequests });
      endpointTable.push({ Successful: chalk.green(successfulRequests) });
      endpointTable.push({ Failed: chalk.red(failedRequests) });
      endpointTable.push({
        'Avg Latency (ms)': Math.ceil(avgLatencyMs),
      });
      endpointTable.push({
        'p95 Latency (ms)': Math.ceil(p95LatencyMs),
      });
      endpointTable.push({
        'p99 Latency (ms)': Math.ceil(p99LatencyMs),
      });

      // eslint-disable-next-line no-console
      console.log(endpointTable.toString());
    });
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

/**
 * The main function to execute a Tressi load test.
 * It loads the configuration, initializes the runner, starts the UI,
 * and prints a summary upon completion.
 * @param options The `RunOptions` for the test.
 */
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

  const config = await loadConfig(options.config);

  const runner = new Runner(options, config.requests, config.headers || {});

  // If we have a TUI, we need to handle its destruction and polling
  if (options.useUI) {
    const tui = new TUI(() => runner.stop());
    const tuiInterval = setInterval(() => {
      const latencies = runner.getLatencies();
      const statusCodes = runner.getStatusCodeMap();
      const startTime = runner.getStartTime();
      const elapsedSec = startTime > 0 ? (Date.now() - startTime) / 1000 : 0;
      const totalSec = options.durationSec || 10;

      tui.update(
        latencies,
        statusCodes,
        runner.getCurrentRps(),
        elapsedSec,
        totalSec,
        options.rps,
        runner.getSuccessfulRequestsCount(),
        runner.getFailedRequestsCount(),
        runner.getAverageLatency(),
        runner.getWorkerCount(),
      );
    }, 500);

    runner.on('stop', () => {
      clearInterval(tuiInterval);
      tui?.destroy();
    });
  } else {
    // If we're not using the TUI, we should still provide some basic feedback
    const noUiSpinner = ora('Test starting...').start();
    const noUiInterval = setInterval(() => {
      const startTime = runner.getStartTime();
      const elapsedSec = startTime > 0 ? (Date.now() - startTime) / 1000 : 0;
      const totalSec = options.durationSec || 10;

      const rps = runner.getCurrentRps();
      const successful = runner.getSuccessfulRequestsCount();
      const failed = runner.getFailedRequestsCount();
      const workers = runner.getWorkerCount();
      const avgLatency = runner.getAverageLatency();

      const rpsDisplay = options.rps ? `${rps}/${options.rps}` : `${rps}`;

      noUiSpinner.text = `[${elapsedSec.toFixed(0)}s/${totalSec}s] RPS: ${rpsDisplay} | Workers: ${workers} | Success: ${successful} | Fail: ${failed} | Avg Latency: ${avgLatency.toFixed(0)}ms`;
    }, 1000);

    runner.on('stop', () => {
      clearInterval(noUiInterval);
      noUiSpinner.succeed('Test finished. Generating summary...');
    });
  }

  const results = await runner.run();

  if (options.exportPath) {
    const exportSpinner = ora('Exporting results...').start();
    try {
      const baseExportName =
        typeof options.exportPath === 'string'
          ? options.exportPath
          : 'tressi-report';
      const runDate = new Date();
      const reportDir = path.resolve(
        process.cwd(),
        `${baseExportName}-${runDate.toISOString()}`,
      );
      await fs.mkdir(reportDir, { recursive: true });

      const summary = generateSummary(results, options);
      const markdownReport = generateMarkdownReport(
        summary,
        options,
        results,
        config,
        {
          exportName: baseExportName,
          runDate,
        },
      );
      await fs.writeFile(path.join(reportDir, 'report.md'), markdownReport);

      await exportDataFiles(summary, results, reportDir);

      exportSpinner.succeed(`Successfully exported results to ${reportDir}`);
    } catch (err) {
      exportSpinner.fail(
        chalk.red(`Failed to export results: ${(err as Error).message}`),
      );
    }
  }

  // Final summary to console
  printSummary(results, options);
}
