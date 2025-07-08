/// <reference types="vitest/globals" />
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import * as xlsx from 'xlsx';

import { exportDataFiles } from '../src/exporter';
import { RequestResult } from '../src/stats';
import { EndpointSummary, GlobalSummary, TestSummary } from '../src/summarizer';

// Mock file system and external libraries
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
}));
vi.mock('xlsx', async () => {
  const actualXlsx = await vi.importActual('xlsx');
  return {
    ...actualXlsx,
    writeFile: vi.fn(),
  };
});
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
    body: '{"ok":true}',
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
  theoreticalMaxRps: 20,
  achievedPercentage: 50,
  duration: 10,
};

const mockEndpointSummary: EndpointSummary[] = [
  {
    url: 'http://a.com',
    totalRequests: 1,
    successfulRequests: 1,
    failedRequests: 0,
    avgLatencyMs: 100,
    minLatencyMs: 100,
    maxLatencyMs: 100,
    p95LatencyMs: 100,
    p99LatencyMs: 100,
  },
];

const mockSummary: TestSummary = {
  tressiVersion: 'test',
  global: mockGlobalSummary,
  endpoints: mockEndpointSummary,
};

/**
 * Test suite for the multi-file data exporter functionality.
 */
describe('exporter', () => {
  let writeFileMock: Mock;
  let xlsxWriteFileMock: Mock;

  beforeEach(async () => {
    // Dynamically import the mocked module to get the mock function
    const fs = await import('fs/promises');
    writeFileMock = fs.writeFile as Mock;
    xlsxWriteFileMock = xlsx.writeFile as Mock;
    writeFileMock.mockClear();
    xlsxWriteFileMock.mockClear();
  });

  /**
   * It should call the respective file writers for all CSV and XLSX files
   * with the correctly formatted data and file paths.
   */
  it('should export all data files and include sampled responses sheet', async () => {
    await exportDataFiles(mockSummary, mockResults, './test-output');

    // Should be called 1 time for the raw CSV
    expect(writeFileMock).toHaveBeenCalledTimes(1);
    // Should be called 1 time for XLSX
    expect(xlsxWriteFileMock).toHaveBeenCalledTimes(1);

    const workbook = xlsxWriteFileMock.mock.calls[0][0];
    expect(workbook.SheetNames).toContain('Sampled Responses');
    expect(workbook.SheetNames).toHaveLength(4);

    // Check XLSX call
    expect(xlsxWriteFileMock.mock.calls[0][1]).toBe(
      './test-output/report.xlsx',
    );

    // Check raw CSV log file
    const rawCall = writeFileMock.mock.calls.find((c) =>
      c[0].endsWith('results.csv'),
    );
    expect(rawCall).toBeDefined();
    expect(rawCall![1]).toContain(
      'timestamp,url,status,latencyMs,success,error', // Note: body is not in raw CSV for memory reasons
    );
    expect(rawCall![1]).toContain('1,"http://a.com",200,100.00,true,""'); // Note: body is not in raw CSV for memory reasons
  });
});
