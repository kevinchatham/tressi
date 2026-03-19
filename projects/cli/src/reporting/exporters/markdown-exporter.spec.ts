import { writeFile } from 'node:fs/promises';
import type { TestSummary } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { validateMarkdownPath } from '../utils/validation';
import { MarkdownExporter } from './markdown-exporter';

vi.mock('fs/promises');
vi.mock('../utils/validation');
vi.mock('../utils/status-code-aggregator', () => ({
  aggregateStatusCodesFromEndpoints: vi.fn(() => ({ 200: 1 })),
}));
vi.mock('../../utils/reporting-utils', () => ({
  ReportingUtils: {
    getStatusCodeDistributionByCategory: vi.fn(() => ({ '2xx': 1 })),
  },
}));

describe('MarkdownExporter', () => {
  let exporter: MarkdownExporter;

  beforeEach(() => {
    exporter = new MarkdownExporter();
    vi.clearAllMocks();
  });

  const mockSummary = {
    configSnapshot: {
      requests: [],
    },
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
    tressiVersion: '0.0.1',
  } as unknown as TestSummary;

  it('should return markdown string when no path is provided', async () => {
    const result = await exporter.export(mockSummary);
    expect(typeof result).toBe('string');
    expect(result).toContain('# Tressi Load Test Report');
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('should write to file when path is provided', async () => {
    const path = 'test.md';
    await exporter.export(mockSummary, path);
    expect(validateMarkdownPath).toHaveBeenCalledWith(path);
    expect(writeFile).toHaveBeenCalledWith(path, expect.any(String), 'utf-8');
  });

  it('should throw error if writing fails', async () => {
    const path = 'test.md';
    vi.mocked(writeFile).mockRejectedValue(new Error('Write failed'));
    await expect(exporter.export(mockSummary, path)).rejects.toThrow(
      'Failed to export test summary to Markdown: Write failed',
    );
  });
});
