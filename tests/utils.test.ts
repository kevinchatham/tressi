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

    it('should handle null input', () => {
      expect(getSafeDirectoryName(null as unknown as string)).toBe('_unnamed');
    });

    it('should handle undefined input', () => {
      expect(getSafeDirectoryName(undefined as unknown as string)).toBe(
        '_unnamed',
      );
    });

    it('should handle non-string input', () => {
      expect(getSafeDirectoryName(123 as unknown as string)).toBe('_unnamed');
      expect(getSafeDirectoryName({} as unknown as string)).toBe('_unnamed');
      expect(getSafeDirectoryName([] as unknown as string)).toBe('_unnamed');
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

    it('should handle control characters', () => {
      expect(getSafeDirectoryName('file\x00\x01\x02name')).toBe('file_name');
    });

    it('should preserve path separators', () => {
      expect(getSafeDirectoryName('path/to/folder')).toBe('path/to/folder');
      expect(getSafeDirectoryName('path\\to\\folder')).toBe('path\\to\\folder');
    });

    it('should handle mixed path separators and special chars', () => {
      expect(getSafeDirectoryName('path/to/folder:with:colons')).toBe(
        'path/to/folder_with_colons',
      );
    });
  });

  describe('whitespace handling', () => {
    it('should trim leading and trailing spaces', () => {
      expect(getSafeDirectoryName('  spaced folder  ')).toBe('spaced_folder');
    });

    it('should replace multiple spaces with single underscore', () => {
      expect(getSafeDirectoryName('multiple   spaces   here')).toBe(
        'multiple_spaces_here',
      );
    });

    it('should replace tabs and newlines with underscores', () => {
      expect(getSafeDirectoryName('folder\tname\nhere')).toBe(
        'folder_name_here',
      );
    });
  });

  describe('dot handling', () => {
    it('should trim leading and trailing dots', () => {
      expect(getSafeDirectoryName('...folder.name...')).toBe('folder.name');
    });

    it('should handle single dot', () => {
      expect(getSafeDirectoryName('.')).toBe('_unnamed');
    });

    it('should handle multiple dots', () => {
      expect(getSafeDirectoryName('..')).toBe('_unnamed');
    });
  });

  describe('Windows reserved names', () => {
    it('should handle CON reserved name', () => {
      expect(getSafeDirectoryName('CON')).toBe('_CON');
    });

    it('should handle PRN reserved name', () => {
      expect(getSafeDirectoryName('PRN')).toBe('_PRN');
    });

    it('should handle AUX reserved name', () => {
      expect(getSafeDirectoryName('AUX')).toBe('_AUX');
    });

    it('should handle NUL reserved name', () => {
      expect(getSafeDirectoryName('NUL')).toBe('_NUL');
    });

    it('should handle COM1-COM9 reserved names', () => {
      expect(getSafeDirectoryName('COM1')).toBe('_COM1');
      expect(getSafeDirectoryName('COM5')).toBe('_COM5');
      expect(getSafeDirectoryName('COM9')).toBe('_COM9');
    });

    it('should handle LPT1-LPT9 reserved names', () => {
      expect(getSafeDirectoryName('LPT1')).toBe('_LPT1');
      expect(getSafeDirectoryName('LPT5')).toBe('_LPT5');
      expect(getSafeDirectoryName('LPT9')).toBe('_LPT9');
    });

    it('should handle case-insensitive reserved names', () => {
      expect(getSafeDirectoryName('con')).toBe('_con');
      expect(getSafeDirectoryName('CoM1')).toBe('_CoM1');
      expect(getSafeDirectoryName('lPt1')).toBe('_lPt1');
    });

    it('should not modify non-reserved similar names', () => {
      expect(getSafeDirectoryName('CONSOLE')).toBe('CONSOLE');
      expect(getSafeDirectoryName('COMPANY')).toBe('COMPANY');
    });
  });

  describe('length handling', () => {
    it('should truncate names longer than 200 characters', () => {
      const longName = 'a'.repeat(250);
      const result = getSafeDirectoryName(longName);
      expect(result.length).toBe(200);
      expect(result).toBe('a'.repeat(200));
    });

    it('should handle names that become too long after sanitization', () => {
      const longNameWithSpecialChars =
        'a'.repeat(100) + ':' + 'b'.repeat(100) + ':' + 'c'.repeat(100);
      const result = getSafeDirectoryName(longNameWithSpecialChars);
      expect(result.length).toBeLessThanOrEqual(200);
    });
  });

  describe('edge cases', () => {
    it('should handle only special characters', () => {
      expect(getSafeDirectoryName('<>:"|?*')).toBe('_unnamed');
    });

    it('should handle only spaces', () => {
      expect(getSafeDirectoryName('   ')).toBe('_unnamed');
    });

    it('should handle only dots', () => {
      expect(getSafeDirectoryName('...')).toBe('_unnamed');
    });

    it('should handle only underscores', () => {
      expect(getSafeDirectoryName('___')).toBe('_unnamed');
    });

    it('should handle only dashes', () => {
      expect(getSafeDirectoryName('---')).toBe('_unnamed');
    });

    it('should handle Unicode characters', () => {
      expect(getSafeDirectoryName('café')).toBe('caf_');
      expect(getSafeDirectoryName('测试')).toBe('__');
      expect(getSafeDirectoryName('🚀')).toBe('__');
    });

    it('should handle mixed valid and invalid characters', () => {
      expect(getSafeDirectoryName('valid-name_123')).toBe('valid_name_123');
      expect(getSafeDirectoryName('valid:name_123')).toBe('valid_name_123');
    });
  });

  describe('examples from documentation', () => {
    it('should match the actual implementation behavior', () => {
      expect(getSafeDirectoryName('My Project v1.0')).toBe('My_Project_v1.0');
      expect(getSafeDirectoryName('folder/subfolder:name:with:colons')).toBe(
        'folder/subfolder_name_with_colons',
      );
      expect(getSafeDirectoryName('CON')).toBe('_CON');
      expect(getSafeDirectoryName('  spaced folder  ')).toBe('spaced_folder');
      expect(getSafeDirectoryName('path/to/folder:with:colons')).toBe(
        'path/to/folder_with_colons',
      );
    });
  });
});

describe('isValidDirectoryName', () => {
  describe('basic validation', () => {
    it('should return true for valid directory names', () => {
      expect(isValidDirectoryName('valid_name')).toBe(true);
      expect(isValidDirectoryName('folder123')).toBe(true);
      expect(isValidDirectoryName('path/to/folder')).toBe(true);
    });

    it('should return false for invalid directory names', () => {
      expect(isValidDirectoryName('CON')).toBe(false);
      expect(isValidDirectoryName('folder:name')).toBe(false);
      expect(isValidDirectoryName('folder<name')).toBe(false);
      expect(isValidDirectoryName('folder"name')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidDirectoryName('')).toBe(false);
    });

    it('should return false for null input', () => {
      expect(isValidDirectoryName(null as unknown as string)).toBe(false);
    });

    it('should return false for undefined input', () => {
      expect(isValidDirectoryName(undefined as unknown as string)).toBe(false);
    });

    it('should return false for non-string input', () => {
      expect(isValidDirectoryName(123 as unknown as string)).toBe(false);
      expect(isValidDirectoryName({} as unknown as string)).toBe(false);
      expect(isValidDirectoryName([] as unknown as string)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return false for names with leading/trailing spaces', () => {
      expect(isValidDirectoryName(' folder')).toBe(false);
      expect(isValidDirectoryName('folder ')).toBe(false);
      expect(isValidDirectoryName(' folder ')).toBe(false);
    });

    it('should return false for names with leading/trailing dots', () => {
      expect(isValidDirectoryName('.folder')).toBe(false);
      expect(isValidDirectoryName('folder.')).toBe(false);
      expect(isValidDirectoryName('.folder.')).toBe(false);
    });

    it('should return false for names with dashes', () => {
      expect(isValidDirectoryName('my-folder')).toBe(false);
    });

    it('should return false for names with special characters', () => {
      expect(isValidDirectoryName('folder:name')).toBe(false);
      expect(isValidDirectoryName('folder<name')).toBe(false);
      expect(isValidDirectoryName('folder>name')).toBe(false);
      expect(isValidDirectoryName('folder"name')).toBe(false);
      expect(isValidDirectoryName('folder|name')).toBe(false);
      expect(isValidDirectoryName('folder?name')).toBe(false);
      expect(isValidDirectoryName('folder*name')).toBe(false);
    });

    it('should return false for Windows reserved names', () => {
      expect(isValidDirectoryName('CON')).toBe(false);
      expect(isValidDirectoryName('PRN')).toBe(false);
      expect(isValidDirectoryName('AUX')).toBe(false);
      expect(isValidDirectoryName('NUL')).toBe(false);
      expect(isValidDirectoryName('COM1')).toBe(false);
      expect(isValidDirectoryName('LPT1')).toBe(false);
    });

    it('should return false for case-insensitive reserved names', () => {
      expect(isValidDirectoryName('con')).toBe(false);
      expect(isValidDirectoryName('CoM1')).toBe(false);
      expect(isValidDirectoryName('lPt1')).toBe(false);
    });

    it('should return true for similar but non-reserved names', () => {
      expect(isValidDirectoryName('CONSOLE')).toBe(true);
      expect(isValidDirectoryName('COMPANY')).toBe(true);
      expect(isValidDirectoryName('COM10')).toBe(true);
      expect(isValidDirectoryName('LPT10')).toBe(true);
    });

    it('should return false for names with control characters', () => {
      expect(isValidDirectoryName('folder\x00name')).toBe(false);
      expect(isValidDirectoryName('folder\x01name')).toBe(false);
    });

    it('should return false for names that are too long', () => {
      const longName = 'a'.repeat(201);
      expect(isValidDirectoryName(longName)).toBe(false);
    });

    it('should return false for names that become empty after sanitization', () => {
      expect(isValidDirectoryName('   ')).toBe(false);
      expect(isValidDirectoryName('...')).toBe(false);
      expect(isValidDirectoryName('<>:"|?*')).toBe(false);
    });
  });

  describe('consistency with getSafeDirectoryName', () => {
    it('should return true only when name equals its sanitized version', () => {
      const testCases = [
        'valid_name',
        'folder123',
        'path/to/folder',
        'CON',
        'folder:name',
        ' folder ',
        '.folder.',
      ];

      testCases.forEach((name) => {
        const sanitized = getSafeDirectoryName(name);
        const isValid = isValidDirectoryName(name);
        expect(isValid).toBe(name === sanitized);
      });
    });
  });
});
