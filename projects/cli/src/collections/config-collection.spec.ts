import { ConfigDocument } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '../data/database';
import { configStorage } from './config-collection';

vi.mock('../data/database', () => {
  const mockDb = {
    selectFrom: vi.fn(),
    insertInto: vi.fn(),
    updateTable: vi.fn(),
    deleteFrom: vi.fn(),
  };
  return { db: mockDb };
});

describe('ConfigCollection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retrieve all configurations', async () => {
    const mockBuilder = {
      selectAll: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(db.selectFrom).mockReturnValue(
      mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
    );

    const configs = await configStorage.getAll();
    expect(configs).toEqual([]);
  });

  it('should create a configuration', async () => {
    const mockBuilder = {
      values: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({}),
    };
    vi.mocked(db.insertInto).mockReturnValue(
      mockBuilder as unknown as ReturnType<typeof db.insertInto>,
    );

    const config = await configStorage.create({
      name: 'test',
      config: {
        $schema: 'test',
        requests: [],
        options: {
          durationSec: 10,
          rampUpDurationSec: 0,
          headers: {},
          threads: 1,
          workerMemoryLimit: 1024,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [],
            monitoringWindowMs: 0,
          },
        },
      } as unknown as ConfigDocument['config'],
    });
    expect(config.name).toBe('test');
  });

  it('should delete a configuration', async () => {
    const mockBuilder = {
      where: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({
        id: '1',
        name: 'test',
        config: JSON.stringify({
          $schema: 'test',
          requests: [],
          options: {
            durationSec: 10,
            rampUpDurationSec: 0,
            headers: {},
            threads: 1,
            workerMemoryLimit: 1024,
            workerEarlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [],
              monitoringWindowMs: 0,
            },
          },
        }),
        epoch_created_at: 123,
        epoch_updated_at: 123,
      }),
    };
    vi.mocked(db.selectFrom).mockReturnValue(
      mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
    );

    const deleteBuilder = {
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({ numDeletedRows: 1n }),
    };
    vi.mocked(db.deleteFrom).mockReturnValue(
      deleteBuilder as unknown as ReturnType<typeof db.deleteFrom>,
    );

    const result = await configStorage.delete('1');
    expect(result).toBe(true);
  });
});
