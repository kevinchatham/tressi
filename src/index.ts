import chalk from 'chalk';
import Table from 'cli-table3';
import { promises as fs } from 'fs';
import ora from 'ora';
import { performance } from 'perf_hooks';
import type { ZodError } from 'zod';

import pkg from '../package.json';
import { CoreRunner } from './core/core-runner';
import { DataExporter } from './reporting/exporters/data-exporter';
import { MarkdownGenerator } from './reporting/generators/markdown-generator';
import type { TestSummary, TressiConfig, TressiOptionsConfig } from './types';
import { MinimalUI } from './ui/minimal-ui';
import { TuiManager } from './ui/tui-manager';
import { FileUtils } from './utils/file-utils';
import { getSafeDirectoryName } from './utils/safe-directory';
import {
  ConfigValidator,
  ValidationError,
} from './validation/config-validator';

export { TestSummary, TressiConfig };
export {
  ConfigValidator,
  ValidationError,
} from './validation/config-validator';

/**
 * Prints a detailed summary of the load test results to the console.
 * @param summary The calculated TestSummary object for the run.
 * @param options The original RunOptions used for the test.
 * @param config The Tressi configuration.
 */
function printSummary(
  summary: TestSummary,
  options: TressiOptionsConfig,
  config: TressiConfig,
): void {
  // TODO REENABLE WHEN YOU ARE READY TO WORK ON THIS
  return;
  printReportInfo(summary, options);
  printRunConfiguration(options, config);
  printGlobalSummary(summary);
  printEndpointSummary(summary);
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
function printRunConfiguration(
  options: TressiOptionsConfig,
  config: TressiConfig,
): void {
  const { durationSec = 10, rampUpTimeSec, threads } = options;

  const configTable = new Table({
    head: ['Option', 'Setting'],
    colWidths: [20, 20],
  });
  const totalRps = config.requests.reduce(
    (sum: number, req: { rps?: number }) => sum + (req.rps || 0),
    0,
  );
  configTable.push(['Total RPS', `${totalRps}`]);
  configTable.push(['Duration', `${durationSec}s`]);
  configTable.push(['Workers', `${threads || 'auto'}`]);

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
function printGlobalSummary(summary: TestSummary): void {
  const { global: globalSummary } = summary;

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

  summaryTable.push(
    ['Req/s', Math.ceil(globalSummary.actualRps)],
    ['Req/m', Math.ceil(globalSummary.actualRps * 60)],
  );

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
 * The main function to execute a Tressi load test using the worker-based architecture.
 * It initializes the core components, manages the test execution, and handles reporting.
 * @param config The TressiConfig for the test.
 * @returns A Promise that resolves with the TestSummary object.
 */
export async function runLoadTest(config: TressiConfig): Promise<TestSummary> {
  // Validate configuration
  try {
    ConfigValidator.validateForProgrammatic(config);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(error as ZodError);
  }

  const { silent, useUI, durationSec, exportPath } = config.options;

  // Initialize core runner
  const coreRunner = new CoreRunner(config);

  // If we have a TUI, we need to handle its destruction and polling
  let tuiManager: TuiManager | undefined;
  let tuiInterval: NodeJS.Timeout | undefined;

  if (useUI && !silent) {
    tuiManager = new TuiManager(
      async () => await coreRunner.stop(),
      pkg.version || 'unknown',
    );
    tuiInterval = setInterval(() => {
      const startTime = coreRunner.getStartTime();
      const elapsedSec = Math.min(
        startTime > 0 ? (performance.now() - startTime) / 1000 : 0,
        durationSec || 10,
      );
      const totalSec = durationSec || 10;

      tuiManager!.update(coreRunner as any, elapsedSec, totalSec); // eslint-disable-line @typescript-eslint/no-explicit-any
    }, 500);

    const cleanupUI = (): void => {
      if (tuiInterval) {
        clearInterval(tuiInterval);
        tuiInterval = undefined;
      }
      if (tuiManager) {
        tuiManager.destroy();
        tuiManager = undefined;
      }
    };

    coreRunner.on('stop', cleanupUI);
    coreRunner.on('complete', cleanupUI);
  } else if (!silent) {
    // Use enhanced minimal UI
    const minimalUI = new MinimalUI(config);

    minimalUI.start(coreRunner);

    // Handle graceful shutdown on Ctrl+C
    const handleNoUiExit = async (): Promise<void> => {
      await coreRunner.stop();
    };
    process.on('SIGINT', handleNoUiExit);

    const cleanupUI = (): void => {
      process.removeListener('SIGINT', handleNoUiExit);
      minimalUI.stop();
    };

    coreRunner.on('stop', cleanupUI);
    coreRunner.on('complete', cleanupUI);
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

  // Generate summary from worker results
  const summary = await generateTestSummaryFromWorkers(actualDurationSec);

  if (exportPath && !silent) {
    const exportSpinner = ora({
      text: 'Exporting results...',
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
        createRunnerInterface(summary),
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
        [], // No sampled results in worker mode
        reportDir,
        createRunnerInterface(summary),
      );

      exportSpinner.succeed(`Successfully exported results to ${reportDir}`);
    } catch (err) {
      exportSpinner.fail(
        chalk.red(`Failed to export results: ${(err as Error).message}`),
      );
    }
  } else if (exportPath && silent) {
    // Silent export without spinner
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
        createRunnerInterface(summary),
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
        [], // No sampled results in worker mode
        reportDir,
        createRunnerInterface(summary),
      );
    } catch (err) {
      // In silent mode, we don't output the error to console
      // The error will be handled by the caller
      throw err;
    }
  }

  // Final summary to console
  if (!silent) {
    printSummary(summary, config.options, config);
  }

  return summary;
}

/**
 * Generates a TestSummary from worker results.
 */
async function generateTestSummaryFromWorkers(
  actualDurationSec: number,
): Promise<TestSummary> {
  // In worker mode, we get the summary directly from the worker pool
  // This is a placeholder - the actual implementation would need
  // to integrate with the worker pool's results
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
      duration: actualDurationSec,
    },
    endpoints: [],
    tressiVersion: pkg.version || 'unknown',
  };
}

/**
 * Creates a runner interface for the markdown generator.
 */
function createRunnerInterface(summary: TestSummary): {
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
  getSampledResults(): never[];
} {
  // In worker mode, we create a simplified interface
  return {
    getDistribution: () => ({
      getTotalCount: () => summary.global.totalRequests,
      getLatencyDistribution: () => [],
    }),
    getStatusCodeMap: () => ({}),
    getSampledResults: () => [],
  };
}
