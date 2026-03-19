import { promises as fs } from 'node:fs';
import { validateConfig } from '@tressi/shared/common';
import { request } from 'undici';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadConfig } from './config';

vi.mock('@tressi/shared/common', () => ({
  validateConfig: vi.fn(),
}));

vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    constants: { R_OK: 4 },
    readFile: vi.fn(),
  },
}));

vi.mock('undici', () => ({
  request: vi.fn(),
}));

describe('TressiConfigLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load config from object', async () => {
    const mockConfig = {
      name: 'test',
    } as unknown as import('@tressi/shared/common').TressiConfig;
    vi.mocked(validateConfig).mockReturnValue({
      data: mockConfig,
      success: true,
    } as unknown as ReturnType<typeof validateConfig>);

    const result = await loadConfig(mockConfig);
    expect(result.config).toEqual(mockConfig);
    expect(result.path).toBe('[object]');
  });

  it('should throw error if object config is invalid', async () => {
    const mockConfig = {
      name: 'test',
    } as unknown as import('@tressi/shared/common').TressiConfig;
    vi.mocked(validateConfig).mockReturnValue({
      error: { message: 'Invalid' },
      success: false,
    } as unknown as ReturnType<typeof validateConfig>);

    await expect(loadConfig(mockConfig)).rejects.toThrow('Invalid');
  });

  it('should load config from URL', async () => {
    const mockConfig = {
      name: 'test',
    } as unknown as import('@tressi/shared/common').TressiConfig;
    vi.mocked(request).mockResolvedValue({
      body: { json: vi.fn().mockResolvedValue(mockConfig) },
      statusCode: 200,
    } as unknown as Awaited<ReturnType<typeof request>>);
    vi.mocked(validateConfig).mockReturnValue({
      data: mockConfig,
      success: true,
    } as unknown as ReturnType<typeof validateConfig>);

    const result = await loadConfig('https://example.com/config.json');
    expect(result.config).toEqual(mockConfig);
    expect(result.path).toBe('https://example.com/config.json');
  });

  it('should throw error if remote fetch fails', async () => {
    vi.mocked(request).mockResolvedValue({
      statusCode: 404,
    } as unknown as Awaited<ReturnType<typeof request>>);

    await expect(loadConfig('https://example.com/config.json')).rejects.toThrow(
      'Remote config fetch failed',
    );
  });

  it('should load config from file', async () => {
    const mockConfig = {
      name: 'test',
    } as unknown as import('@tressi/shared/common').TressiConfig;
    vi.mocked(fs.access).mockResolvedValue(undefined as never);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig) as never);
    vi.mocked(validateConfig).mockReturnValue({
      data: mockConfig,
      success: true,
    } as unknown as ReturnType<typeof validateConfig>);

    const result = await loadConfig('tressi.config.json');
    expect(result.config).toEqual(mockConfig);
    expect(result.path).toBe('tressi.config.json');
  });

  it('should throw error if file not found', async () => {
    vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));

    await expect(loadConfig('nonexistent.json')).rejects.toThrow('Configuration file not found');
  });
});
