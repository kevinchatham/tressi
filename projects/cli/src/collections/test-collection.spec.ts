import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '../data/database';
import { testStorage } from './test-collection';

vi.mock('../data/database', () => {
  const mockDb = {
    selectFrom: vi.fn(),
    insertInto: vi.fn(),
    updateTable: vi.fn(),
    deleteFrom: vi.fn(),
  };
  return { db: mockDb };
});

describe('TestCollection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retrieve all test runs', async () => {
    const mockBuilder = {
      selectAll: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(db.selectFrom).mockReturnValue(
      mockBuilder as unknown as ReturnType<typeof db.selectFrom>,
    );

    const tests = await testStorage.getAll();
    expect(tests).toEqual([]);
  });

  it('should create a test run', async () => {
    const mockBuilder = {
      values: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({}),
    };
    vi.mocked(db.insertInto).mockReturnValue(
      mockBuilder as unknown as ReturnType<typeof db.insertInto>,
    );

    const test = await testStorage.create({ configId: '1' });
    expect(test.configId).toBe('1');
  });

  it('should delete a test run', async () => {
    const mockBuilder = {
      where: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({
        id: '1',
        config_id: '1',
        status: 'running',
        epoch_created_at: 123,
        error: null,
        summary: null,
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

    const result = await testStorage.delete('1');
    expect(result).toBe(true);
  });
});
