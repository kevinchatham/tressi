import { writeFile } from 'node:fs/promises';
import type { TestSummary } from '@tressi/shared/common';

import { validateJsonPath } from '../utils/validation';

/**
 * Exports test results and summary data to JSON format
 */
export class JsonExporter {
  /**
   * Exports complete test summary and returns JSON string
   * @param path - undefined (returns JSON string instead of writing to file)
   * @param summary - Test summary data
   */
  async export(summary: TestSummary, path?: string): Promise<undefined | string> {
    try {
      const jsonContent = JSON.stringify(summary, null, 2);

      if (path) {
        validateJsonPath(path);
        await writeFile(path, jsonContent, 'utf-8');
        return; // Returns void when path is provided
      } else {
        return jsonContent; // Returns string when path is undefined
      }
    } catch (error) {
      throw new Error(`Failed to export test summary to JSON: ${(error as Error).message}`);
    }
  }
}
