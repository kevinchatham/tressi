import type { Database, VersionedTressiConfig } from '@tressi/shared/cli';
import type { ConfigDocument } from '@tressi/shared/common';
import type { Kysely } from 'kysely';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configStorage } from '../collections/config-collection';
import { terminal } from '../tui/terminal';
import { MigrationManager } from './migration-manager';
import { MIGRATIONS } from './migrations';

vi.mock('../collections/config-collection', () => ({
  configStorage: {
    create: vi.fn(),
    delete: vi.fn(),
    edit: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
  },
}));

vi.mock('../tui/terminal', () => ({
  terminal: {
    clear: vi.fn(),
    error: vi.fn(),
    print: vi.fn(),
  },
}));

vi.mock('node:fs/promises', () => ({
  access: vi.fn().mockRejectedValue(new Error('ENOENT')),
  copyFile: vi.fn(),
  readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
  writeFile: vi.fn(),
}));

describe('MigrationManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getVersion', () => {
    it('should extract version from valid schema URL', () => {
      const version = MigrationManager.getVersion(
        'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v1.2.3.json',
      );
      expect(version).toBe('1.2.3');
    });

    it('should extract version from schema URL without .json extension', () => {
      const version = MigrationManager.getVersion(
        'https://example.com/schemas/tressi.schema.v0.0.13',
      );
      expect(version).toBe('0.0.13');
    });

    it('should extract version without leading v', () => {
      const version = MigrationManager.getVersion(
        'https://example.com/schemas/tressi.schema.v2.5.10.json',
      );
      expect(version).toBe('2.5.10');
    });

    it('should throw error when schema URL is undefined', () => {
      expect(() => MigrationManager.getVersion(undefined)).toThrow(
        'Missing required property: "$schema"',
      );
    });

    it('should throw error when schema URL is null', () => {
      expect(() => MigrationManager.getVersion(null)).toThrow(
        'Missing required property: "$schema"',
      );
    });

    it('should throw error for invalid schema format', () => {
      expect(() => MigrationManager.getVersion('https://example.com/invalid')).toThrow(
        'Invalid "$schema" format. Expected a Tressi schema URL containing a version',
      );
    });
  });

  describe('migrate', () => {
    const mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);

    beforeEach(() => {
      mockProcessExit.mockClear();
    });

    it('should create migrations table if it does not exist', async () => {
      const mockAddColumn = vi.fn().mockReturnThis();
      const mockExecute = vi.fn();
      const mockIfNotExists = vi.fn().mockReturnValue({
        addColumn: mockAddColumn,
        execute: mockExecute,
      });
      const mockCreateTable = vi.fn().mockReturnValue({
        ifNotExists: mockIfNotExists,
      });

      const mockExecuteTakeFirst = vi.fn().mockResolvedValue(undefined);

      const mockDb = {
        insertInto: vi.fn().mockReturnValue({
          execute: vi.fn(),
          values: vi.fn().mockReturnThis(),
        }),
        schema: { createTable: mockCreateTable },
        selectFrom: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                executeTakeFirst: mockExecuteTakeFirst,
              }),
            }),
          }),
        }),
        transaction: vi.fn().mockReturnValue({
          execute: vi.fn(),
        }),
      } as unknown as Kysely<Database>;

      vi.mocked(configStorage.getAll).mockResolvedValue([]);

      const manager = new MigrationManager(mockDb);
      await manager.migrate();

      expect(mockCreateTable).toHaveBeenCalledWith('migrations');
      expect(mockIfNotExists).toHaveBeenCalled();
    });

    it('should return early when no pending migrations exist', async () => {
      const mockAddColumn = vi.fn().mockReturnThis();
      const mockExecute = vi.fn();
      const mockIfNotExists = vi.fn().mockReturnValue({
        addColumn: mockAddColumn,
        execute: mockExecute,
      });
      const mockCreateTable = vi.fn().mockReturnValue({
        ifNotExists: mockIfNotExists,
      });

      const mockDb = {
        insertInto: vi.fn().mockReturnValue({
          execute: vi.fn(),
          values: vi.fn().mockReturnThis(),
        }),
        schema: { createTable: mockCreateTable },
        selectFrom: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue({ version: '0.0.0' }),
              }),
            }),
          }),
        }),
        transaction: vi.fn().mockReturnValue({
          execute: vi.fn(),
        }),
      } as unknown as Kysely<Database>;

      vi.mocked(configStorage.getAll).mockResolvedValue([]);

      const manager = new MigrationManager(mockDb);
      await manager.migrate();

      expect(mockCreateTable).toHaveBeenCalled();
      expect(configStorage.getAll).toHaveBeenCalled();
    });

    it('should retrieve configs when checking for outdated configurations', async () => {
      const mockAddColumn = vi.fn().mockReturnThis();
      const mockExecute = vi.fn();
      const mockIfNotExists = vi.fn().mockReturnValue({
        addColumn: mockAddColumn,
        execute: mockExecute,
      });
      const mockCreateTable = vi.fn().mockReturnValue({
        ifNotExists: mockIfNotExists,
      });

      const outdatedConfig = {
        config: {
          $schema:
            'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.12.json',
        },
        epoch_created_at: 0,
        epoch_updated_at: 0,
        id: 'config-1',
        name: 'Test Config',
      } as unknown as ConfigDocument;

      vi.mocked(configStorage.getAll).mockResolvedValue([outdatedConfig]);

      const mockDb = {
        insertInto: vi.fn().mockReturnValue({
          execute: vi.fn(),
          values: vi.fn().mockReturnThis(),
        }),
        schema: { createTable: mockCreateTable },
        selectFrom: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue({ version: '0.0.0' }),
              }),
            }),
          }),
        }),
        transaction: vi.fn().mockReturnValue({
          execute: vi.fn(),
        }),
      } as unknown as Kysely<Database>;

      const manager = new MigrationManager(mockDb);
      await manager.migrate();

      expect(configStorage.getAll).toHaveBeenCalled();
    });
  });

  describe('validateVersion', () => {
    it('should handle non-existent file gracefully', async () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      await manager.validateVersion('/nonexistent/path/config.json');

      expect(terminal.error).not.toHaveBeenCalled();
    });
  });

  describe('MIGRATIONS registry', () => {
    it('should have continuous version range from 0.0.13 to 0.0.20', () => {
      const versions = Object.keys(MIGRATIONS).sort((a, b) => a.localeCompare(b));
      const expected = [
        '0.0.13',
        '0.0.14',
        '0.0.15',
        '0.0.16',
        '0.0.17',
        '0.0.18',
        '0.0.19',
        '0.0.20',
      ];
      expect(versions).toEqual(expected);
    });

    it('should have config and db migrations for each version', () => {
      for (const [version, migration] of Object.entries(MIGRATIONS)) {
        expect(migration.config).toBeDefined();
        expect(migration.config.version).toBe(version);
        expect(migration.config.summary).toBeTruthy();
        expect(typeof migration.config.up).toBe('function');

        expect(migration.db).toBeDefined();
        expect(migration.db.summary).toBeTruthy();
        expect(typeof migration.db.up).toBe('function');
      }
    });

    it('should have monotonically increasing schema versions after migration', () => {
      const initialConfig: VersionedTressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.12.json',
      };

      let config = initialConfig;
      for (const version of Object.keys(MIGRATIONS).sort((a, b) => a.localeCompare(b))) {
        const migration = MIGRATIONS[version];
        const newConfig = migration.config.up(config);
        const newVersion = MigrationManager.getVersion(newConfig.$schema);
        expect(newVersion).toBe(version);
        config = newConfig;
      }
    });

    it('should update $schema URL to match version after migration', () => {
      const initialConfig: VersionedTressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.12.json',
      };

      let config = initialConfig;
      for (const version of Object.keys(MIGRATIONS).sort((a, b) => a.localeCompare(b))) {
        const migration = MIGRATIONS[version];
        config = migration.config.up(config);
      }

      expect(config.$schema).toContain('v0.0.20');
      expect(config.$schema).toContain('tressi.schema');
    });
  });

  describe('migration 0.0.17 - monitoring window bump', () => {
    it('should bump monitoringWindowMs > 0 and < 1000 to 1000 in worker options', () => {
      const config: VersionedTressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.16.json',
        options: {
          durationSec: 60,
          headers: {},
          rampUpDurationSec: 0,
          threads: 1,
          workerEarlyExit: {
            enabled: true,
            errorRateThreshold: 0.5,
            exitStatusCodes: [],
            monitoringWindowMs: 500,
          },
          workerMemoryLimit: 1024,
        },
        requests: [],
      };

      const migrated = MIGRATIONS['0.0.17'].config.up(config);

      expect(
        (migrated.options as { workerEarlyExit?: { monitoringWindowMs?: number } })?.workerEarlyExit
          ?.monitoringWindowMs,
      ).toBe(1000);
    });

    it('should not modify monitoringWindowMs <= 0', () => {
      const config: VersionedTressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.16.json',
        options: {
          durationSec: 60,
          headers: {},
          rampUpDurationSec: 0,
          threads: 1,
          workerEarlyExit: {
            enabled: true,
            errorRateThreshold: 0.5,
            exitStatusCodes: [],
            monitoringWindowMs: 0,
          },
          workerMemoryLimit: 1024,
        },
        requests: [],
      };

      const migrated = MIGRATIONS['0.0.17'].config.up(config);

      expect(
        (migrated.options as { workerEarlyExit?: { monitoringWindowMs?: number } })?.workerEarlyExit
          ?.monitoringWindowMs,
      ).toBe(0);
    });

    it('should not modify monitoringWindowMs >= 1000', () => {
      const config: VersionedTressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.16.json',
        options: {
          durationSec: 60,
          headers: {},
          rampUpDurationSec: 0,
          threads: 1,
          workerEarlyExit: {
            enabled: true,
            errorRateThreshold: 0.5,
            exitStatusCodes: [],
            monitoringWindowMs: 1000,
          },
          workerMemoryLimit: 1024,
        },
        requests: [],
      };

      const migrated = MIGRATIONS['0.0.17'].config.up(config);

      expect(
        (migrated.options as { workerEarlyExit?: { monitoringWindowMs?: number } })?.workerEarlyExit
          ?.monitoringWindowMs,
      ).toBe(1000);
    });

    it('should preserve undefined monitoringWindowMs', () => {
      const config: VersionedTressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.16.json',
        options: {
          durationSec: 60,
          headers: {},
          rampUpDurationSec: 0,
          threads: 1,
          workerEarlyExit: {},
        },
        requests: [],
      };

      const migrated = MIGRATIONS['0.0.17'].config.up(config);

      expect(
        (migrated.options as { workerEarlyExit?: { monitoringWindowMs?: number } })?.workerEarlyExit
          ?.monitoringWindowMs,
      ).toBeUndefined();
    });

    it('should update $schema to 0.0.17', () => {
      const config: VersionedTressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.16.json',
      };

      const migrated = MIGRATIONS['0.0.17'].config.up(config);

      expect(migrated.$schema).toContain('v0.0.17');
    });
  });
});
