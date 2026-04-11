import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '../data/database';
import { testStorage } from './test-collection';

vi.mock('../data/database', () => {
  const mockDb = {
    deleteFrom: vi.fn(),
    insertInto: vi.fn(),
    selectFrom: vi.fn(),
    updateTable: vi.fn(),
  };
  return { db: mockDb };
});

describe('TestCollection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retrieve all test runs', async () => {
    const mockBuilder = {
      execute: vi.fn().mockResolvedValue([]),
      selectAll: vi.fn().mockReturnThis(),
    };
    vi.mocked(db.selectFrom).mockReturnValue(
      mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
    );

    const tests = await testStorage.getAll();
    expect(tests).toEqual([]);
  });

  it('should create a test run', async () => {
    const mockBuilder = {
      execute: vi.fn().mockResolvedValue({}),
      values: vi.fn().mockReturnThis(),
    };
    vi.mocked(db.insertInto).mockReturnValue(
      mockBuilder as unknown as ReturnType<typeof db.insertInto>,
    );

    const test = await testStorage.create({ configId: '1' });
    expect(test.configId).toBe('1');
  });

  it('should delete a test run', async () => {
    const mockBuilder = {
      executeTakeFirst: vi.fn().mockResolvedValue({
        config_id: '1',
        epoch_created_at: 123,
        error: null,
        id: '1',
        status: 'running',
        summary: null,
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

    const result = await testStorage.delete('1');
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

      await expect(testStorage.getAll()).rejects.toThrow(
        'Failed to retrieve test runs: Database error',
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

      await expect(testStorage.getById('1')).rejects.toThrow(
        'Failed to retrieve test run: Database error',
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

      await expect(testStorage.create({ configId: '1' })).rejects.toThrow(
        'Failed to create test run: Database error',
      );
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
        testStorage.edit({ configId: '1', id: 'nonexistent', status: 'completed' }),
      ).rejects.toThrow('Test run with ID nonexistent not found');
    });

    it('should throw when edit fails due to database error', async () => {
      const mockBuilder = {
        executeTakeFirst: vi.fn().mockResolvedValue({
          config_id: '1',
          epoch_created_at: 123,
          error: null,
          id: '1',
          status: 'running',
          summary: null,
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
        testStorage.edit({ configId: '1', id: '1', status: 'completed' }),
      ).rejects.toThrow('Failed to edit test run: Database error');
    });

    it('should throw when delete fails', async () => {
      const mockBuilder = {
        executeTakeFirst: vi.fn().mockResolvedValue({
          config_id: '1',
          epoch_created_at: 123,
          error: null,
          id: '1',
          status: 'running',
          summary: null,
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

      await expect(testStorage.delete('1')).rejects.toThrow(
        'Failed to delete test run: Database error',
      );
    });

    it('should throw when stopAllRunningTests fails', async () => {
      const updateBuilder = {
        executeTakeFirst: vi.fn().mockRejectedValue(new Error('Database error')),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
      };
      vi.mocked(db.updateTable).mockReturnValue(
        updateBuilder as unknown as ReturnType<typeof db.updateTable>,
      );

      await expect(testStorage.stopAllRunningTests()).rejects.toThrow(
        'Failed to stop running tests: Database error',
      );
    });
  });
});
