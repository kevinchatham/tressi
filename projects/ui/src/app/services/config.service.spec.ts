import { TestBed } from '@angular/core/testing';
import type { ConfigDocument, SaveConfigRequest } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { ConfigService } from './config.service';
import { RPCService } from './rpc.service';

describe('ConfigService', () => {
  let service: ConfigService;
  let mockRPC: {
    client: {
      config: {
        $get: Mock;
        $post: Mock;
        ':id': {
          $get: Mock;
          $delete: Mock;
        };
      };
    };
  };

  beforeEach(() => {
    const mockConfigClient = {
      ':id': {
        $delete: vi.fn(),
        $get: vi.fn(),
      },
      $get: vi.fn(),
      $post: vi.fn(),
    };

    mockRPC = {
      client: {
        config: mockConfigClient,
      },
    } as unknown as typeof mockRPC;

    TestBed.configureTestingModule({
      providers: [ConfigService, { provide: RPCService, useValue: mockRPC }],
    });

    service = TestBed.inject(ConfigService);
  });

  describe('getAll', () => {
    it('should return all configurations', async () => {
      const mockConfigs: Partial<ConfigDocument>[] = [
        { id: '1', name: 'Config 1' },
        { id: '2', name: 'Config 2' },
      ];

      mockRPC.client.config.$get.mockResolvedValue({
        json: async () => mockConfigs,
        ok: true,
      });

      const result = await service.getAll();

      expect(result).toEqual(mockConfigs);
      expect(mockRPC.client.config.$get).toHaveBeenCalled();
    });

    it('should handle getAll failure', async () => {
      mockRPC.client.config.$get.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
      });

      await expect(service.getAll()).rejects.toThrow();
    });
  });

  describe('getOne', () => {
    it('should return a single configuration by id', async () => {
      const mockConfig: Partial<ConfigDocument> = {
        id: '123',
        name: 'Test Config',
      };

      mockRPC.client.config[':id'].$get.mockResolvedValue({
        json: async () => mockConfig,
        ok: true,
      });

      const result = await service.getOne('123');

      expect(result).toEqual(mockConfig);
      expect(mockRPC.client.config[':id'].$get).toHaveBeenCalledWith({
        param: { id: '123' },
      });
    });

    it('should handle getOne not found', async () => {
      mockRPC.client.config[':id'].$get.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(service.getOne('nonexistent')).rejects.toThrow();
    });
  });

  describe('saveConfig', () => {
    it('should save a configuration and return the saved document', async () => {
      const saveRequest = {
        name: 'New Config',
        requests: [],
      } as unknown as SaveConfigRequest;
      const savedDoc: Partial<ConfigDocument> = {
        id: 'new-id',
        name: 'New Config',
      };

      mockRPC.client.config.$post.mockResolvedValue({
        json: async () => savedDoc,
        ok: true,
      });

      const result = await service.saveConfig(saveRequest);

      expect(result).toEqual(savedDoc);
      expect(mockRPC.client.config.$post).toHaveBeenCalledWith({
        json: saveRequest,
      });
    });

    it('should handle save failure', async () => {
      const saveRequest = {
        name: 'New Config',
        requests: [],
      } as unknown as SaveConfigRequest;

      mockRPC.client.config.$post.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
      });

      await expect(service.saveConfig(saveRequest)).rejects.toThrow();
    });
  });

  describe('deleteConfig', () => {
    it('should delete a configuration by id', async () => {
      mockRPC.client.config[':id'].$delete.mockResolvedValue({
        ok: true,
      });

      await service.deleteConfig('delete-me');

      expect(mockRPC.client.config[':id'].$delete).toHaveBeenCalledWith({
        param: { id: 'delete-me' },
      });
    });

    it('should call delete endpoint even when response is not ok', async () => {
      mockRPC.client.config[':id'].$delete.mockResolvedValue({
        ok: false,
        statusText: 'Conflict',
      });

      await service.deleteConfig('delete-me');

      expect(mockRPC.client.config[':id'].$delete).toHaveBeenCalledWith({
        param: { id: 'delete-me' },
      });
    });
  });
});
