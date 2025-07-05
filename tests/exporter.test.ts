/// <reference types="vitest/globals" />
import { beforeEach, describe, expect, it, Mock,vi } from 'vitest';

import { exportToCsv } from '../src/exporter';
import { RequestResult } from '../src/stats';

// Mock the fs/promises module
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
}));

// Mock ora
vi.mock('ora', () => {
  const mOra = {
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  };
  return { default: vi.fn(() => mOra) };
});

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    red: vi.fn((str) => str),
  },
}));

const mockResults: RequestResult[] = [
  {
    url: 'http://localhost:8080/test',
    status: 200,
    latencyMs: 123.456,
    success: true,
    timestamp: Date.now(),
  },
  {
    url: 'http://localhost:8080/test2',
    status: 500,
    latencyMs: 456.789,
    success: false,
    error: 'Server Error',
    timestamp: Date.now(),
  },
];

describe('exporter', () => {
  let writeFileMock: Mock;

  beforeEach(async () => {
    // Dynamically import the mocked module to get the mock function
    const fs = await import('fs/promises');
    writeFileMock = fs.writeFile as Mock;
    writeFileMock.mockClear();
  });

  it('should export results to a CSV file', async () => {
    await exportToCsv('results.csv', mockResults);

    expect(writeFileMock).toHaveBeenCalledTimes(1);
    const [path, data] = writeFileMock.mock.calls[0];

    expect(path).toBe('results.csv');
    const rows = (data as string).split('\n');
    expect(rows[0]).toBe('url,status,latencyMs,success,error');
    expect(rows[1]).toBe('"http://localhost:8080/test",200,123.46,true,""');
    expect(rows[2]).toBe('"http://localhost:8080/test2",500,456.79,false,"Server Error"');
  });

  it('should handle an empty results array', async () => {
    await exportToCsv('empty.csv', []);

    expect(writeFileMock).toHaveBeenCalledTimes(1);
    const [path, data] = writeFileMock.mock.calls[0];

    expect(path).toBe('empty.csv');
    const rows = (data as string).split('\n');
    expect(rows.length).toBe(1);
    expect(rows[0]).toBe('url,status,latencyMs,success,error');
  });

  it('should handle errors during file write', async () => {
    const error = new Error('Disk full');
    writeFileMock.mockRejectedValue(error);

    // Suppress console.error for this test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await exportToCsv('error.csv', mockResults);

    expect(writeFileMock).toHaveBeenCalledTimes(1);
    
    consoleErrorSpy.mockRestore();
  });
}); 