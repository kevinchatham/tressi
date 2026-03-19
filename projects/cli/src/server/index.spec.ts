import { serve } from '@hono/node-server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { testStorage } from '../collections/test-collection';
import { TressiServer } from './index';
import { SSEManager } from './utils/sse-manager';

vi.mock('../collections/test-collection');
vi.mock('../tui/terminal');
vi.mock('./utils/sse-manager');
vi.mock('@hono/node-server');

describe('TressiServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default port', () => {
      const server = new TressiServer();
      expect(server).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start the server successfully', async () => {
      const server = new TressiServer(3000);

      vi.mocked(testStorage.stopAllRunningTests).mockResolvedValue(0);

      const mockServer = {
        close: vi.fn(),
        on: vi.fn((event, cb) => {
          if (event === 'listening') {
            setTimeout(cb, 0);
          }
        }),
      };
      vi.mocked(serve).mockReturnValue(mockServer as unknown as ReturnType<typeof serve>);

      await server.start();

      expect(testStorage.stopAllRunningTests).toHaveBeenCalled();
      expect(serve).toHaveBeenCalled();
    });

    it('should handle errors during start', async () => {
      const server = new TressiServer(3000);
      vi.mocked(testStorage.stopAllRunningTests).mockRejectedValue(new Error('DB Error'));

      const mockServer = {
        on: vi.fn((event, cb) => {
          if (event === 'error') {
            setTimeout(() => cb(new Error('Server Error')), 0);
          }
        }),
      };
      vi.mocked(serve).mockReturnValue(mockServer as unknown as ReturnType<typeof serve>);

      await expect(server.start()).rejects.toThrow('Server Error');
    });
  });

  describe('stop', () => {
    it('should stop the server and clean up', async () => {
      const server = new TressiServer(3000);

      const mockServer = {
        close: vi.fn((cb) => cb()),
        on: vi.fn((event, cb) => {
          if (event === 'listening') {
            setTimeout(cb, 0);
          }
        }),
      };
      vi.mocked(serve).mockReturnValue(mockServer as unknown as ReturnType<typeof serve>);

      // Start first to initialize server
      vi.mocked(testStorage.stopAllRunningTests).mockResolvedValue(0);
      await server.start();

      await server.stop();

      expect(mockServer.close).toHaveBeenCalled();
      const sseManager = vi.mocked(SSEManager).mock.instances[0];
      expect(sseManager.forceClose).toHaveBeenCalled();
      expect(sseManager.cleanup).toHaveBeenCalled();
    }, 10000);
  });
});
