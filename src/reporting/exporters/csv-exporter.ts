import { writeFile } from 'fs/promises';

import type { RequestResult } from '../../types';

/**
 * Exports request results to CSV format
 */
export class CsvExporter {
  private readonly headers = [
    'timestamp',
    'url',
    'status',
    'latencyMs',
    'success',
    'error',
    'method',
  ];

  /**
   * Exports request results to a CSV file
   */
  async export(path: string, results: RequestResult[]): Promise<void> {
    const csvContent = this.convertToCsv(results);
    await writeFile(path, csvContent, 'utf-8');
  }

  /**
   * Converts request results to CSV format
   */
  private convertToCsv(results: RequestResult[]): string {
    const rows = results.map((result) => this.formatRow(result));
    return [this.headers.join(','), ...rows].join('\n');
  }

  /**
   * Formats a single request result as a CSV row
   */
  private formatRow(result: RequestResult): string {
    const values = [
      result.timestamp,
      this.escapeCsvValue(result.url),
      result.status,
      result.latencyMs.toFixed(0),
      result.success,
      this.escapeCsvValue(result.error || ''),
      result.method,
    ];

    return values.join(',');
  }

  /**
   * Escapes CSV values that contain commas, quotes, or newlines
   */
  private escapeCsvValue(value: string): string {
    // If the value contains commas, quotes, or newlines, wrap it in quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      // Escape any existing quotes by doubling them
      const escapedValue = value.replace(/"/g, '""');
      return `"${escapedValue}"`;
    }
    return value;
  }

  /**
   * Gets the CSV headers
   */
  getHeaders(): string[] {
    return [...this.headers];
  }
}
