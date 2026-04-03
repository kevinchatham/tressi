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
});
