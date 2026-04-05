import type { Database, VersionedTressiConfig } from '@tressi/shared/cli';
import type { Kysely } from 'kysely';
import { describe, expect, it, vi } from 'vitest';
import { MIGRATIONS } from './migrations';
import {
  dropColumnIfExists,
  noopConfigMigration,
  noopDatabaseMigration,
} from './migrations/migration-utils';

describe('noopJsonMigration', () => {
  it('should replace version in $schema URL', () => {
    const config: VersionedTressiConfig = {
      $schema:
        'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.12.json',
    };

    const migration = noopConfigMigration('0.0.15');
    const result = migration.up(config);

    expect(result.$schema).toBe(
      'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.15.json',
    );
  });

  it('should preserve all other config properties', () => {
    const config: VersionedTressiConfig = {
      $schema:
        'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.12.json',
      nested: { key: 'value' },
      someProperty: 'value',
    };

    const migration = noopConfigMigration('0.0.13');
    const result = migration.up(config);

    expect(result.$schema).toContain('v0.0.13');
    expect((result as unknown as { someProperty: string }).someProperty).toBe('value');
    expect((result as unknown as { nested: { key: string } }).nested.key).toBe('value');
  });
});

describe('noopDatabaseMigration', () => {
  it('should have a version bump summary', () => {
    expect(noopDatabaseMigration.summary).toBe('version bump');
  });

  it('should be an async no-op function', async () => {
    const mockDb = {} as Kysely<Database>;
    await expect(noopDatabaseMigration.up(mockDb)).resolves.toBeUndefined();
  });
});

describe('MIGRATIONS.config', () => {
  describe('0.0.13, 0.0.14, 0.0.15, 0.0.16, 0.0.18, 0.0.19', () => {
    const noopVersions = ['0.0.13', '0.0.14', '0.0.15', '0.0.16', '0.0.18', '0.0.19'];

    noopVersions.forEach((version) => {
      it(`version ${version} should be a noop migration`, () => {
        const migration = MIGRATIONS[version].config;
        expect(migration.summary).toBe('version bump');

        const config: VersionedTressiConfig = {
          $schema: `https://example.com/schemas/tressi.schema.v0.0.12.json`,
        };

        const result = migration.up(config);
        expect(result.$schema).toContain(`v${version}`);
      });
    });
  });

  describe('0.0.17', () => {
    interface WorkerEarlyExitConfig {
      monitoringWindowMs?: number;
    }

    interface OptionsConfig {
      workerEarlyExit?: WorkerEarlyExitConfig;
    }

    interface RequestConfig {
      earlyExit?: WorkerEarlyExitConfig;
      name: string;
      url: string;
    }

    interface Config17 extends VersionedTressiConfig {
      options?: OptionsConfig;
      requests?: RequestConfig[];
    }

    it('should bump monitoringWindowMs > 0 and < 1000 to 1000', () => {
      const config: Config17 = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.16.json',
        options: {
          workerEarlyExit: {
            monitoringWindowMs: 500,
          },
        },
      };

      const result = MIGRATIONS['0.0.17'].config.up(config);
      const typed = result as unknown as Config17;

      expect(typed.options?.workerEarlyExit?.monitoringWindowMs).toBe(1000);
    });

    it('should not modify monitoringWindowMs <= 0', () => {
      const config: Config17 = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.16.json',
        options: {
          workerEarlyExit: {
            monitoringWindowMs: 0,
          },
        },
      };

      const result = MIGRATIONS['0.0.17'].config.up(config);
      const typed = result as unknown as Config17;

      expect(typed.options?.workerEarlyExit?.monitoringWindowMs).toBe(0);
    });

    it('should not modify monitoringWindowMs >= 1000', () => {
      const config: Config17 = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.16.json',
        options: {
          workerEarlyExit: {
            monitoringWindowMs: 1000,
          },
        },
      };

      const result = MIGRATIONS['0.0.17'].config.up(config);
      const typed = result as unknown as Config17;

      expect(typed.options?.workerEarlyExit?.monitoringWindowMs).toBe(1000);
    });

    it('should not modify monitoringWindowMs > 1000', () => {
      const config: Config17 = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.16.json',
        options: {
          workerEarlyExit: {
            monitoringWindowMs: 5000,
          },
        },
      };

      const result = MIGRATIONS['0.0.17'].config.up(config);
      const typed = result as unknown as Config17;

      expect(typed.options?.workerEarlyExit?.monitoringWindowMs).toBe(5000);
    });

    it('should preserve undefined monitoringWindowMs', () => {
      const config: Config17 = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.16.json',
        options: {
          workerEarlyExit: {},
        },
      };

      const result = MIGRATIONS['0.0.17'].config.up(config);
      const typed = result as unknown as Config17;

      expect(typed.options?.workerEarlyExit?.monitoringWindowMs).toBeUndefined();
    });

    it('should preserve undefined workerEarlyExit', () => {
      const config: Config17 = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.16.json',
        options: {},
      };

      const result = MIGRATIONS['0.0.17'].config.up(config);
      const typed = result as unknown as Config17;

      expect(typed.options?.workerEarlyExit).toBeUndefined();
    });

    it('should update request earlyExit.monitoringWindowMs', () => {
      const config: Config17 = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.16.json',
        requests: [
          {
            earlyExit: {
              monitoringWindowMs: 100,
            },
            name: 'Test Request',
            url: 'https://example.com',
          },
        ],
      };

      const result = MIGRATIONS['0.0.17'].config.up(config);
      const typed = result as unknown as Config17;

      expect(typed.requests?.[0]?.earlyExit?.monitoringWindowMs).toBe(1000);
    });

    it('should preserve requests without earlyExit', () => {
      const config: Config17 = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.16.json',
        requests: [
          {
            name: 'Test Request',
            url: 'https://example.com',
          },
        ],
      };

      const result = MIGRATIONS['0.0.17'].config.up(config);
      const typed = result as unknown as Config17;

      expect(typed.requests?.[0]?.earlyExit).toBeUndefined();
    });

    it('should handle multiple requests with mixed earlyExit configs', () => {
      const config: Config17 = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.16.json',
        requests: [
          { earlyExit: { monitoringWindowMs: 50 }, name: 'Req1', url: 'https://example.com' },
          { name: 'Req2', url: 'https://example.com' },
          { earlyExit: { monitoringWindowMs: 2000 }, name: 'Req3', url: 'https://example.com' },
        ],
      };

      const result = MIGRATIONS['0.0.17'].config.up(config);
      const typed = result as unknown as Config17;

      expect(typed.requests?.[0]?.earlyExit?.monitoringWindowMs).toBe(1000);
      expect(typed.requests?.[1]?.earlyExit).toBeUndefined();
      expect(typed.requests?.[2]?.earlyExit?.monitoringWindowMs).toBe(2000);
    });

    it('should update $schema to 0.0.17', () => {
      const config: Config17 = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.16.json',
      };

      const result = MIGRATIONS['0.0.17'].config.up(config);

      expect(result.$schema).toContain('v0.0.17');
    });
  });
});

describe('MIGRATIONS.db', () => {
  describe('0.0.14, 0.0.15, 0.0.16, 0.0.18, 0.0.19', () => {
    const noopVersions = ['0.0.14', '0.0.15', '0.0.16', '0.0.18', '0.0.19'];

    noopVersions.forEach((version) => {
      it(`version ${version} should be a noop migration`, () => {
        const migration = MIGRATIONS[version].db;
        expect(migration.summary).toBe('version bump');
      });
    });
  });

  describe('0.0.17', () => {
    it('should have a warning about destructive migration', () => {
      const migration = MIGRATIONS['0.0.17'].db;
      expect(migration.summary).toContain('WARNING');
      expect(migration.summary).toContain('Destructive');
    });
  });
});

describe('dropColumnIfExists', () => {
  it('should not drop column if it does not exist', async () => {
    const mockExecute = vi.fn().mockResolvedValue([{ name: 'other_column' }]);

    const mockDb = {
      execute: mockExecute,
      schema: {
        alterTable: vi.fn().mockReturnThis(),
        dropColumn: vi.fn().mockReturnThis(),
        dropIndex: vi.fn().mockReturnThis(),
        ifExists: vi.fn().mockReturnThis(),
      },
      select: vi.fn().mockReturnThis(),
      selectFrom: vi.fn().mockReturnThis(),
    } as unknown as Kysely<Database>;

    await dropColumnIfExists(mockDb, 'test_table', 'non_existent_column');

    expect(mockDb.schema.dropIndex).not.toHaveBeenCalled();
    expect(mockDb.schema.alterTable).not.toHaveBeenCalled();
  });

  it('should drop index if provided', async () => {
    const mockExecute = vi.fn().mockResolvedValue(undefined);
    const mockIfExists = vi.fn().mockReturnValue({ execute: mockExecute });
    const mockDropIndex = vi.fn().mockReturnValue({ ifExists: mockIfExists });

    const mockDb = {
      execute: vi.fn().mockResolvedValue([]),
      schema: {
        alterTable: vi.fn().mockReturnThis(),
        dropColumn: vi.fn().mockReturnThis(),
        dropIndex: mockDropIndex,
        ifExists: mockIfExists,
      },
      select: vi.fn().mockReturnThis(),
      selectFrom: vi.fn().mockReturnThis(),
    } as unknown as Kysely<Database>;

    await dropColumnIfExists(mockDb, 'test_table', 'test_column', 'idx_test_column');

    expect(mockDropIndex).toHaveBeenCalledWith('idx_test_column');
    expect(mockIfExists).toHaveBeenCalled();
    expect(mockExecute).toHaveBeenCalled();
  });

  it('should drop column if it exists', async () => {
    const mockExecute = vi.fn().mockResolvedValue(undefined);
    const mockDropColumn = vi.fn().mockReturnValue({ execute: mockExecute });
    const mockAlterTable = vi.fn().mockReturnValue({ dropColumn: mockDropColumn });

    const mockDb = {
      execute: vi.fn().mockResolvedValue([{ name: 'test_column' }]),
      schema: {
        alterTable: mockAlterTable,
        dropColumn: mockDropColumn,
        dropIndex: vi.fn().mockReturnThis(),
        ifExists: vi.fn().mockReturnThis(),
      },
      select: vi.fn().mockReturnThis(),
      selectFrom: vi.fn().mockReturnThis(),
    } as unknown as Kysely<Database>;

    await dropColumnIfExists(mockDb, 'test_table', 'test_column');

    expect(mockAlterTable).toHaveBeenCalledWith('test_table');
    expect(mockDropColumn).toHaveBeenCalledWith('test_column');
    expect(mockExecute).toHaveBeenCalled();
  });

  it('should not fail if column and index do not exist', async () => {
    const mockExecute = vi.fn().mockResolvedValue(undefined);
    const mockIfExists = vi.fn().mockReturnValue({ execute: mockExecute });
    const mockDropIndex = vi.fn().mockReturnValue({ ifExists: mockIfExists });

    const mockDb = {
      execute: vi.fn().mockResolvedValue([]),
      schema: {
        alterTable: vi.fn().mockReturnThis(),
        dropColumn: vi.fn().mockReturnThis(),
        dropIndex: mockDropIndex,
        ifExists: mockIfExists,
      },
      select: vi.fn().mockReturnThis(),
      selectFrom: vi.fn().mockReturnThis(),
    } as unknown as Kysely<Database>;

    await expect(
      dropColumnIfExists(mockDb, 'test_table', 'non_existent_column', 'idx_nonexistent'),
    ).resolves.not.toThrow();

    expect(mockDropIndex).toHaveBeenCalled();
    expect(mockDb.schema.alterTable).not.toHaveBeenCalled();
  });
});
