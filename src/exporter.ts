import chalk from 'chalk';
import { writeFile } from 'fs/promises';
import ora from 'ora';
import * as xlsx from 'xlsx';

import { RequestResult } from './stats';
import { TestSummary } from './summarizer';

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
      r.latencyMs.toFixed(0),
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
  summary: TestSummary,
): Promise<void> {
  const { global: globalSummary, endpoints: endpointSummary } = summary;
  const wb = xlsx.utils.book_new();

  // Global Summary Sheet
  const globalArray = Object.entries(globalSummary).map(([key, value]) => ({
    Stat: key,
    Value: typeof value === 'number' ? Math.round(value) : value,
  }));
  globalArray.unshift({ Stat: 'Tressi Version', Value: summary.tressiVersion });
  const wsGlobal = xlsx.utils.json_to_sheet(globalArray);
  xlsx.utils.book_append_sheet(wb, wsGlobal, 'Global Summary');

  // Endpoint Summary Sheet
  const formattedEndpoints = endpointSummary.map((endpoint) => ({
    ...endpoint,
    avgLatencyMs: Math.round(endpoint.avgLatencyMs),
    minLatencyMs: Math.round(endpoint.minLatencyMs),
    maxLatencyMs: Math.round(endpoint.maxLatencyMs),
    p95LatencyMs: Math.round(endpoint.p95LatencyMs),
    p99LatencyMs: Math.round(endpoint.p99LatencyMs),
  }));
  const wsEndpoints = xlsx.utils.json_to_sheet(formattedEndpoints);
  xlsx.utils.book_append_sheet(wb, wsEndpoints, 'Endpoint Summary');

  // Raw Requests Sheet
  // We round latency and explicitly remove the body from the raw export
  // as it's available in the "Sampled Responses" sheet and can be very large.
  const formattedResults = results.map((result) => ({
    timestamp: result.timestamp,
    url: result.url,
    status: result.status,
    latencyMs: Math.round(result.latencyMs),
    success: result.success,
    error: result.error,
  }));
  const wsRaw = xlsx.utils.json_to_sheet(formattedResults);
  xlsx.utils.book_append_sheet(wb, wsRaw, 'Raw Requests');

  const sampledResponses = results.filter((r) => r.body);
  if (sampledResponses.length > 0) {
    const uniqueSamples = new Map<number, RequestResult>();
    for (const r of sampledResponses) {
      if (!uniqueSamples.has(r.status)) {
        uniqueSamples.set(r.status, r);
      }
    }

    const samplesForSheet = Array.from(uniqueSamples.values())
      .sort((a, b) => a.status - b.status)
      .map((r) => ({
        'Status Code': r.status,
        URL: r.url,
        'Response Body': r.body,
      }));

    if (samplesForSheet.length > 0) {
      const wsSamples = xlsx.utils.json_to_sheet(samplesForSheet);
      xlsx.utils.book_append_sheet(wb, wsSamples, 'Sampled Responses');
    }
  }

  await xlsx.writeFile(wb, path);
}

/**
 * Exports the results of a load test to multiple data files (CSV and XLSX).
 * @param summary The complete summary object.
 * @param results An array of `RequestResult` objects.
 * @param outputDir The directory to save the files in.
 */
export async function exportDataFiles(
  summary: TestSummary,
  results: RequestResult[],
  directory: string,
): Promise<void> {
  const exportSpinner = ora(`Exporting data files (CSV, XLSX)...`).start();
  try {
    const csvBasePath = `${directory}/results.csv`;
    const xlsxPath = `${directory}/report.xlsx`;

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
