import { describe, expect, it } from 'vitest';

import {
  validateJsonPath,
  validateMarkdownPath,
  validateXlsxPath,
} from './validation';

describe('validation', () => {
  describe('validateJsonPath', () => {
    it('should pass for valid .json path', () => {
      expect(() => validateJsonPath('test.json')).not.toThrow();
    });
    it('should throw for invalid extension', () => {
      expect(() => validateJsonPath('test.txt')).toThrow(
        'File path must have .json extension',
      );
    });
  });

  describe('validateXlsxPath', () => {
    it('should pass for valid .xlsx path', () => {
      expect(() => validateXlsxPath('test.xlsx')).not.toThrow();
    });
    it('should throw for invalid extension', () => {
      expect(() => validateXlsxPath('test.json')).toThrow(
        'File path must have .xlsx extension',
      );
    });
  });

  describe('validateMarkdownPath', () => {
    it('should pass for valid .md path', () => {
      expect(() => validateMarkdownPath('test.md')).not.toThrow();
    });
    it('should throw for invalid extension', () => {
      expect(() => validateMarkdownPath('test.json')).toThrow(
        'File path must have .md extension',
      );
    });
  });
});
