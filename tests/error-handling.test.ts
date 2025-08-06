import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config';

let mockAgent: MockAgent;

beforeAll(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
});

afterEach(() => {
  mockAgent.assertNoPendingInterceptors();
});

afterAll(() => {
  mockAgent.close();
});

describe('Error Handling Tests', () => {
  describe('File System and Network Errors', () => {
    it('should handle malformed JSON files', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tressi-error-'));
      const configPath = path.join(tempDir, 'malformed.json');

      await fs.writeFile(
        configPath,
        '{ "requests": [ { "url": "http://test.com"',
      );

      await expect(loadConfig(configPath)).rejects.toThrow();

      await fs.unlink(configPath);
      await fs.rmdir(tempDir);
    });

    it('should handle empty JSON files', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tressi-error-'));
      const configPath = path.join(tempDir, 'empty.json');

      await fs.writeFile(configPath, '');

      await expect(loadConfig(configPath)).rejects.toThrow();

      await fs.unlink(configPath);
      await fs.rmdir(tempDir);
    });

    it('should handle non-existent files', async () => {
      const nonExistentPath = path.join(
        os.tmpdir(),
        'non-existent-config.json',
      );
      await expect(loadConfig(nonExistentPath)).rejects.toThrow();
    });

    it('should handle file permission errors', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tressi-error-'));
      const configPath = path.join(tempDir, 'no-permission.json');

      await fs.writeFile(
        configPath,
        '{"requests": [{"url": "http://test.com", "method": "GET"}]}',
      );
      await fs.chmod(configPath, 0o000);

      await expect(loadConfig(configPath)).rejects.toThrow();

      await fs.chmod(configPath, 0o644);
      await fs.unlink(configPath);
      await fs.rmdir(tempDir);
    });

    it('should handle non-existent remote URLs', async () => {
      const mockPool = mockAgent.get('http://nonexistent.com');
      mockPool.intercept({ path: '/config.json', method: 'GET' }).reply(404);

      await expect(
        loadConfig('http://nonexistent.com/config.json'),
      ).rejects.toThrow('Remote config fetch failed: 404');
    });

    it('should handle network errors for remote URLs', async () => {
      const mockPool = mockAgent.get('http://timeout.com');
      mockPool
        .intercept({ path: '/config.json', method: 'GET' })
        .replyWithError(new Error('Network timeout'));

      await expect(
        loadConfig('http://timeout.com/config.json'),
      ).rejects.toThrow();
    });
  });
});
