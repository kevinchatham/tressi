import chalk from 'chalk';
import { writeFile } from 'fs/promises';
import ora from 'ora';

import { RequestResult, TestSummary } from '../../types/reporting/types';
import { CsvExporter } from './csv-exporter';
import { XlsxExporter } from './xlsx-exporter';

interface LatencyDistribution {
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
}

interface RunnerInterface {
  getDistribution(): LatencyDistribution;
  getStatusCodeMap(): Record<number, number>;
  getSampledResults(): RequestResult[];
}

/**
 * Orchestrates the export of test data to multiple formats
 */
export class DataExporter {
  private csvExporter: CsvExporter;
  private xlsxExporter: XlsxExporter;

  constructor() {
    this.csvExporter = new CsvExporter();
    this.xlsxExporter = new XlsxExporter();
  }

  /**
   * Exports test results to multiple data files (CSV and XLSX)
   */
  async exportDataFiles(
    summary: TestSummary,
    results: RequestResult[],
    directory: string,
    runner: RunnerInterface,
  ): Promise<void> {
    const exportSpinner = ora(`Exporting data files (CSV, XLSX)...`).start();
    try {
      const csvBasePath = `${directory}/results.csv`;
      const xlsxPath = `${directory}/report.xlsx`;

      const promises = [
        this.csvExporter.export(csvBasePath, results),
        this.xlsxExporter.export(xlsxPath, results, summary, runner),
      ];

      await Promise.all(promises);

      const successMessage = `Successfully exported raw log`;
      exportSpinner.succeed(successMessage + ' (CSV & XLSX)');
    } catch (err) {
      exportSpinner.fail(
        chalk.red(`Failed to save data files: ${(err as Error).message}`),
      );
      throw err;
    }
  }

  /**
   * Exports only CSV data
   */
  async exportCsv(results: RequestResult[], directory: string): Promise<void> {
    const csvPath = `${directory}/results.csv`;
    await this.csvExporter.export(csvPath, results);
  }

  /**
   * Exports only Excel data
   */
  async exportExcel(
    summary: TestSummary,
    results: RequestResult[],
    directory: string,
    runner: RunnerInterface,
  ): Promise<void> {
    const xlsxPath = `${directory}/report.xlsx`;
    await this.xlsxExporter.export(xlsxPath, results, summary, runner);
  }

  /**
   * Gets available export formats
   */
  getAvailableFormats(): string[] {
    return ['csv', 'xlsx', 'both'];
  }

  /**
   * Validates export directory and creates if necessary
   */
  async validateExportDirectory(directory: string): Promise<void> {
    try {
      await writeFile(`${directory}/.test`, '', 'utf-8');
      // If we can write a test file, the directory is valid
      // Remove the test file
      const { unlink } = await import('fs/promises');
      await unlink(`${directory}/.test`);
    } catch (error) {
      throw new Error(
        `Export directory is not writable: ${directory}. Error: ${(error as Error).message}`,
      );
    }
  }
}
