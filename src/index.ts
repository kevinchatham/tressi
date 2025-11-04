import chalk from 'chalk';
import Table from 'cli-table3';
import { promises as fs } from 'fs';
import ora from 'ora';
import { performance } from 'perf_hooks';

import pkg from '../package.json';
import { CoreRunner } from './core/runner/core-runner';
import { DataExporter } from './reporting/exporters/data-exporter';
import { MarkdownGenerator } from './reporting/generators/markdown-generator';
import { getStatusCodeDistributionByCategory } from './stats';
import type {
  EndpointSummary,
  RequestResult,
  SafeTressiConfig,
  TestSummary,
  TressiConfig,
  TressiOptionsConfig,
} from './types';
import { TuiManager } from './ui/tui-manager';
import { FileUtils } from './utils/file-utils';
import { getSafeDirectoryName } from './utils/safe-directory';

export { TestSummary, TressiConfig };
export { generateTestSummary };

/**
 * Prints a detailed summary of the load test results to the console.
 * @param runner The CoreRunner instance from the test run.
 * @param options The original RunOptions used for the test.
 * @param summary The calculated TestSummary object for the run.
 */
function printSummary(
  runner: CoreRunner,
  options: TressiOptionsConfig,
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
 * Prints report information including version and export details.
 */
function printReportInfo(
  summary: TestSummary,
  options: TressiOptionsConfig,
): void {
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

/**
 * Prints the run configuration including workers, duration, and RPS settings.
 */
function printRunConfiguration(options: TressiOptionsConfig): void {
  const { workers = 10, durationSec = 10, rps, rampUpTimeSec } = options;

  const configTable = new Table({
    head: ['Option', 'Setting'],
    colWidths: [20, 20],
  });
  configTable.push(['Max Workers', `Up to ${workers}`]);
  configTable.push(['Duration', `${durationSec}s`]);
  configTable.push(['Target Req/s', rps]);

  if (rampUpTimeSec) {
    configTable.push(['Ramp-up Time', `${rampUpTimeSec}s`]);
  }

  // eslint-disable-next-line no-console
  console.log('\n' + chalk.bold('Run Configuration'));
  // eslint-disable-next-line no-console
  console.log(configTable.toString());
}

/**
 * Prints the global test summary including request counts and latency metrics.
 */
function printGlobalSummary(
  summary: TestSummary,
  options: TressiOptionsConfig,
): void {
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

/**
 * Prints endpoint-specific summary data.
 */
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

/**
 * Prints latency distribution data.
 */
function printLatencyDistribution(runner: CoreRunner): void {
  const resultAggregator = runner.getResultAggregator();
  const histogram = resultAggregator.getGlobalHistogram();
  if (histogram.totalCount === 0) return;

  const distribution = resultAggregator.getLatencyDistribution({
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

/**
 * Prints status code distribution data.
 */
function printStatusCodeDistribution(runner: CoreRunner): void {
  const resultAggregator = runner.getResultAggregator();
  const statusCodeMap = resultAggregator.getStatusCodeMap();
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
 * The main function to execute a Tressi load test using the refactored architecture.
 * It initializes the core components, manages the test execution, and handles reporting.
 * @param config The SafeTressiConfig for the test.
 * @returns A Promise that resolves with the TestSummary object.
 */
export async function runLoadTest(
  config: SafeTressiConfig,
): Promise<TestSummary> {
  const { silent, useUI, durationSec, rps, exportPath } = config.options;

  // Initialize core runner
  const coreRunner = new CoreRunner(config);

  // If we have a TUI, we need to handle its destruction and polling
  let tuiManager: TuiManager | undefined;
  let tuiInterval: NodeJS.Timeout | undefined;

  if (useUI && !silent) {
    tuiManager = new TuiManager(
      () => coreRunner.stop(),
      pkg.version || 'unknown',
    );
    tuiInterval = setInterval(() => {
      const startTime = coreRunner.getStartTime();
      const elapsedSec =
        startTime > 0 ? (performance.now() - startTime) / 1000 : 0;
      const totalSec = durationSec || 10;

      tuiManager!.update(coreRunner as any, elapsedSec, totalSec, rps); // eslint-disable-line @typescript-eslint/no-explicit-any
    }, 500);

    coreRunner.on('stop', () => {
      if (tuiInterval) {
        clearInterval(tuiInterval);
        tuiInterval = undefined;
      }
      if (tuiManager) {
        tuiManager.destroy();
        tuiManager = undefined;
      }
    });
  } else {
    // If we're not using the TUI, we should still provide some basic feedback
    const noUiSpinner = ora({
      text: 'Test starting...',
      isEnabled: !silent,
    }).start();

    const noUiInterval = setInterval(() => {
      const startTime = coreRunner.getStartTime();
      const elapsedSec =
        startTime > 0 ? (performance.now() - startTime) / 1000 : 0;
      const totalSec = durationSec || 10;

      const resultAggregator = coreRunner.getResultAggregator();
      const currentRps = 0; // Will be calculated from recent timestamps
      const successful = resultAggregator.getSuccessfulRequestsCount();
      const failed = resultAggregator.getFailedRequestsCount();
      const workers = coreRunner.getWorkerPool().getWorkerCount();

      // For the spinner, we'll use a sample of recent latencies to avoid
      // performance issues with very long test runs.
      const histogram = resultAggregator.getGlobalHistogram();
      const avgLatency = histogram.mean;
      const p95 = histogram.getValueAtPercentile(95);
      const p99 = histogram.getValueAtPercentile(99);

      const rpsDisplay = rps ? `${currentRps}/${rps}` : `${currentRps}`;
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
      coreRunner.stop();
    };
    process.on('SIGINT', handleNoUiExit);

    coreRunner.on('stop', () => {
      clearInterval(noUiInterval);
      process.removeListener('SIGINT', handleNoUiExit);
      noUiSpinner.succeed('Test finished. Generating summary...');
    });
  }

  await coreRunner.run();

  // Ensure TUI is completely destroyed before proceeding with report
  if (useUI && !silent && tuiManager) {
    if (tuiInterval) {
      clearInterval(tuiInterval);
      tuiInterval = undefined;
    }
    tuiManager.destroy();
    tuiManager = undefined;

    // Add a small delay to allow terminal to fully reset
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const startTime = coreRunner.getStartTime();
  const actualDurationSec =
    startTime > 0 ? (performance.now() - startTime) / 1000 : 0;

  // Generate summary using the new architecture
  const resultAggregator = coreRunner.getResultAggregator();
  const summary = generateTestSummary(
    resultAggregator,
    config.options,
    actualDurationSec,
  );

  if (exportPath) {
    const exportSpinner = ora({
      text: 'Exporting results...',
      isEnabled: !silent,
    }).start();

    try {
      const baseExportName =
        typeof exportPath === 'string' ? exportPath : 'tressi-report';
      const runDate = new Date();

      const reportDir = FileUtils.joinPath(
        process.cwd(),
        getSafeDirectoryName(`${baseExportName}-${runDate.toISOString()}`),
      );
      await FileUtils.ensureDirectoryExists(reportDir);

      // Create markdown generator and generate report
      const markdownGenerator = new MarkdownGenerator();
      const markdownReport = markdownGenerator.generate(
        summary,
        createRunnerInterface(resultAggregator),
        config,
        {
          exportName: baseExportName,
          runDate,
        },
      );
      await fs.writeFile(
        FileUtils.joinPath(reportDir, 'report.md'),
        markdownReport,
      );

      const dataExporter = new DataExporter();
      await dataExporter.exportDataFiles(
        summary,
        coreRunner.getResultAggregator().getSampledResults(),
        reportDir,
        coreRunner.getResultAggregator(),
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
    printSummary(coreRunner, config.options, summary);
  }

  return summary;
}

/**
 * Generates a TestSummary from the result aggregator.
 */
function generateTestSummary(
  resultAggregator: {
    getGlobalHistogram(): {
      totalCount: number;
      mean: number;
      minNonZeroValue: number;
      maxValue: number;
      getValueAtPercentile(percentile: number): number;
    };
    getEndpointHistograms(): Map<
      string,
      {
        mean: number;
        minNonZeroValue: number;
        maxValue: number;
        getValueAtPercentile(percentile: number): number;
      }
    >;
    getSuccessfulRequestsCount(): number;
    getFailedRequestsCount(): number;
    getSuccessfulRequestsByEndpoint(): Map<string, number>;
    getFailedRequestsByEndpoint(): Map<string, number>;
  },
  options: TressiOptionsConfig,
  actualDurationSec: number,
): TestSummary {
  const histogram = resultAggregator.getGlobalHistogram();
  const endpointHistograms = resultAggregator.getEndpointHistograms();

  if (histogram.totalCount === 0) {
    return {
      global: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgLatencyMs: 0,
        minLatencyMs: 0,
        maxLatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        actualRps: 0,
        theoreticalMaxRps: 0,
        achievedPercentage: 0,
        duration: 0,
      },
      endpoints: [],
      tressiVersion: pkg.version || 'unknown',
    };
  }

  const { rps } = options;
  const totalRequests = histogram.totalCount;
  const effectiveDuration = actualDurationSec;
  const actualRps =
    effectiveDuration > 0 ? totalRequests / effectiveDuration : 0;
  const avgLatency = histogram.mean;
  const theoreticalMaxRps = rps
    ? Math.min(
        (1000 / (avgLatency || 1)) * (options.workers || 10),
        options.rps || Infinity,
      )
    : 0;
  const achievedPercentage =
    rps && theoreticalMaxRps ? (actualRps / theoreticalMaxRps) * 100 : 0;

  const endpointSummaries = Array.from(endpointHistograms.entries()).map(
    ([endpointKey, endpointHistogram]): EndpointSummary => {
      const [method, url] = endpointKey.split(' ');
      const successfulRequests =
        resultAggregator.getSuccessfulRequestsByEndpoint().get(endpointKey) ||
        0;
      const failedRequests =
        resultAggregator.getFailedRequestsByEndpoint().get(endpointKey) || 0;

      return {
        method,
        url,
        totalRequests: successfulRequests + failedRequests,
        successfulRequests,
        failedRequests,
        avgLatencyMs: endpointHistogram?.mean || 0,
        minLatencyMs: endpointHistogram?.minNonZeroValue || 0,
        maxLatencyMs: endpointHistogram?.maxValue || 0,
        p95LatencyMs: endpointHistogram?.getValueAtPercentile(95) || 0,
        p99LatencyMs: endpointHistogram?.getValueAtPercentile(99) || 0,
      };
    },
  );

  return {
    global: {
      totalRequests,
      successfulRequests: resultAggregator.getSuccessfulRequestsCount(),
      failedRequests: resultAggregator.getFailedRequestsCount(),
      avgLatencyMs: avgLatency,
      minLatencyMs: histogram.minNonZeroValue,
      maxLatencyMs: histogram.maxValue,
      p95LatencyMs: histogram.getValueAtPercentile(95),
      p99LatencyMs: histogram.getValueAtPercentile(99),
      actualRps,
      theoreticalMaxRps,
      achievedPercentage,
      duration: effectiveDuration,
    },
    endpoints: endpointSummaries,
    tressiVersion: pkg.version || 'unknown',
  };
}

/**
 * Creates a runner interface for the markdown generator.
 */
function createRunnerInterface(resultAggregator: {
  getDistribution(): {
    getTotalCount(): number;
    getLatencyDistribution(options: {
      count: number;
      chartWidth: number;
    }): Array<{
      latency: string;
      count: string;
      percent: string;
      cumulative: string;
      chart: string;
    }>;
  };
  getStatusCodeMap(): Record<number, number>;
  getSampledResults(): RequestResult[];
}): {
  getDistribution(): {
    getTotalCount(): number;
    getLatencyDistribution(options: {
      count: number;
      chartWidth: number;
    }): Array<{
      latency: string;
      count: string;
      percent: string;
      cumulative: string;
      chart: string;
    }>;
  };
  getStatusCodeMap(): Record<number, number>;
  getSampledResults(): RequestResult[];
} {
  return {
    getDistribution: () => resultAggregator.getDistribution(),
    getStatusCodeMap: () => resultAggregator.getStatusCodeMap(),
    getSampledResults: () => resultAggregator.getSampledResults(),
  };
}
