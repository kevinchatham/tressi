/// <reference types="vitest/globals" />
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';

import { exportResults } from '../src/exporter';
import { RequestResult } from '../src/stats';
import { EndpointSummary, GlobalSummary } from '../src/summarizer';

// Mock the fs/promises module
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
}));

// Mock ora and chalk as they are used for spinners and logging
vi.mock('ora', () => {
  const mOra = {
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  };
  return { default: vi.fn(() => mOra) };
});
vi.mock('chalk', () => ({
  default: {
    red: vi.fn((str) => str),
  },
}));

const mockResults: RequestResult[] = [
  {
    timestamp: 1,
    url: 'http://a.com',
    status: 200,
    latencyMs: 100,
    success: true,
  },
];

const mockGlobalSummary: GlobalSummary = {
  totalRequests: 1,
  successfulRequests: 1,
  failedRequests: 0,
  avgLatencyMs: 100,
  minLatencyMs: 100,
  maxLatencyMs: 100,
  p95LatencyMs: 100,
  p99LatencyMs: 100,
  actualRps: 10,
};

const mockEndpointSummary: EndpointSummary[] = [
  {
    url: 'http://a.com',
    totalRequests: 1,
    successfulRequests: 1,
    failedRequests: 0,
    avgLatencyMs: 100,
    p95LatencyMs: 100,
    p99LatencyMs: 100,
  },
];

/**
 * Test suite for the multi-file CSV exporter functionality.
 */
describe('exporter', () => {
  let writeFileMock: Mock;

  beforeEach(async () => {
    // Dynamically import the mocked module to get the mock function
    const fs = await import('fs/promises');
    writeFileMock = fs.writeFile as Mock;
    writeFileMock.mockClear();
  });

  /**
   * It should call fs.writeFile for the raw log, global summary, and endpoint summary
   * with the correctly formatted data and file paths.
   */
  it('should export all three summary files', async () => {
    await exportResults(
      'results.csv',
      mockResults,
      mockGlobalSummary,
      mockEndpointSummary,
    );

    // Should be called 3 times: raw, global, and endpoint
    expect(writeFileMock).toHaveBeenCalledTimes(3);

    // 1. Check raw log file
    const rawCall = writeFileMock.mock.calls.find((c) =>
      c[0].endsWith('results.csv'),
    );
    expect(rawCall).toBeDefined();
    expect(rawCall![1]).toContain(
      'timestamp,url,status,latencyMs,success,error',
    );
    expect(rawCall![1]).toContain('1,"http://a.com",200,100.00,true,""');

    // 2. Check global summary file
    const summaryCall = writeFileMock.mock.calls.find((c) =>
      c[0].endsWith('results.summary.csv'),
    );
    expect(summaryCall).toBeDefined();
    expect(summaryCall![1]).toContain(Object.keys(mockGlobalSummary).join(','));
    expect(summaryCall![1]).toContain(
      Object.values(mockGlobalSummary).join(','),
    );

    // 3. Check endpoint summary file
    const endpointCall = writeFileMock.mock.calls.find((c) =>
      c[0].endsWith('results.endpoints.csv'),
    );
    expect(endpointCall).toBeDefined();
    expect(endpointCall![1]).toContain(
      Object.keys(mockEndpointSummary[0]).join(','),
    );
    expect(endpointCall![1]).toContain(
      Object.values(mockEndpointSummary[0]).join(','),
    );
  });
});
