import { writeFile } from 'node:fs/promises';
import type { TestSummary } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { validateXlsxPath } from '../utils/validation';
import { XlsxExporter } from './xlsx-exporter';

vi.mock('fs/promises');
vi.mock('../utils/validation');
vi.mock('xlsx', () => ({
  utils: {
    book_append_sheet: vi.fn(),
    book_new: vi.fn(() => ({})),
    json_to_sheet: vi.fn(() => ({})),
  },
  write: vi.fn(() => Buffer.from('mock-buffer')),
}));

describe('XlsxExporter', () => {
  let exporter: XlsxExporter;

  beforeEach(() => {
    exporter = new XlsxExporter();
    vi.clearAllMocks();
  });

  const mockSummary = {
    configSnapshot: {},
    endpoints: [],
    global: {
      averageRequestsPerSecond: 1,
      avgProcessMemoryUsageMB: 1,
      avgSystemCpuUsagePercent: 1,
      epochEndedAt: 1700000010000,
      epochStartedAt: 1700000000000,
      errorRate: 0,
      failedRequests: 0,
      finalDurationSec: 10,
      maxLatencyMs: 1,
      minLatencyMs: 1,
      networkBytesPerSec: 10,
      networkBytesReceived: 100,
      networkBytesSent: 100,
      p50LatencyMs: 1,
      p95LatencyMs: 1,
      p99LatencyMs: 1,
      peakRequestsPerSecond: 1,
      successfulRequests: 1,
      targetAchieved: 1,
      totalRequests: 1,
    },
  } as unknown as TestSummary;

  it('should return buffer when no path is provided', async () => {
    const result = await exporter.export(mockSummary);
    expect(result).toBeInstanceOf(Buffer);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('should write to file when path is provided', async () => {
    const path = 'test.xlsx';
    await exporter.export(mockSummary, path);
    expect(validateXlsxPath).toHaveBeenCalledWith(path);
    expect(writeFile).toHaveBeenCalledWith(path, expect.any(Buffer));
  });

  it('should throw error if writing fails', async () => {
    const path = 'test.xlsx';
    vi.mocked(writeFile).mockRejectedValue(new Error('Write failed'));
    await expect(exporter.export(mockSummary, path)).rejects.toThrow(
      'Failed to export test results to Excel: Write failed',
    );
  });
});
