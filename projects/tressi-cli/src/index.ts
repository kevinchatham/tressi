import chalk from 'chalk';
import Table from 'cli-table3';
import { promises as fs } from 'fs';
import ora from 'ora';
import path from 'path';
import { performance } from 'perf_hooks';
import type {
  SafeTressiConfig,
  SafeTressiOptionsConfig,
  TressiOptionsConfig,
} from 'tressi-common/config';

import pkg from '../../../package.json';
import { Runner } from './core/runner';
import { DataExporter } from './reporting/exporters/data-exporter';
import { MarkdownGenerator } from './reporting/generators/markdown-generator';
import { MinimalTUI } from './tui/minimal-tui';
import { terminal } from './tui/terminal';
import { TestSummary } from './types/reporting/types';
import { FileUtils } from './utils/file-utils';

export { TestSummary };
export type { TressiConfig } from 'tressi-common/config';
export { validateAndMergeConfig } from './core/config';
export { ConfigValidationError, ConfigMergeError } from './types';

/**
 * Prints a detailed summary of the load test results to the console.
 * @param summary The calculated TestSummary object for the run.
 * @param options The original RunOptions used for the test.
 * @param config The Tressi configuration.
 */
function printSummary(
  summary: TestSummary,
  options: SafeTressiOptionsConfig,
  config: SafeTressiConfig,
): void {
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
  terminal.print('\n' + chalk.bold('Report Information'));
  terminal.print(reportInfoTable.toString());
}

/**
 * Prints the run configuration including workers, duration, and RPS settings.
 */
function printRunConfiguration(
  options: TressiOptionsConfig,
  config: SafeTressiConfig,
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

  terminal.print('\n' + chalk.bold('Run Configuration'));
  terminal.print(configTable.toString());
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

  terminal.print('\n' + chalk.bold('Global Test Summary'));
  terminal.print(summaryTable.toString());
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

  terminal.print('\n' + chalk.bold('Endpoint Summary'));
  terminal.print(endpointSummaryTable.toString());

  terminal.print('\n' + chalk.bold('Endpoint Latency'));
  terminal.print(endpointLatencyTable.toString());
}

/**
 * The main function to execute a Tressi load test using the worker-based architecture.
 * It initializes the core components, manages the test execution, and handles reporting.
 * @param config The SafeTressiConfig for the test.
 * @returns A Promise that resolves with the TestSummary object.
 */
export async function runLoadTest(
  config: SafeTressiConfig,
): Promise<TestSummary> {
  const { silent, exportPath } = config.options;

  const runner = new Runner(config);

  const minimalUI = new MinimalTUI(config);

  const cleanup = async (): Promise<void> => {
    await runner.stop();
    process.exit(0); // Ensure clean exit
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  minimalUI.start(runner);

  await runner.run();

  minimalUI.stop();

  // Add this line to clean up resources after normal completion
  await runner.stop();

  const startTime = runner.getStartTime();
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

      const reportDir = path.join(
        process.cwd(),
        FileUtils.getSafeDirectoryName(
          `${baseExportName}-${runDate.toISOString()}`,
        ),
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
      await fs.writeFile(path.join(reportDir, 'report.md'), markdownReport);

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

      const reportDir = path.join(
        process.cwd(),
        FileUtils.getSafeDirectoryName(
          `${baseExportName}-${runDate.toISOString()}`,
        ),
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
      await fs.writeFile(path.join(reportDir, 'report.md'), markdownReport);

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
