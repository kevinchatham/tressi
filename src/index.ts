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
  /** Whether to use the terminal UI. Defaults to true. */
  useUI?: boolean;
}

function printReportInfo(summary: TestSummary, config: TressiConfig): void {
  const reportInfoTable = new Table({
    head: ['Metric', 'Value'],
    colWidths: [20, 35],
  });
  reportInfoTable.push(['Version', summary.tressiVersion]);
  if (config.export) {
    reportInfoTable.push(['Export Name', config.export]);
    reportInfoTable.push(['Test Time', new Date().toLocaleString()]);
  }
  // eslint-disable-next-line no-console
  console.log('\n' + chalk.bold('Report Information'));
  // eslint-disable-next-line no-console
  console.log(reportInfoTable.toString());
}

function printRunConfiguration(config: TressiConfig): void {
  const { workers = 10, duration = 10, rps, rampUpTime, autoscale } = config;

  const configTable = new Table({
    head: ['Option', 'Setting'],
    colWidths: [20, 15],
  });
  configTable.push(['Workers', autoscale ? `Up to ${workers}` : workers]);
  configTable.push(['Duration', `${duration}s`]);

  if (autoscale) {
    configTable.push(['Autoscale', 'Enabled']);
  }

  if (rps) {
    configTable.push(['Target Req/s', rps]);
  }

  if (rampUpTime) {
    configTable.push(['Ramp-up Time', `${rampUpTime}s`]);
  }

  // eslint-disable-next-line no-console
  console.log('\n' + chalk.bold('Run Configuration'));
  // eslint-disable-next-line no-console
  console.log(configTable.toString());
}

function printGlobalSummary(summary: TestSummary, config: TressiConfig): void {
  const { global: globalSummary } = summary;
  const { rps } = config;

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
 * @param config The original `TressiConfig` used for the test.
 * @param summary The calculated `TestSummary` object for the run.
 */
function printSummary(
  runner: Runner,
  config: TressiConfig,
  summary: TestSummary,
): void {
  printReportInfo(summary, config);
  printRunConfiguration(config);
  printGlobalSummary(summary, config);
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
  const { useUI = true } = options;
  const spinner = ora({
    text: 'Loading config...',
    isEnabled: true,
  }).start();
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

  const runner = new Runner(
    loadedConfig,
    loadedConfig.requests,
    loadedConfig.headers || {},
    useUI,
  );

  // If we have a TUI, we need to handle its destruction and polling
  if (useUI) {
    const tui = new TUI(() => runner.stop(), pkg.version || 'unknown');
    const tuiInterval = setInterval(() => {
      const startTime = runner.getStartTime();
      const elapsedSec =
        startTime > 0 ? (performance.now() - startTime) / 1000 : 0;
      const totalSec = loadedConfig.duration || 10;

      tui.update(runner, elapsedSec, totalSec, loadedConfig.rps);
    }, 500);

    runner.on('stop', () => {
      clearInterval(tuiInterval);
      tui?.destroy();
    });
  } else {
    // If we're not using the TUI, we should still provide some basic feedback
    const noUiSpinner = ora({
      text: 'Test starting...',
      isEnabled: true,
    }).start();
    const noUiInterval = setInterval(() => {
      const startTime = runner.getStartTime();
      const elapsedSec =
        startTime > 0 ? (performance.now() - startTime) / 1000 : 0;
      const totalSec = loadedConfig.duration || 10;

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

      const rpsDisplay = loadedConfig.rps
        ? `${rps}/${loadedConfig.rps}`
        : `${rps}`;
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
  const summary = generateSummary(runner, loadedConfig, actualDurationSec);

  if (loadedConfig.export) {
    const exportSpinner = ora({
      text: 'Exporting results...',
      isEnabled: true,
    }).start();
    try {
      const baseExportName = loadedConfig.export;
      const runDate = new Date();

      const reportDir = path.resolve(
        process.cwd(),
        getSafeDirectoryName(`${baseExportName}-${runDate.toISOString()}`),
      );
      await fs.mkdir(reportDir, { recursive: true });

      const markdownReport = generateMarkdownReport(
        summary,
        loadedConfig,
        runner,
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
  printSummary(runner, loadedConfig, summary);

  return summary;
}
