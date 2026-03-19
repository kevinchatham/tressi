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
});
