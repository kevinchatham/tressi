import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FileUtils } from '../../../src/utils/file-utils';

describe('FileUtils', () => {
  const testDir = join(tmpdir(), 'tressi-file-utils-test');
  const testFile = join(testDir, 'test.json');

  beforeEach(() => {
    // Ensure clean test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      writeFileSync(testFile, 'test content');

      const exists = await FileUtils.fileExists(testFile);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const exists = await FileUtils.fileExists('non-existent.json');
      expect(exists).toBe(false);
    });

    it('should return false for directory', async () => {
      const exists = await FileUtils.fileExists(testDir);
      expect(exists).toBe(false);
    });
  });

  describe('readJsonFile', () => {
    it('should read JSON data from file', async () => {
      const data = { name: 'test', value: 123, nested: { key: 'value' } };
      writeFileSync(testFile, JSON.stringify(data));

      const result = await FileUtils.readJsonFile(testFile);

      expect(result).toEqual(data);
    });

    it('should read JSON with type parameter', async () => {
      interface TestData {
        name: string;
        value: number;
      }

      const data: TestData = { name: 'test', value: 123 };
      writeFileSync(testFile, JSON.stringify(data));

      const result = await FileUtils.readJsonFile<TestData>(testFile);

      expect(result).toEqual(data);
      expect(result.name).toBe('test');
      expect(result.value).toBe(123);
    });

    it('should throw error for non-existent file', async () => {
      await expect(
        FileUtils.readJsonFile('non-existent.json'),
      ).rejects.toThrow();
    });

    it('should throw error for invalid JSON', async () => {
      writeFileSync(testFile, 'invalid json content');

      await expect(FileUtils.readJsonFile(testFile)).rejects.toThrow();
    });

    it('should handle null values', async () => {
      writeFileSync(testFile, JSON.stringify(null));

      const result = await FileUtils.readJsonFile(testFile);
      expect(result).toBeNull();
    });

    it('should handle arrays', async () => {
      const data = [1, 2, 3, { nested: true }];
      writeFileSync(testFile, JSON.stringify(data));

      const result = await FileUtils.readJsonFile(testFile);
      expect(result).toEqual(data);
    });
  });

  describe('writeJsonFile', () => {
    it('should write JSON data to file', async () => {
      const data = { name: 'test', value: 123, nested: { key: 'value' } };

      await FileUtils.writeJsonFile(testFile, data);

      expect(existsSync(testFile)).toBe(true);
      const content = readFileSync(testFile, 'utf-8');
      expect(JSON.parse(content)).toEqual(data);
    });

    it('should create directory if it does not exist', async () => {
      const fileInNewDir = join(testDir, 'subdir', 'test.json');
      const data = { test: true };

      expect(existsSync(join(testDir, 'subdir'))).toBe(false);

      await FileUtils.writeJsonFile(fileInNewDir, data);

      expect(existsSync(fileInNewDir)).toBe(true);
      const content = readFileSync(fileInNewDir, 'utf-8');
      expect(JSON.parse(content)).toEqual(data);
    });

    it('should handle empty objects', async () => {
      await FileUtils.writeJsonFile(testFile, {});

      const content = readFileSync(testFile, 'utf-8');
      expect(JSON.parse(content)).toEqual({});
    });

    it('should handle arrays', async () => {
      const data = [1, 2, 3, { nested: true }];

      await FileUtils.writeJsonFile(testFile, data);

      const content = readFileSync(testFile, 'utf-8');
      expect(JSON.parse(content)).toEqual(data);
    });

    it('should use custom indentation', async () => {
      const data = { test: true };

      await FileUtils.writeJsonFile(testFile, data, 4);

      const content = readFileSync(testFile, 'utf-8');
      expect(content).toContain('    "test": true');
    });
  });

  describe('ensureDirectoryExists', () => {
    it('should create directory if it does not exist', async () => {
      const newDir = join(testDir, 'new-directory');

      expect(existsSync(newDir)).toBe(false);

      await FileUtils.ensureDirectoryExists(newDir);

      expect(existsSync(newDir)).toBe(true);
    });

    it('should not fail if directory already exists', async () => {
      expect(existsSync(testDir)).toBe(true);

      await expect(
        FileUtils.ensureDirectoryExists(testDir),
      ).resolves.not.toThrow();
    });

    it('should create nested directories', async () => {
      const nestedDir = join(testDir, 'level1', 'level2', 'level3');

      expect(existsSync(nestedDir)).toBe(false);

      await FileUtils.ensureDirectoryExists(nestedDir);

      expect(existsSync(nestedDir)).toBe(true);
    });
  });

  describe('getAbsolutePath', () => {
    it('should return absolute path for relative path', () => {
      const relativePath = './test.json';
      const absolutePath = FileUtils.getAbsolutePath(relativePath);

      expect(absolutePath).toContain('test.json');
      expect(absolutePath.startsWith('/')).toBe(true);
    });

    it('should return same path for absolute path', () => {
      const absolutePath = '/absolute/path/test.json';
      const result = FileUtils.getAbsolutePath(absolutePath);

      expect(result).toBe(absolutePath);
    });
  });

  describe('getFileExtension', () => {
    it('should return file extension', () => {
      expect(FileUtils.getFileExtension('test.json')).toBe('.json');
      expect(FileUtils.getFileExtension('file.txt')).toBe('.txt');
      expect(FileUtils.getFileExtension('document.pdf')).toBe('.pdf');
    });

    it('should return empty string for no extension', () => {
      expect(FileUtils.getFileExtension('test')).toBe('');
      expect(FileUtils.getFileExtension('file')).toBe('');
    });

    it('should handle multiple dots', () => {
      expect(FileUtils.getFileExtension('file.name.json')).toBe('.json');
      expect(FileUtils.getFileExtension('archive.tar.gz')).toBe('.gz');
    });
  });

  describe('getFileNameWithoutExtension', () => {
    it('should return filename without extension', () => {
      expect(FileUtils.getFileNameWithoutExtension('test.json')).toBe('test');
      expect(FileUtils.getFileNameWithoutExtension('file.txt')).toBe('file');
      expect(FileUtils.getFileNameWithoutExtension('document.pdf')).toBe(
        'document',
      );
    });

    it('should handle files without extension', () => {
      expect(FileUtils.getFileNameWithoutExtension('test')).toBe('test');
      expect(FileUtils.getFileNameWithoutExtension('file')).toBe('file');
    });

    it('should handle multiple dots', () => {
      expect(FileUtils.getFileNameWithoutExtension('file.name.json')).toBe(
        'file.name',
      );
      expect(FileUtils.getFileNameWithoutExtension('archive.tar.gz')).toBe(
        'archive.tar',
      );
    });

    it('should handle full paths', () => {
      expect(FileUtils.getFileNameWithoutExtension('/path/to/file.json')).toBe(
        'file',
      );
      expect(
        FileUtils.getFileNameWithoutExtension('C:\\Windows\\file.txt'),
      ).toBe('C:\\Windows\\file');
    });
  });

  describe('joinPath', () => {
    it('should join path segments', () => {
      const joined = FileUtils.joinPath('path', 'to', 'file.json');
      expect(joined).toContain('path');
      expect(joined).toContain('to');
      expect(joined).toContain('file.json');
    });

    it('should handle absolute paths', () => {
      const joined = FileUtils.joinPath('/absolute', 'path', 'file.json');
      expect(joined.startsWith('/')).toBe(true);
    });

    it('should handle empty segments', () => {
      const joined = FileUtils.joinPath('path', '', 'file.json');
      expect(joined).toContain('path');
      expect(joined).toContain('file.json');
    });
  });

  describe('getDirectoryName', () => {
    it('should return directory name from file path', () => {
      expect(FileUtils.getDirectoryName('/path/to/file.json')).toBe('/path/to');
      expect(FileUtils.getDirectoryName('relative/path/file.txt')).toBe(
        'relative/path',
      );
    });

    it('should handle root directory', () => {
      expect(FileUtils.getDirectoryName('/file.json')).toBe('/');
    });

    it('should handle current directory', () => {
      expect(FileUtils.getDirectoryName('file.json')).toBe('.');
    });
  });

  describe('Integration Tests', () => {
    it('should complete full file lifecycle', async () => {
      const data = { test: true, nested: { value: 123 } };

      // Ensure directory exists
      const subDir = join(testDir, 'subdir');
      await FileUtils.ensureDirectoryExists(subDir);

      const filePath = join(subDir, 'test.json');

      // Write file
      await FileUtils.writeJsonFile(filePath, data);

      // Check file exists
      const exists = await FileUtils.fileExists(filePath);
      expect(exists).toBe(true);

      // Read file
      const readData = await FileUtils.readJsonFile(filePath);
      expect(readData).toEqual(data);

      // Get file extension
      const extension = FileUtils.getFileExtension(filePath);
      expect(extension).toBe('.json');

      // Get filename without extension
      const filename = FileUtils.getFileNameWithoutExtension(filePath);
      expect(filename).toBe('test');
    });

    it('should handle complex nested structures', async () => {
      const complexData = {
        users: [
          { id: 1, name: 'Alice', roles: ['admin', 'user'] },
          { id: 2, name: 'Bob', roles: ['user'] },
        ],
        config: {
          api: {
            baseUrl: 'https://api.example.com',
            timeout: 5000,
          },
        },
      };

      await FileUtils.writeJsonFile(testFile, complexData);
      const readData = await FileUtils.readJsonFile(testFile);

      expect(readData).toEqual(complexData);
    });
  });
});
