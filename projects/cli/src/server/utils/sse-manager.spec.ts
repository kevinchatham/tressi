import type { ServerEventMessage } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SSEManager } from './sse-manager';

describe('SSEManager', () => {
  let sseManager: SSEManager;
  let mockController: ReadableStreamDefaultController;

  beforeEach(() => {
    sseManager = new SSEManager();
    mockController = {
      close: vi.fn(),
      enqueue: vi.fn(),
    } as unknown as ReadableStreamDefaultController;
    vi.clearAllMocks();
  });

  describe('addClient', () => {
    it('should add a client', () => {
      sseManager.addClient(mockController);
      expect(sseManager.getClientCount()).toBe(1);
    });
  });

  describe('removeClient', () => {
    it('should remove a client', () => {
      sseManager.addClient(mockController);
      sseManager.removeClient(mockController);
      expect(sseManager.getClientCount()).toBe(0);
    });
  });

  describe('broadcast', () => {
    it('should broadcast a message to all clients', () => {
      sseManager.addClient(mockController);
      const message = {
        data: { foo: 'bar' },
        event: 'test',
      } as unknown as ServerEventMessage;
      sseManager.broadcast(message);
      expect(mockController.enqueue).toHaveBeenCalledWith(`data: ${JSON.stringify(message)}\n\n`);
    });

    it('should remove client if enqueue fails', () => {
      const failingController = {
        enqueue: vi.fn().mockImplementation(() => {
          throw new Error('Failed');
        }),
      } as unknown as ReadableStreamDefaultController;
      sseManager.addClient(failingController);
      const message = {
        data: { foo: 'bar' },
        event: 'test',
      } as unknown as ServerEventMessage;
      sseManager.broadcast(message);
      expect(sseManager.getClientCount()).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should close all clients and clear the set', () => {
      sseManager.addClient(mockController);
      sseManager.cleanup();
      expect(mockController.enqueue).toHaveBeenCalledWith(
        'event: close\ndata: Server shutting down\n\n',
      );
      expect(mockController.close).toHaveBeenCalled();
      expect(sseManager.getClientCount()).toBe(0);
    });
  });

  describe('forceClose', () => {
    it('should close all clients and clear the set', () => {
      sseManager.addClient(mockController);
      sseManager.forceClose();
      expect(mockController.close).toHaveBeenCalled();
      expect(sseManager.getClientCount()).toBe(0);
    });
  });
});
