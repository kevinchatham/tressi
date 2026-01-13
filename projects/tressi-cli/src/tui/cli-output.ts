import chalk from 'chalk';
import Table from 'cli-table3';

import { TressiConfig, TressiOptionsConfig } from '../common/config/types';
import { TestSummary } from '../reporting/types';
import { terminal } from './terminal';

/**
 * Prints a detailed summary of the load test results to the console.
 * @param summary The calculated TestSummary object for the run.
 * @param options The original RunOptions used for the test.
 * @param config The Tressi configuration.
 */
export function printSummary(
  summary: TestSummary,
  options: TressiOptionsConfig,
  config: TressiConfig,
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
  config: TressiConfig,
): void {
  const { durationSec = 10, threads } = options;

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
    ['Duration', `${globalSummary.finalDurationSec}s`],
    ['Total Requests', globalSummary.totalRequests],
    [chalk.green('Successful'), globalSummary.successfulRequests],
    [chalk.red('Failed'), globalSummary.failedRequests],
  );

  summaryTable.push(
    ['Min Latency', `${globalSummary.minLatencyMs}ms`],
    ['p50 Latency', `${globalSummary.p50LatencyMs}ms`],
    ['p95 Latency', `${globalSummary.p95LatencyMs}ms`],
    ['p99 Latency', `${globalSummary.p99LatencyMs}ms`],
    ['Max Latency', `${globalSummary.maxLatencyMs}ms`],
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
      `${endpoint.p50LatencyMs}ms`,
      `${endpoint.minLatencyMs}ms`,
      `${endpoint.maxLatencyMs}ms`,
      `${endpoint.p95LatencyMs}ms`,
      `${endpoint.p99LatencyMs}ms`,
    ]);
  }

  terminal.print('\n' + chalk.bold('Endpoint Summary'));
  terminal.print(endpointSummaryTable.toString());

  terminal.print('\n' + chalk.bold('Endpoint Latency'));
  terminal.print(endpointLatencyTable.toString());
}
