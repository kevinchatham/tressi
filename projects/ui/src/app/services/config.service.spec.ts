import { TestBed } from '@angular/core/testing';
import { ConfigDocument, SaveConfigRequest } from '@tressi/shared/common';
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
      $get: vi.fn(),
      $post: vi.fn(),
      ':id': {
        $get: vi.fn(),
        $delete: vi.fn(),
      },
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
        ok: true,
        json: async () => mockConfigs,
      });

      const result = await service.getAll();

      expect(result).toEqual(mockConfigs);
      expect(mockRPC.client.config.$get).toHaveBeenCalled();
    });
  });

  describe('getOne', () => {
    it('should return a single configuration by id', async () => {
      const mockConfig: Partial<ConfigDocument> = {
        id: '123',
        name: 'Test Config',
      };

      mockRPC.client.config[':id'].$get.mockResolvedValue({
        ok: true,
        json: async () => mockConfig,
      });

      const result = await service.getOne('123');

      expect(result).toEqual(mockConfig);
      expect(mockRPC.client.config[':id'].$get).toHaveBeenCalledWith({
        param: { id: '123' },
      });
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
        ok: true,
        json: async () => savedDoc,
      });

      const result = await service.saveConfig(saveRequest);

      expect(result).toEqual(savedDoc);
      expect(mockRPC.client.config.$post).toHaveBeenCalledWith({
        json: saveRequest,
      });
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
  });
});
