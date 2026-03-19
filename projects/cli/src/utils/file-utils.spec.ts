import { existsSync, promises as fsPromises } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FileUtils } from './file-utils';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  promises: {
    mkdir: vi.fn(),
  },
}));

vi.mock('path', () => ({
  default: {
    resolve: vi.fn((...args) => args.join('/')),
  },
}));

describe('FileUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureDirectoryExists', () => {
    it('should create directory successfully', async () => {
      const mkdirMock = vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
      await FileUtils.ensureDirectoryExists('/test/dir');
      expect(mkdirMock).toHaveBeenCalledWith('/test/dir', { recursive: true });
    });

    it('should ignore EEXIST error', async () => {
      const error = { code: 'EEXIST' } as NodeJS.ErrnoException;
      vi.mocked(fsPromises.mkdir).mockRejectedValue(error);
      await expect(FileUtils.ensureDirectoryExists('/test/dir')).resolves.not.toThrow();
    });

    it('should throw other errors', async () => {
      const error = { code: 'EACCES' } as NodeJS.ErrnoException;
      vi.mocked(fsPromises.mkdir).mockRejectedValue(error);
      await expect(FileUtils.ensureDirectoryExists('/test/dir')).rejects.toThrow();
    });
  });

  describe('getSafeDirectoryName', () => {
    it('should return _unnamed for empty or invalid input', () => {
      expect(FileUtils.getSafeDirectoryName('')).toBe('_unnamed');
      expect(FileUtils.getSafeDirectoryName(null as unknown as string)).toBe('_unnamed');
    });

    it('should sanitize invalid characters', () => {
      expect(FileUtils.getSafeDirectoryName('folder/subfolder:name')).toBe('folder/subfolder_name');
      expect(FileUtils.getSafeDirectoryName('CON')).toBe('_CON');
      expect(FileUtils.getSafeDirectoryName('  spaced folder  ')).toBe('spaced_folder');
    });

    it('should handle long names', () => {
      const longName = 'a'.repeat(250);
      const result = FileUtils.getSafeDirectoryName(longName);
      expect(result.length).toBeLessThanOrEqual(200);
    });
  });

  describe('getWorkerThreadPath', () => {
    it('should return dist path if it exists', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const path = FileUtils.getWorkerThreadPath();
      expect(path).toContain('dist/workers/worker-thread.js');
    });

    it('should return src path if dist does not exist', () => {
      vi.mocked(existsSync).mockImplementation((p: unknown) => (p as string).includes('src'));
      const path = FileUtils.getWorkerThreadPath();
      expect(path).toContain('src/workers/worker-thread.ts');
    });
  });
});
