import chalk from 'chalk';
import Table from 'cli-table3';
import { promises as fs } from 'fs';
import ora from 'ora';
import path from 'path';
import { performance } from 'perf_hooks';
import { z } from 'zod';

import pkg from '../package.json';
import { loadConfig, RequestConfig, TressiConfig } from './config';
import { exportDataFiles } from './exporter';
import { Runner } from './runner';
import { getStatusCodeDistributionByCategory } from './stats';
import {
  generateMarkdownReport,
  generateSummary,
  TestSummary,
} from './summarizer';
import { TUI } from './ui';
import { getSafeDirectoryName } from './utils';

export { RequestConfig, TestSummary, TressiConfig };

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
  /** Suppress all console output. Defaults to false. */
  silent?: boolean;
  /** Whether to enable early exit on error conditions. Defaults to false. */
  earlyExitOnError?: boolean;
  /** Error rate threshold (0.0-1.0) to trigger early exit. Requires earlyExitOnError=true. */
  errorRateThreshold?: number;
  /** Absolute error count threshold to trigger early exit. Requires earlyExitOnError=true. */
  errorCountThreshold?: number;
  /** Specific HTTP status codes that should trigger early exit. Requires earlyExitOnError=true. */
  errorStatusCodes?: number[];
  /** Number of concurrent requests per worker. Defaults to dynamic calculation based on target RPS. */
  concurrentRequestsPerWorker?: number;
}

function printReportInfo(summary: TestSummary, options: RunOptions): void {
  const reportInfoTable = new Table({
    head: ['Metric', 'Value'],
    colWidths: [20, 35],
  });
  reportInfoTable.push(['Version', summary.tressiVersion]);
  if (options.exportPath) {
    const baseExportName =
      typeof options.exportPath === 'string'
        ? options.exportPath
        : 'tressi-report';
    reportInfoTable.push(['Export Name', baseExportName]);
    reportInfoTable.push(['Test Time', new Date().toLocaleString()]);
  }
  // eslint-disable-next-line no-console
  console.log('\n' + chalk.bold('Report Information'));
  // eslint-disable-next-line no-console
  console.log(reportInfoTable.toString());
}

function printRunConfiguration(options: RunOptions): void {
  const {
    workers = 10,
    durationSec = 10,
    rps,
    rampUpTimeSec,
    autoscale,
  } = options;

  const configTable = new Table({
    head: ['Option', 'Setting', 'Argument'],
    colWidths: [20, 15, 20],
  });
  configTable.push([
    'Workers',
    autoscale ? `Up to ${workers}` : workers,
    '--workers',
  ]);
  configTable.push(['Duration', `${durationSec}s`, '--duration']);

  if (autoscale) {
    configTable.push(['Autoscale', 'Enabled', '--autoscale']);
  }

  if (rps) {
    configTable.push(['Target Req/s', rps, '--rps']);
  }

  if (rampUpTimeSec) {
    configTable.push(['Ramp-up Time', `${rampUpTimeSec}s`, '--ramp-up-time']);
  }

  // eslint-disable-next-line no-console
  console.log('\n' + chalk.bold('Run Configuration'));
  // eslint-disable-next-line no-console
  console.log(configTable.toString());
}

function printGlobalSummary(summary: TestSummary, options: RunOptions): void {
  const { global: globalSummary } = summary;
  const { rps } = options;

  const summaryTable = new Table({
    head: ['Stat', 'Value'],
    colWidths: [30, 20],
  });

  summaryTable.push(
    ['Duration', `${Math.ceil(globalSummary.duration)}s`],
    ['Total Requests', globalSummary.totalRequests],
    [chalk.green('Successful'), globalSummary.successfulRequests],
    [chalk.red('Failed'), globalSummary.failedRequests],
  );

  if (rps && globalSummary.theoreticalMaxRps) {
    summaryTable.push(
      [
        'Req/s (Actual/Target)',
        `${Math.ceil(globalSummary.actualRps)} / ${rps}`,
      ],
      [
        'Req/m (Actual/Target)',
        `${Math.ceil(globalSummary.actualRps * 60)} / ${rps * 60}`,
      ],
      ['Theoretical Max Req/s', globalSummary.theoreticalMaxRps.toFixed(0)],
      ['Achieved %', `${globalSummary.achievedPercentage.toFixed(0)}%`],
    );
  } else {
    summaryTable.push(
      ['Req/s', Math.ceil(globalSummary.actualRps)],
      ['Req/m', Math.ceil(globalSummary.actualRps * 60)],
    );
  }

  summaryTable.push(
    ['Avg Latency', `${Math.ceil(globalSummary.avgLatencyMs)}ms`],
    ['Min Latency', `${Math.ceil(globalSummary.minLatencyMs)}ms`],
    ['Max Latency', `${Math.ceil(globalSummary.maxLatencyMs)}ms`],
    ['p95 Latency', `${Math.ceil(globalSummary.p95LatencyMs)}ms`],
    ['p99 Latency', `${Math.ceil(globalSummary.p99LatencyMs)}ms`],
  );

  // eslint-disable-next-line no-console
  console.log('\n' + chalk.bold('Global Test Summary'));
  // eslint-disable-next-line no-console
  console.log(summaryTable.toString());
}

function printEndpointSummary(summary: TestSummary): void {
  const { endpoints } = summary;
  if (endpoints.length === 0) return;

  const endpointSummaryTable = new Table({
    head: ['Endpoint', 'Success', 'Failed'],
    colWidths: [50, 10, 10],
  });

  const endpointLatencyTable = new Table({
    head: ['Endpoint', 'Avg', 'Min', 'Max', 'P95', 'P99'],
    colWidths: [50, 10, 10, 10, 10, 10],
  });

  for (const endpoint of endpoints) {
    const url = endpoint.url;
    const maxUrlLength = 48; // Account for table padding
    const displayUrl =
      url.length > maxUrlLength
        ? `...${url.slice(url.length - (maxUrlLength - 3))}`
        : url;

    endpointSummaryTable.push([
      displayUrl,
      chalk.green(endpoint.successfulRequests),
      chalk.red(endpoint.failedRequests),
    ]);

    endpointLatencyTable.push([
      displayUrl,
      `${Math.round(endpoint.avgLatencyMs)}ms`,
      `${Math.round(endpoint.minLatencyMs)}ms`,
      `${Math.round(endpoint.maxLatencyMs)}ms`,
      `${Math.round(endpoint.p95LatencyMs)}ms`,
      `${Math.round(endpoint.p99LatencyMs)}ms`,
    ]);
  }

  // eslint-disable-next-line no-console
  console.log('\n' + chalk.bold('Endpoint Summary'));
  // eslint-disable-next-line no-console
  console.log(endpointSummaryTable.toString());

  // eslint-disable-next-line no-console
  console.log('\n' + chalk.bold('Endpoint Latency'));
  // eslint-disable-next-line no-console
  console.log(endpointLatencyTable.toString());
}

function printLatencyDistribution(runner: Runner): void {
  const histogram = runner.getHistogram();
  if (histogram.totalCount === 0) return;

  const distribution = runner.getLatencyDistribution({
    count: 8,
    chartWidth: 20,
  });
  const distributionTable = new Table({
    head: ['Range (ms)', 'Count', '% of Total', 'Cumulative %', 'Chart'],
    colWidths: [15, 10, 15, 15, 25],
  });

  for (const bucket of distribution) {
    if (bucket.count === '0') continue;
    distributionTable.push([
      bucket.latency,
      bucket.count,
      bucket.percent,
      bucket.cumulative,
      chalk.green(bucket.chart),
    ]);
  }

  // eslint-disable-next-line no-console
  console.log('\n' + chalk.bold('Latency Distribution'));
  // eslint-disable-next-line no-console
  console.log(distributionTable.toString());
}

function printStatusCodeDistribution(runner: Runner): void {
  const statusCodeMap = runner.getStatusCodeMap();
  if (Object.keys(statusCodeMap).length === 0) return;

  const distribution = getStatusCodeDistributionByCategory(statusCodeMap);
  const distributionTable = new Table({
    head: ['Status Code', 'Count'],
    colWidths: [15, 10],
  });

  for (const [code, count] of Object.entries(distribution)) {
    distributionTable.push([code, count]);
  }

  // eslint-disable-next-line no-console
  console.log('\n' + chalk.bold('Status Code Distribution'));
  // eslint-disable-next-line no-console
  console.log(distributionTable.toString());
}

/**
 * Prints a detailed summary of the load test results to the console.
 * @param runner The `Runner` instance from the test run.
 * @param options The original `RunOptions` used for the test.
 * @param summary The calculated `TestSummary` object for the run.
 */
function printSummary(
  runner: Runner,
  options: RunOptions,
  summary: TestSummary,
): void {
  printReportInfo(summary, options);
  printRunConfiguration(options);
  printGlobalSummary(summary, options);
  printEndpointSummary(summary);
  printStatusCodeDistribution(runner);
  printLatencyDistribution(runner);
}

/**
 * The main function to execute a Tressi load test.
 * It loads the configuration, initializes the runner, starts the UI,
 * and prints a summary upon completion.
 * @param options The `RunOptions` for the test.
 * @returns A `Promise` that resolves with the `TestSummary` object.
 */
export async function runLoadTest(options: RunOptions): Promise<TestSummary> {
  const { silent = false, useUI = true } = options;
  const spinner = ora({
    text: 'Loading config...',
    isEnabled: !silent,
  }).start();
  let loadedConfig: TressiConfig;
  try {
    loadedConfig = await loadConfig(options.config);
    spinner.succeed(`Loaded ${loadedConfig.requests.length} request targets`);
  } catch (err) {
    if (err instanceof z.ZodError) {
      spinner.fail('Config validation failed:');
      if (!silent) {
        // eslint-disable-next-line no-console
        console.error(JSON.stringify(err.errors, null, 2));
      }
    } else {
      spinner.fail(`Failed to load config: ${(err as Error).message}`);
    }
    throw err;
  }

  const runner = new Runner(
    options,
    loadedConfig.requests,
    loadedConfig.headers || {},
  );

  // If we have a TUI, we need to handle its destruction and polling
  if (useUI && !silent) {
    const tui = new TUI(() => runner.stop(), pkg.version || 'unknown');
    const tuiInterval = setInterval(() => {
      const startTime = runner.getStartTime();
      const elapsedSec =
        startTime > 0 ? (performance.now() - startTime) / 1000 : 0;
      const totalSec = options.durationSec || 10;

      tui.update(runner, elapsedSec, totalSec, options.rps);
    }, 500);

    runner.on('stop', () => {
      clearInterval(tuiInterval);
      tui?.destroy();
    });
  } else {
    // If we're not using the TUI, we should still provide some basic feedback
    const noUiSpinner = ora({
      text: 'Test starting...',
      isEnabled: !silent,
    }).start();
    const noUiInterval = setInterval(() => {
      const startTime = runner.getStartTime();
      const elapsedSec =
        startTime > 0 ? (performance.now() - startTime) / 1000 : 0;
      const totalSec = options.durationSec || 10;

      const rps = runner.getCurrentRps();
      const successful = runner.getSuccessfulRequestsCount();
      const failed = runner.getFailedRequestsCount();
      const workers = runner.getWorkerCount();

      // For the spinner, we'll use a sample of recent latencies to avoid
      // performance issues with very long test runs.
      const histogram = runner.getHistogram();
      const avgLatency = histogram.mean;
      const p95 = histogram.getValueAtPercentile(95);
      const p99 = histogram.getValueAtPercentile(99);

      const rpsDisplay = options.rps ? `${rps}/${options.rps}` : `${rps}`;
      const successDisplay = chalk.green(successful);
      const failDisplay = failed > 0 ? chalk.red(failed) : chalk.gray(0);

      noUiSpinner.text = `[${elapsedSec.toFixed(0)}s/${totalSec}s] RPS: ${
        rpsDisplay
      } | W: ${workers} | OK/Fail: ${successDisplay}/${failDisplay} | Avg: ${avgLatency.toFixed(
        0,
      )}ms | p95: ${p95.toFixed(0)}ms | p99: ${p99.toFixed(0)}ms`;
    }, 1000);

    // Handle graceful shutdown on Ctrl+C
    const handleNoUiExit = (): void => {
      runner.stop();
    };
    process.on('SIGINT', handleNoUiExit);

    runner.on('stop', () => {
      clearInterval(noUiInterval);
      process.removeListener('SIGINT', handleNoUiExit);
      noUiSpinner.succeed('Test finished. Generating summary...');
    });
  }

  await runner.run();
  const startTime = runner.getStartTime();
  const actualDurationSec =
    startTime > 0 ? (performance.now() - startTime) / 1000 : 0;
  const summary = generateSummary(runner, options, actualDurationSec);

  if (options.exportPath) {
    const exportSpinner = ora({
      text: 'Exporting results...',
      isEnabled: !silent,
    }).start();
    try {
      const baseExportName =
        typeof options.exportPath === 'string'
          ? options.exportPath
          : 'tressi-report';
      const runDate = new Date();

      const reportDir = path.resolve(
        process.cwd(),
        getSafeDirectoryName(`${baseExportName}-${runDate.toISOString()}`),
      );
      await fs.mkdir(reportDir, { recursive: true });

      const markdownReport = generateMarkdownReport(
        summary,
        options,
        runner,
        loadedConfig,
        {
          exportName: baseExportName,
          runDate,
        },
      );
      await fs.writeFile(path.join(reportDir, 'report.md'), markdownReport);

      await exportDataFiles(
        summary,
        runner.getSampledResults(),
        reportDir,
        runner,
      );

      exportSpinner.succeed(`Successfully exported results to ${reportDir}`);
    } catch (err) {
      exportSpinner.fail(
        chalk.red(`Failed to export results: ${(err as Error).message}`),
      );
    }
  }

  // Final summary to console
  if (!silent) {
    printSummary(runner, options, summary);
  }

  return summary;
}
