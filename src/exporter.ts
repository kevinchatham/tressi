import chalk from 'chalk';
import { writeFile } from 'fs/promises';
import ora from 'ora';
import * as xlsx from 'xlsx';

import { RequestResult } from './stats';
import { getStatusCodeDistributionByCategory } from './stats';
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
  runner: Runner,
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

  // Status Code Distribution Sheet
  const statusCodeMap = runner.getStatusCodeMap();
  const statusCodeDistribution =
    getStatusCodeDistributionByCategory(statusCodeMap);
  const formattedStatusCodeDistribution = Object.entries(
    statusCodeDistribution,
  ).map(([category, count]) => ({
    'Status Code Category': category,
    Count: count,
  }));
  const wsStatusCode = xlsx.utils.json_to_sheet(
    formattedStatusCodeDistribution,
  );
  xlsx.utils.book_append_sheet(wb, wsStatusCode, 'Status Code Distribution');

  const sampledResponses = results.filter((r) => r.body);
  if (sampledResponses.length > 0) {
    const uniqueSamples = new Map<string, RequestResult>();
    for (const r of sampledResponses) {
      const key = `${r.method} ${r.url} ${r.status}`;
      if (!uniqueSamples.has(key)) {
        uniqueSamples.set(key, r);
      }
    }

    const samplesForSheet = Array.from(uniqueSamples.values())
      .sort((a, b) => a.status - b.status)
      .map((r) => ({
        Method: r.method,
        URL: r.url,
        'Status Code': r.status,
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
import { Runner } from './runner';

export async function exportDataFiles(
  summary: TestSummary,
  results: RequestResult[],
  directory: string,
  runner: Runner,
): Promise<void> {
  const exportSpinner = ora(`Exporting data files (CSV, XLSX)...`).start();
  try {
    const csvBasePath = `${directory}/results.csv`;
    const xlsxPath = `${directory}/report.xlsx`;

    const promises = [
      exportRawLog(csvBasePath, results),
      exportXlsx(xlsxPath, results, summary, runner),
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
