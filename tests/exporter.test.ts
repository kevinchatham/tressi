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
    utils: {
      ...actualXlsx.utils,
      book_new: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
      book_append_sheet: vi.fn(),
      json_to_sheet: vi.fn(),
    },
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
    latencyMs: 100.45, // Use a float to test rounding
    success: true,
    body: '{"ok":true}',
  },
];

const mockGlobalSummary: GlobalSummary = {
  totalRequests: 1,
  successfulRequests: 1,
  failedRequests: 0,
  avgLatencyMs: 100.5, // Use a float
  minLatencyMs: 100.5,
  maxLatencyMs: 100.5,
  p95LatencyMs: 100.5,
  p99LatencyMs: 100.5,
  actualRps: 10.8,
  theoreticalMaxRps: 20.2,
  achievedPercentage: 50.9,
  duration: 10.1,
};

const mockEndpointSummary: EndpointSummary[] = [
  {
    url: 'http://a.com',
    totalRequests: 1,
    successfulRequests: 1,
    failedRequests: 0,
    avgLatencyMs: 100.5,
    minLatencyMs: 100.5,
    maxLatencyMs: 100.5,
    p95LatencyMs: 100.5,
    p99LatencyMs: 100.5,
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
  interface GlobalSheetRow {
    Stat: string;
    Value: number | string;
  }

  let writeFileMock: Mock;
  let xlsxWriteFileMock: Mock;
  let jsonToSheetMock: Mock;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockRunner: any;

  beforeEach(async () => {
    // Dynamically import the mocked module to get the mock function
    const fs = await import('fs/promises');
    writeFileMock = fs.writeFile as Mock;
    xlsxWriteFileMock = xlsx.writeFile as Mock;
    jsonToSheetMock = xlsx.utils.json_to_sheet as Mock;
    writeFileMock.mockClear();
    xlsxWriteFileMock.mockClear();

    mockRunner = {
      getStatusCodeMap: vi.fn(() => ({ 200: 3, 500: 1 })),
    };
  });

  /**
   * It should call the respective file writers for all CSV and XLSX files
   * with the correctly formatted data and file paths.
   */
  it('should export all data files and round numbers for reports', async () => {
    await exportDataFiles(
      mockSummary,
      mockResults,
      './test-output',
      mockRunner,
    );

    // Should be called 1 time for the raw CSV
    expect(writeFileMock).toHaveBeenCalledTimes(1);
    // Should be called 1 time for XLSX
    expect(xlsxWriteFileMock).toHaveBeenCalledTimes(1);

    const bookAppendSheetMock = xlsx.utils.book_append_sheet as Mock;
    const sheetNames = bookAppendSheetMock.mock.calls.map((call) => call[2]);
    expect(sheetNames).toContain('Sampled Responses');
    expect(sheetNames).toContain('Status Code Distribution');

    // Check XLSX call
    expect(xlsxWriteFileMock.mock.calls[0][1]).toBe(
      './test-output/report.xlsx',
    );

    // Check raw CSV log file
    const rawCsvCall = writeFileMock.mock.calls.find((c) =>
      c[0].endsWith('results.csv'),
    );
    expect(rawCsvCall).toBeDefined();
    expect(rawCsvCall![1]).toContain(
      'timestamp,url,status,latencyMs,success,error',
    );
    // Check that 100.45 was rounded to 100
    expect(rawCsvCall![1]).toContain('1,"http://a.com",200,100,true,""');

    // Check that data passed to XLSX generator is rounded
    // 1. Global Summary
    const globalSheetData = jsonToSheetMock.mock.calls[0][0];
    expect(
      globalSheetData.find((r: GlobalSheetRow) => r.Stat === 'avgLatencyMs')!
        .Value,
    ).toBe(101); // 100.5 -> 101
    expect(
      globalSheetData.find((r: GlobalSheetRow) => r.Stat === 'actualRps')!
        .Value,
    ).toBe(11); // 10.8 -> 11

    // 2. Endpoint Summary
    const endpointSheetData = jsonToSheetMock.mock.calls[1][0];
    expect(endpointSheetData[0].avgLatencyMs).toBe(101);

    // 3. Raw Results
    const rawSheetData = jsonToSheetMock.mock.calls[2][0];
    expect(rawSheetData[0].latencyMs).toBe(100); // 100.45 -> 100

    // 4. Status Code Distribution
    const statusCodeSheetData = jsonToSheetMock.mock.calls[3][0];
    expect(statusCodeSheetData).toEqual([
      { 'Status Code Category': '2xx', Count: 3 },
      { 'Status Code Category': '3xx', Count: 0 },
      { 'Status Code Category': '4xx', Count: 0 },
      { 'Status Code Category': '5xx', Count: 1 },
      { 'Status Code Category': 'other', Count: 0 },
    ]);
  });
});
