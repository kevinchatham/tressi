import type { TestSummary, TressiConfig, TressiOptionsConfig } from '@tressi/shared/common';
import chalk from 'chalk';
import Table from 'cli-table3';

import { terminal } from './terminal';

/**
 * Prints a detailed summary of the load test results to the console.
 * @param summary The calculated TestSummary object for the run.
 * @param options The original RunOptions used for the test.
 * @param config The Tressi configuration.
 * @param silent Whether to suppress console output
 */
export function printSummary(
  summary: TestSummary,
  options: TressiOptionsConfig,
  config: TressiConfig,
  silent?: boolean,
): void {
  if (silent) return;

  printReportInfo(summary, options);
  printRunConfiguration(options, config);
  printGlobalSummary(summary);
  printEndpointSummary(summary);
}

/**
 * Prints report information including version and export details.
 */
function printReportInfo(summary: TestSummary, _options: TressiOptionsConfig): void {
  const reportInfoTable = new Table({
    colWidths: [20, 35],
    head: ['Metric', 'Value'],
  });
  reportInfoTable.push(['Version', summary.tressiVersion]);
  terminal.print(`\n${chalk.bold('Report Information')}`);
  terminal.print(reportInfoTable.toString());
}

/**
 * Prints the run configuration including workers, duration, and RPS settings.
 */
function printRunConfiguration(options: TressiOptionsConfig, config: TressiConfig): void {
  const { durationSec = 10, rampUpDurationSec, threads } = options;

  const configTable = new Table({
    colWidths: [20, 20],
    head: ['Option', 'Setting'],
  });
  const totalRps = config.requests.reduce(
    (sum: number, req: { rps?: number }) => sum + (req.rps || 0),
    0,
  );
  configTable.push(
    ['Total RPS', `${totalRps}`],
    ['Duration', `${durationSec}s`],
    ['Workers', `${threads || 'auto'}`],
  );

  if (rampUpDurationSec) {
    configTable.push(['ramp up Time', `${rampUpDurationSec}s`]);
  }

  terminal.print(`\n${chalk.bold('Run Configuration')}`);
  terminal.print(configTable.toString());
}

/**
 * Prints the global test summary including request counts and latency metrics.
 */
function printGlobalSummary(summary: TestSummary): void {
  const { global: globalSummary } = summary;

  const summaryTable = new Table({
    colWidths: [30, 20],
    head: ['Stat', 'Value'],
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

  terminal.print(`\n${chalk.bold('Global Test Summary')}`);
  terminal.print(summaryTable.toString());
}

/**
 * Prints endpoint specific summary data.
 */
function printEndpointSummary(summary: TestSummary): void {
  const { endpoints } = summary;
  if (endpoints.length === 0) return;

  const endpointSummaryTable = new Table({
    colWidths: [50, 10, 10],
    head: ['Endpoint', 'Success', 'Failed'],
  });

  const endpointLatencyTable = new Table({
    colWidths: [50, 10, 10, 10, 10, 10],
    head: ['Endpoint', 'Avg', 'Min', 'Max', 'P95', 'P99'],
  });

  for (const endpoint of endpoints) {
    const url = endpoint.url;
    const maxUrlLength = 48; // Account for table padding
    const displayUrl =
      url.length > maxUrlLength ? `...${url.slice(url.length - (maxUrlLength - 3))}` : url;

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

  terminal.print(`\n${chalk.bold('Endpoint Summary')}`);
  terminal.print(endpointSummaryTable.toString());

  terminal.print(`\n${chalk.bold('Endpoint Latency')}`);
  terminal.print(endpointLatencyTable.toString());
}
