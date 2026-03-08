import { TestSummary } from '@tressi/shared/common';
import { writeFile } from 'fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { validateJsonPath } from '../utils/validation';
import { JsonExporter } from './json-exporter';

vi.mock('fs/promises');
vi.mock('../utils/validation');

describe('JsonExporter', () => {
  let exporter: JsonExporter;

  beforeEach(() => {
    exporter = new JsonExporter();
    vi.clearAllMocks();
  });

  it('should return JSON string when no path is provided', async () => {
    const summary = { id: 'test' } as unknown as TestSummary;
    const result = await exporter.export(summary);
    expect(result).toBe(JSON.stringify(summary, null, 2));
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('should write to file when path is provided', async () => {
    const summary = { id: 'test' } as unknown as TestSummary;
    const path = 'test.json';
    await exporter.export(summary, path);
    expect(validateJsonPath).toHaveBeenCalledWith(path);
    expect(writeFile).toHaveBeenCalledWith(
      path,
      JSON.stringify(summary, null, 2),
      'utf-8',
    );
  });

  it('should throw error if writing fails', async () => {
    const summary = { id: 'test' } as unknown as TestSummary;
    const path = 'test.json';
    vi.mocked(writeFile).mockRejectedValue(new Error('Write failed'));
    await expect(exporter.export(summary, path)).rejects.toThrow(
      'Failed to export test summary to JSON: Write failed',
    );
  });
});
