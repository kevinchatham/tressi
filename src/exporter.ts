import chalk from 'chalk';
import { writeFile } from 'fs/promises';
import ora from 'ora';
import * as xlsx from 'xlsx';

import { RequestResult } from './stats';
import { Summary } from './summarizer';

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

async function exportXlsx(
  path: string,
  results: RequestResult[],
  summary: Summary,
): Promise<void> {
  const { global: globalSummary, endpoints: endpointSummary } = summary;
  const wb = xlsx.utils.book_new();

  // Global Summary Sheet
  const globalArray = Object.entries(globalSummary).map(([key, value]) => ({
    Stat: key,
    Value: value,
  }));
  const wsGlobal = xlsx.utils.json_to_sheet(globalArray);
  xlsx.utils.book_append_sheet(wb, wsGlobal, 'Global Summary');

  // Endpoint Summary Sheet
  const wsEndpoints = xlsx.utils.json_to_sheet(endpointSummary);
  xlsx.utils.book_append_sheet(wb, wsEndpoints, 'Endpoint Summary');

  // Raw Requests Sheet
  const wsRaw = xlsx.utils.json_to_sheet(results);
  xlsx.utils.book_append_sheet(wb, wsRaw, 'Raw Requests');

  await xlsx.writeFile(wb, path);
}

/**
 * Exports the results of a load test to multiple data files (CSV and XLSX).
 * @param summary The complete summary object.
 * @param results An array of `RequestResult` objects.
 * @param outputDir The directory to save the files in.
 */
export async function exportDataFiles(
  summary: Summary,
  results: RequestResult[],
  outputDir: string,
): Promise<void> {
  const exportSpinner = ora(`Exporting data files (CSV, XLSX)...`).start();
  try {
    const csvBasePath = `${outputDir}/results.csv`;
    const xlsxPath = `${outputDir}/report.xlsx`;

    const promises = [
      exportRawLog(csvBasePath, results),
      exportXlsx(xlsxPath, results, summary),
    ];

    await Promise.all(promises);

    const successMessage = `Successfully exported raw log`;
    exportSpinner.succeed(successMessage + ' (CSV & XLSX)');
  } catch (err) {
    exportSpinner.fail(
      chalk.red(`Failed to save data files: ${(err as Error).message}`),
    );
  }
}
