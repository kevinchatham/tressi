import { describe, expect, it } from 'vitest';

import { getSafeDirectoryName, isValidDirectoryName } from '../src/utils.js';

describe('getSafeDirectoryName', () => {
  describe('basic functionality', () => {
    it('should return a safe directory name for a simple string', () => {
      expect(getSafeDirectoryName('My Project v1.0')).toBe('My_Project_v1.0');
    });

    it('should handle empty string', () => {
      expect(getSafeDirectoryName('')).toBe('_unnamed');
    });

    it('should handle null and undefined input', () => {
      expect(getSafeDirectoryName(null as unknown as string)).toBe('_unnamed');
      expect(getSafeDirectoryName(undefined as unknown as string)).toBe(
        '_unnamed',
      );
    });
  });

  describe('special characters handling', () => {
    it('should replace colons with underscores', () => {
      expect(getSafeDirectoryName('folder:name:with:colons')).toBe(
        'folder_name_with_colons',
      );
    });

    it('should replace Windows invalid characters with underscores', () => {
      expect(getSafeDirectoryName('file<>:name"|?*')).toBe('file_name_');
    });

    it('should preserve path separators', () => {
      expect(getSafeDirectoryName('path/to/folder')).toBe('path/to/folder');
    });
  });

  describe('Windows reserved names', () => {
    it('should handle reserved names', () => {
      expect(getSafeDirectoryName('CON')).toBe('_CON');
      expect(getSafeDirectoryName('COM1')).toBe('_COM1');
      expect(getSafeDirectoryName('LPT1')).toBe('_LPT1');
    });

    it('should handle case-insensitive reserved names', () => {
      expect(getSafeDirectoryName('con')).toBe('_con');
      expect(getSafeDirectoryName('CoM1')).toBe('_CoM1');
    });
  });

  describe('length handling', () => {
    it('should truncate names longer than 200 characters', () => {
      const longName = 'a'.repeat(250);
      const result = getSafeDirectoryName(longName);
      expect(result.length).toBe(200);
    });
  });

  describe('edge cases', () => {
    it('should handle only special characters', () => {
      expect(getSafeDirectoryName('<>:"|?*')).toBe('_unnamed');
    });

    it('should handle Unicode characters', () => {
      expect(getSafeDirectoryName('café')).toBe('caf_');
      expect(getSafeDirectoryName('测试')).toBe('__');
    });
  });
});

describe('isValidDirectoryName', () => {
  it('should return true for valid directory names', () => {
    expect(isValidDirectoryName('valid_name')).toBe(true);
    expect(isValidDirectoryName('folder123')).toBe(true);
    expect(isValidDirectoryName('path/to/folder')).toBe(true);
  });

  it('should return false for invalid directory names', () => {
    expect(isValidDirectoryName('CON')).toBe(false);
    expect(isValidDirectoryName('folder:name')).toBe(false);
    expect(isValidDirectoryName('folder<name')).toBe(false);
    expect(isValidDirectoryName('')).toBe(false);
  });

  it('should return false for Windows reserved names', () => {
    expect(isValidDirectoryName('CON')).toBe(false);
    expect(isValidDirectoryName('COM1')).toBe(false);
    expect(isValidDirectoryName('LPT1')).toBe(false);
  });

  it('should return true for similar but non-reserved names', () => {
    expect(isValidDirectoryName('CONSOLE')).toBe(true);
    expect(isValidDirectoryName('COM10')).toBe(true);
  });
});
