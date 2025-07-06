import chalk from 'chalk';
import Table from 'cli-table3';
import { promises as fs } from 'fs';
import ora from 'ora';
import path from 'path';
import { z } from 'zod';
import { getLatencyDistribution } from './distribution';

import { loadConfig, RequestConfig, TressiConfig } from './config';
import { exportDataFiles } from './exporter';
import { Runner } from './runner';
import { average, RequestResult } from './stats';
import {
  generateMarkdownReport,
  generateSummary,
  TestSummary,
} from './summarizer';
import { TUI } from './ui';

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
}

/**
 * Prints a detailed summary of the load test results to the console.
 * @param results An array of `RequestResult` objects from the test run.
 * @param options The original `RunOptions` used for the test.
 */
function printSummary(
  results: RequestResult[],
  options: RunOptions,
  summary: TestSummary,
): void {
  const { global: globalSummary, endpoints: endpointSummaries } = summary;
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
            `\n⚠️  Warning: Target of ${rps} Req/s may be unreachable.` +
            `\n   The autoscaler hit the maximum of ${workers} workers.` +
            `\n   With an average latency of ~${Math.ceil(
              avgLatencyMs,
            )}ms, the theoretical max is only ~${Math.floor(
              maxPossibleRps,
            )} Req/s.` +
            `\n   To meet the target, try increasing the --workers limit to at least ${suggestedWorkers}.`;
        } else {
          warningMessage =
            `\n⚠️  Warning: Target of ${rps} Req/s may be unreachable with ${workers} workers.` +
            `\n   With an average latency of ~${Math.ceil(
              avgLatencyMs,
            )}ms, the theoretical max is only ~${Math.floor(
              maxPossibleRps,
            )} Req/s.` +
            `\n   To meet the target, try increasing workers to at least ${suggestedWorkers}.`;
        }
        // eslint-disable-next-line no-console
        console.log(chalk.yellow(warningMessage));
      }
    }
  }

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
    ['p95 Latency', `${Math.ceil(globalSummary.p95LatencyMs)}ms`],
    ['p99 Latency', `${Math.ceil(globalSummary.p99LatencyMs)}ms`],
  );

  // eslint-disable-next-line no-console
  console.log('\n' + chalk.bold('Global Test Summary'));
  // eslint-disable-next-line no-console
  console.log(summaryTable.toString());

  const latencyDistribution = getLatencyDistribution(
    results.map((r) => r.latencyMs),
  );

  if (latencyDistribution.length > 0) {
    const distributionTable = new Table({
      head: ['Range (ms)', 'Count', '% Total', 'Cumulative', 'Chart'],
      colWidths: [15, 10, 10, 12, 20],
    });

    latencyDistribution.forEach((bucket) => {
      distributionTable.push([
        bucket.range,
        bucket.count,
        bucket.percent,
        bucket.cumulative,
        bucket.chart,
      ]);
    });

    // eslint-disable-next-line no-console
    console.log(chalk.bold('\nLatency Distribution'));
    // eslint-disable-next-line no-console
    console.log(distributionTable.toString());
  }

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
        'Avg Latency': `${Math.ceil(avgLatencyMs)}ms`,
      });
      endpointTable.push({
        'p95 Latency': `${Math.ceil(p95LatencyMs)}ms`,
      });
      endpointTable.push({
        'p99 Latency': `${Math.ceil(p99LatencyMs)}ms`,
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
    const noUiSpinner = ora({
      text: 'Test starting...',
      isEnabled: !silent,
    }).start();
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

      noUiSpinner.text = `[${elapsedSec.toFixed(0)}s/${totalSec}s] Req/s: ${
        rpsDisplay
      } | Workers: ${workers} | Success: ${successful} | Fail: ${failed} | Avg Latency: ${avgLatency.toFixed(
        0,
      )}ms`;
    }, 1000);

    runner.on('stop', () => {
      clearInterval(noUiInterval);
      noUiSpinner.succeed('Test finished. Generating summary...');
    });
  }

  const results = await runner.run();
  const startTime = runner.getStartTime();
  const actualDurationSec = startTime > 0 ? (Date.now() - startTime) / 1000 : 0;
  const summary = generateSummary(results, options, actualDurationSec);

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
        `${baseExportName}-${runDate.toISOString()}`,
      );
      await fs.mkdir(reportDir, { recursive: true });

      const markdownReport = generateMarkdownReport(
        summary,
        options,
        results,
        loadedConfig,
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
  if (!silent) {
    printSummary(results, options, summary);
  }

  return summary;
}
