import chalk from 'chalk';
import { writeFile } from 'fs/promises';
import ora from 'ora';

import { RequestResult } from './stats';

export async function exportToCsv(path: string, results: RequestResult[]): Promise<void> {
  const writeSpinner = ora(`Writing CSV to ${path}`).start();
  try {
    const headers = ['url', 'status', 'latencyMs', 'success', 'error'];
    const rows = results.map((r) =>
      [
        `"${r.url}"`,
        r.status,
        r.latencyMs.toFixed(2),
        r.success,
        `"${r.error || ''}"`,
      ].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    await writeFile(path, csv, 'utf-8');
    writeSpinner.succeed(`CSV saved to ${path}`);
  } catch (err) {
    writeSpinner.fail(chalk.red(`Failed to save CSV: ${(err as Error).message}`));
  }
} 