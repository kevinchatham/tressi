import type { ConfigDocument } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '../data/database';
import { configStorage } from './config-collection';

vi.mock('../data/database', () => {
  const mockDb = {
    deleteFrom: vi.fn(),
    insertInto: vi.fn(),
    selectFrom: vi.fn(),
    updateTable: vi.fn(),
  };
  return { db: mockDb };
});

describe('ConfigCollection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retrieve all configurations', async () => {
    const mockBuilder = {
      execute: vi.fn().mockResolvedValue([]),
      selectAll: vi.fn().mockReturnThis(),
    };
    vi.mocked(db.selectFrom).mockReturnValue(
      mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
    );

    const configs = await configStorage.getAll();
    expect(configs).toEqual([]);
  });

  it('should create a configuration', async () => {
    const mockBuilder = {
      execute: vi.fn().mockResolvedValue({}),
      values: vi.fn().mockReturnThis(),
    };
    vi.mocked(db.insertInto).mockReturnValue(
      mockBuilder as unknown as ReturnType<typeof db.insertInto>,
    );

    const config = await configStorage.create({
      config: {
        $schema: 'test',
        options: {
          durationSec: 10,
          headers: {},
          rampUpDurationSec: 0,
          threads: 1,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [],
            monitoringWindowSeconds: 1,
          },
          workerMemoryLimit: 1024,
        },
        requests: [],
      } as unknown as ConfigDocument['config'],
      name: 'test',
    });
    expect(config.name).toBe('test');
  });

  it('should delete a configuration', async () => {
    const mockBuilder = {
      executeTakeFirst: vi.fn().mockResolvedValue({
        config: JSON.stringify({
          $schema: 'test',
          options: {
            durationSec: 10,
            headers: {},
            rampUpDurationSec: 0,
            threads: 1,
            workerEarlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [],
              monitoringWindowSeconds: 1,
            },
            workerMemoryLimit: 1024,
          },
          requests: [],
        }),
        epoch_created_at: 123,
        epoch_updated_at: 123,
        id: '1',
        name: 'test',
      }),
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
    };
    vi.mocked(db.selectFrom).mockReturnValue(
      mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
    );

    const deleteBuilder = {
      executeTakeFirst: vi.fn().mockResolvedValue({ numDeletedRows: 1n }),
      where: vi.fn().mockReturnThis(),
    };
    vi.mocked(db.deleteFrom).mockReturnValue(
      deleteBuilder as unknown as ReturnType<typeof db.deleteFrom>,
    );

    const result = await configStorage.delete('1');
    expect(result).toBe(true);
  });

  describe('error handling', () => {
    it('should throw when getAll fails', async () => {
      const mockBuilder = {
        execute: vi.fn().mockRejectedValue(new Error('Database error')),
        selectAll: vi.fn().mockReturnThis(),
      };
      vi.mocked(db.selectFrom).mockReturnValue(
        mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
      );

      await expect(configStorage.getAll()).rejects.toThrow(
        'Failed to retrieve configurations: Database error',
      );
    });

    it('should throw when getById fails', async () => {
      const mockBuilder = {
        executeTakeFirst: vi.fn().mockRejectedValue(new Error('Database error')),
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
      };
      vi.mocked(db.selectFrom).mockReturnValue(
        mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
      );

      await expect(configStorage.getById('1')).rejects.toThrow(
        'Failed to retrieve configuration: Database error',
      );
    });

    it('should throw when create fails', async () => {
      const mockBuilder = {
        execute: vi.fn().mockRejectedValue(new Error('Database error')),
        values: vi.fn().mockReturnThis(),
      };
      vi.mocked(db.insertInto).mockReturnValue(
        mockBuilder as unknown as ReturnType<typeof db.insertInto>,
      );

      await expect(
        configStorage.create({
          config: { $schema: 'test', options: {} as never, requests: [] },
          name: 'test',
        }),
      ).rejects.toThrow('Failed to create configuration: Database error');
    });

    it('should throw when edit fails due to not found', async () => {
      const mockBuilder = {
        executeTakeFirst: vi.fn().mockResolvedValue(undefined),
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
      };
      vi.mocked(db.selectFrom).mockReturnValue(
        mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
      );

      await expect(
        configStorage.edit({
          config: { $schema: 'test', options: {} as never, requests: [] },
          id: 'nonexistent',
          name: 'new-name',
        }),
      ).rejects.toThrow('Configuration with ID nonexistent not found');
    });

    it('should throw when edit fails due to database error', async () => {
      const mockBuilder = {
        executeTakeFirst: vi.fn().mockResolvedValue({
          config: JSON.stringify({ $schema: 'test', options: {} as never, requests: [] }),
          epoch_created_at: 123,
          epoch_updated_at: 123,
          id: '1',
          name: 'test',
        }),
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
      };
      vi.mocked(db.selectFrom).mockReturnValue(
        mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
      );

      const updateBuilder = {
        execute: vi.fn().mockRejectedValue(new Error('Database error')),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
      };
      vi.mocked(db.updateTable).mockReturnValue(
        updateBuilder as unknown as ReturnType<typeof db.updateTable>,
      );

      await expect(
        configStorage.edit({
          config: { $schema: 'test', options: {} as never, requests: [] },
          id: '1',
          name: 'new-name',
        }),
      ).rejects.toThrow('Failed to edit configuration: Database error');
    });

    it('should throw when delete fails', async () => {
      const mockBuilder = {
        executeTakeFirst: vi.fn().mockResolvedValue({
          config: JSON.stringify({ $schema: 'test', options: {} as never, requests: [] }),
          epoch_created_at: 123,
          epoch_updated_at: 123,
          id: '1',
          name: 'test',
        }),
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
      };
      vi.mocked(db.selectFrom).mockReturnValue(
        mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
      );

      const deleteBuilder = {
        executeTakeFirst: vi.fn().mockRejectedValue(new Error('Database error')),
        where: vi.fn().mockReturnThis(),
      };
      vi.mocked(db.deleteFrom).mockReturnValue(
        deleteBuilder as unknown as ReturnType<typeof db.deleteFrom>,
      );

      await expect(configStorage.delete('1')).rejects.toThrow(
        'Failed to delete configuration: Database error',
      );
    });
  });
});
