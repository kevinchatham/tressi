import chalk from 'chalk';
import { writeFile } from 'fs/promises';
import ora from 'ora';

import { RequestResult } from './stats';
import { EndpointSummary, GlobalSummary } from './summarizer';

async function exportRawLog(
  path: string,
  results: RequestResult[],
): Promise<void> {
  const headers = [
    'timestamp',
    'url',
    'status',
    'latencyMs',
    'success',
    'error',
  ];
  const rows = results.map((r) =>
    [
      r.timestamp,
      `"${r.url}"`,
      r.status,
      r.latencyMs.toFixed(2),
      r.success,
      `"${r.error || ''}"`,
    ].join(','),
  );
  const csv = [headers.join(','), ...rows].join('\n');
  await writeFile(path, csv, 'utf-8');
}

async function exportGlobalSummary(
  path: string,
  summary: GlobalSummary,
): Promise<void> {
  const headers = Object.keys(summary);
  const values = Object.values(summary).map((v) =>
    v !== undefined ? v.toString() : '',
  );
  const csv = [headers.join(','), values.join(',')].join('\n');
  await writeFile(path, csv, 'utf-8');
}

async function exportEndpointSummary(
  path: string,
  endpoints: EndpointSummary[],
): Promise<void> {
  if (endpoints.length === 0) return;
  const headers = Object.keys(endpoints[0]);
  const rows = endpoints.map((e) => Object.values(e).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  await writeFile(path, csv, 'utf-8');
}

/**
 * Exports the results of a load test to multiple CSV files.
 * @param basePath The base path for the output files (e.g., 'results.csv').
 * @param results An array of `RequestResult` objects.
 * @param globalSummary The global summary object.
 * @param endpointSummary An array of endpoint summary objects.
 */
export async function exportResults(
  basePath: string,
  results: RequestResult[],
  globalSummary: GlobalSummary,
  endpointSummary: EndpointSummary[],
): Promise<void> {
  const exportSpinner = ora(`Exporting CSVs to ${basePath}...`).start();
  try {
    const summaryPath = basePath.replace('.csv', '.summary.csv');
    const endpointsPath = basePath.replace('.csv', '.endpoints.csv');

    const promises = [
      exportRawLog(basePath, results),
      exportGlobalSummary(summaryPath, globalSummary),
    ];

    if (endpointSummary.length > 0) {
      promises.push(exportEndpointSummary(endpointsPath, endpointSummary));
    }

    await Promise.all(promises);

    let successMessage = `Successfully exported raw log, global summary`;
    if (endpointSummary.length > 0) {
      successMessage += `, and endpoint summary`;
    }
    exportSpinner.succeed(successMessage);
  } catch (err) {
    exportSpinner.fail(
      chalk.red(`Failed to save CSVs: ${(err as Error).message}`),
    );
  }
}
