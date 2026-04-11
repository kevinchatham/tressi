import * as fs from 'node:fs/promises';
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

  describe('_computeSemanticDiff', () => {
    it('should detect changes at root level', () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      const oldObj = { name: 'old', value: 1 };
      const newObj = { name: 'new', value: 1 };

      const diff = (
        manager as unknown as {
          _computeSemanticDiff: (
            oldObj: unknown,
            newObj: unknown,
          ) => Record<
            string,
            { oldValues: Record<string, unknown>; newValues: Record<string, unknown> }
          >;
        }
      )._computeSemanticDiff(oldObj, newObj);

      expect(diff['']).toBeDefined();
      expect(diff[''].oldValues['name']).toBe('old');
      expect(diff[''].newValues['name']).toBe('new');
    });

    it('should detect nested object changes', () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      const oldObj = { config: { retries: 3, timeout: 100 } };
      const newObj = { config: { retries: 3, timeout: 200 } };

      const diff = (
        manager as unknown as {
          _computeSemanticDiff: (
            oldObj: unknown,
            newObj: unknown,
          ) => Record<
            string,
            { oldValues: Record<string, unknown>; newValues: Record<string, unknown> }
          >;
        }
      )._computeSemanticDiff(oldObj, newObj);

      expect(diff['config']).toBeDefined();
      expect(diff['config'].oldValues['timeout']).toBe(100);
      expect(diff['config'].newValues['timeout']).toBe(200);
    });

    it('should detect array changes', () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      const oldObj = { items: ['a', 'b'] };
      const newObj = { items: ['a', 'c', 'd'] };

      const diff = (
        manager as unknown as {
          _computeSemanticDiff: (
            oldObj: unknown,
            newObj: unknown,
          ) => Record<
            string,
            { oldValues: Record<string, unknown>; newValues: Record<string, unknown> }
          >;
        }
      )._computeSemanticDiff(oldObj, newObj);

      expect(diff['']).toBeDefined();
    });

    it('should handle null values', () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      const oldObj = { data: null };
      const newObj = { data: { value: 1 } };

      const diff = (
        manager as unknown as {
          _computeSemanticDiff: (
            oldObj: unknown,
            newObj: unknown,
          ) => Record<
            string,
            { oldValues: Record<string, unknown>; newValues: Record<string, unknown> }
          >;
        }
      )._computeSemanticDiff(oldObj, newObj);

      expect(diff['']).toBeDefined();
    });

    it('should handle primitive to object changes', () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      const oldObj = { data: 42 };
      const newObj = { data: { nested: 42 } };

      const diff = (
        manager as unknown as {
          _computeSemanticDiff: (
            oldObj: unknown,
            newObj: unknown,
          ) => Record<
            string,
            { oldValues: Record<string, unknown>; newValues: Record<string, unknown> }
          >;
        }
      )._computeSemanticDiff(oldObj, newObj);

      expect(diff['']).toBeDefined();
    });
  });

  describe('_formatValue', () => {
    it('should format null as empty string', () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      const result = (
        manager as unknown as { _formatValue: (val: unknown) => string }
      )._formatValue(null);
      expect(result).toBe('');
    });

    it('should format undefined as empty string', () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      const result = (
        manager as unknown as { _formatValue: (val: unknown) => string }
      )._formatValue(undefined);
      expect(result).toBe('');
    });

    it('should format objects as JSON string', () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      const result = (
        manager as unknown as { _formatValue: (val: unknown) => string }
      )._formatValue({ key: 'value' });
      expect(result).toContain('key');
      expect(result).toContain('value');
    });
  });

  describe('_promptUser', () => {
    it('should return false in non-interactive mode without TRESSI_AUTO_MIGRATE', async () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: false });

      const result = await (
        manager as unknown as { _promptUser: (message: string) => Promise<boolean> }
      )._promptUser('Continue?');

      Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: originalIsTTY });

      expect(result).toBe(false);
    });

    it('should return true in non-interactive mode with TRESSI_AUTO_MIGRATE=true', async () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      const originalIsTTY = process.stdin.isTTY;
      const originalAutoMigrate = process.env['TRESSI_AUTO_MIGRATE'];
      Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: false });
      process.env['TRESSI_AUTO_MIGRATE'] = 'true';

      const result = await (
        manager as unknown as { _promptUser: (message: string) => Promise<boolean> }
      )._promptUser('Continue?');

      Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: originalIsTTY });
      if (originalAutoMigrate) {
        delete process.env['TRESSI_AUTO_MIGRATE'];
      } else {
        process.env['TRESSI_AUTO_MIGRATE'] = originalAutoMigrate;
      }

      expect(result).toBe(true);
    });
  });

  describe('_findOutdatedConfigs', () => {
    it('should identify configs with older schema versions', () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      const configs: ConfigDocument[] = [
        {
          config: {
            $schema:
              'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.1.json',
          },
          epoch_created_at: 0,
          epoch_updated_at: 0,
          id: 'config-1',
          name: 'Old Config',
        } as unknown as ConfigDocument,
      ];

      const failures: string[] = [];
      const result = (
        manager as unknown as {
          _findOutdatedConfigs: (
            configs: ConfigDocument[],
            failures: string[],
          ) => { doc: ConfigDocument; version: string }[];
        }
      )._findOutdatedConfigs(configs, failures);

      expect(result).toHaveLength(1);
      expect(result[0].version).toBe('0.0.1');
    });

    it('should skip configs at current version', () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      const configs: ConfigDocument[] = [
        {
          config: {
            $schema:
              'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.20.json',
          },
          epoch_created_at: 0,
          epoch_updated_at: 0,
          id: 'config-1',
          name: 'Current Config',
        } as unknown as ConfigDocument,
      ];

      const failures: string[] = [];
      const result = (
        manager as unknown as {
          _findOutdatedConfigs: (
            configs: ConfigDocument[],
            failures: string[],
          ) => { doc: ConfigDocument; version: string }[];
        }
      )._findOutdatedConfigs(configs, failures);

      expect(result).toHaveLength(0);
    });

    it('should add failure for invalid config schema', () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      const configs: ConfigDocument[] = [
        {
          config: {
            $schema: 'invalid-schema',
          },
          epoch_created_at: 0,
          epoch_updated_at: 0,
          id: 'config-1',
          name: 'Bad Config',
        } as unknown as ConfigDocument,
      ];

      const failures: string[] = [];
      (
        manager as unknown as {
          _findOutdatedConfigs: (
            configs: ConfigDocument[],
            failures: string[],
          ) => { doc: ConfigDocument; version: string }[];
        }
      )._findOutdatedConfigs(configs, failures);

      expect(failures).toHaveLength(1);
    });
  });

  describe('_reportMigrationResults', () => {
    it('should report failures when failures array is not empty', () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      const failures = ['config-1: some error', 'config-2: another error'];

      (
        manager as unknown as {
          _reportMigrationResults: (failures: string[]) => void;
        }
      )._reportMigrationResults(failures);

      expect(terminal.error).toHaveBeenCalled();
    });

    it('should report success when failures array is empty', () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      const failures: string[] = [];

      (
        manager as unknown as {
          _reportMigrationResults: (failures: string[]) => void;
        }
      )._reportMigrationResults(failures);

      expect(terminal.print).toHaveBeenCalled();
    });
  });

  describe('_getPendingMigrations', () => {
    it('should return empty arrays when current version equals target version', async () => {
      const mockDb = {
        selectFrom: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue({ version: '0.0.20' }),
              }),
            }),
          }),
        }),
      } as unknown as Kysely<Database>;

      const manager = new MigrationManager(mockDb);
      const result = await (
        manager as unknown as {
          _getPendingMigrations: () => Promise<{
            currentVersion: string;
            db: string[];
            config: string[];
          }>;
        }
      )._getPendingMigrations();

      expect(result.db).toHaveLength(0);
      expect(result.config).toHaveLength(0);
      expect(result.currentVersion).toBe('0.0.20');
    });

    it('should return pending migrations when current version is lower', async () => {
      const mockDb = {
        selectFrom: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue({ version: '0.0.12' }),
              }),
            }),
          }),
        }),
      } as unknown as Kysely<Database>;

      const manager = new MigrationManager(mockDb);
      const result = await (
        manager as unknown as {
          _getPendingMigrations: () => Promise<{
            currentVersion: string;
            db: string[];
            config: string[];
          }>;
        }
      )._getPendingMigrations();

      expect(result.db.length).toBeGreaterThan(0);
      expect(result.config.length).toBeGreaterThan(0);
      expect(result.currentVersion).toBe('0.0.12');
    });
  });

  describe('_migrateConfig', () => {
    it('should throw error if migration does not update schema version correctly', () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      const initialConfig: VersionedTressiConfig = {
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.12.json',
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

      vi.stubGlobal('MIGRATIONS', {
        '0.0.13': {
          config: {
            summary: 'test migration',
            up: (config: VersionedTressiConfig) => ({
              ...config,
              $schema:
                'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
              options: config.options ? { ...config.options } : undefined,
            }),
          },
          db: { summary: 'db', up: vi.fn() },
        },
      });

      vi.spyOn(MigrationManager, 'getVersion').mockImplementation((url) => {
        if (url?.includes('v0.0.12')) return '0.0.12';
        if (url?.includes('v0.0.13')) return '0.0.13';
        return '0.0.20';
      });

      expect(() =>
        (
          manager as unknown as {
            _migrateConfig: (config: VersionedTressiConfig) => {
              migratedData: unknown;
              summaries: { version: string; summary: string }[];
            };
          }
        )._migrateConfig(initialConfig),
      ).toThrow();

      vi.restoreAllMocks();
    });
  });

  describe('_applyDatabaseMigrations', () => {
    it('should apply database migrations and update version', async () => {
      const mockSpinner = {
        fail: vi.fn(),
        start: vi.fn(),
        succeed: vi.fn(),
        text: '',
      };

      const mockExecute = vi.fn().mockResolvedValue(undefined);
      const mockDb = {
        transaction: vi.fn().mockReturnValue({
          execute: mockExecute,
        }),
      } as unknown as Kysely<Database>;

      const manager = new MigrationManager(mockDb);
      await (
        manager as unknown as {
          _applyDatabaseMigrations: (pendingDb: string[], spinner: unknown) => Promise<void>;
        }
      )._applyDatabaseMigrations(['0.0.13'], mockSpinner);

      expect(mockExecute).toHaveBeenCalled();
    });

    it('should throw error when migration fails', async () => {
      const mockSpinner = {
        fail: vi.fn(),
        start: vi.fn(),
        succeed: vi.fn(),
        text: '',
      };

      const mockDb = {
        transaction: vi.fn().mockReturnValue({
          execute: vi.fn().mockRejectedValue(new Error('Migration failed')),
        }),
      } as unknown as Kysely<Database>;

      const manager = new MigrationManager(mockDb);

      await expect(
        (
          manager as unknown as {
            _applyDatabaseMigrations: (pendingDb: string[], spinner: unknown) => Promise<void>;
          }
        )._applyDatabaseMigrations(['0.0.13'], mockSpinner),
      ).rejects.toThrow();
    });
  });

  describe('_backupDatabase', () => {
    it('should throw error when backup creation fails', async () => {
      vi.clearAllMocks();
      vi.mocked(fs.copyFile).mockRejectedValue(new Error('Backup failed'));

      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      await expect(
        (
          manager as unknown as {
            _backupDatabase: (version: string) => Promise<void>;
          }
        )._backupDatabase('0.0.13'),
      ).rejects.toThrow('Database migration halted');
    });
  });

  describe('migrateFile', () => {
    it('should return early when file is not accessible', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      await manager.migrateFile('/nonexistent/path/config.json');

      expect(vi.mocked(fs.readFile)).not.toHaveBeenCalled();
    });

    it('should return early when config version is not lower than current', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          $schema:
            'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.20.json',
        }),
      );

      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      await manager.migrateFile('/some/path/config.json');

      expect(vi.mocked(fs.writeFile)).not.toHaveBeenCalled();
    });

    it('should return early when schema parsing fails', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Read error'));

      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      await manager.migrateFile('/some/path/config.json');

      expect(terminal.error).not.toHaveBeenCalled();
    });

    it('should return early when schema is invalid format', () => {
      expect(() => MigrationManager.getVersion('invalid-schema')).toThrow();
    });
  });

  describe('_updateVersion', () => {
    it('should insert migration record into database', async () => {
      const mockExecute = vi.fn().mockResolvedValue(undefined);
      const mockInsertInto = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          execute: mockExecute,
        }),
      });

      const mockDb = {
        insertInto: mockInsertInto,
      } as unknown as Kysely<Database>;

      const mockTrx = {
        insertInto: mockInsertInto,
      } as unknown as Kysely<Database>;

      const manager = new MigrationManager(mockDb);
      await (
        manager as unknown as {
          _updateVersion: (version: string, trx: Kysely<Database>) => Promise<void>;
        }
      )._updateVersion('0.0.13', mockTrx);

      expect(mockInsertInto).toHaveBeenCalledWith('migrations');
      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe('_displayDiff', () => {
    it('should print no changes when diff is empty', () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      (
        manager as unknown as {
          _displayDiff: (oldObj: unknown, newObj: unknown) => void;
        }
      )._displayDiff({ name: 'same' }, { name: 'same' });

      expect(terminal.print).toHaveBeenCalled();
    });

    it('should print grouped changes sorted by path', () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      const oldObj = { a: { x: 1 }, b: { y: 2 } };
      const newObj = { a: { x: 2 }, b: { y: 3 } };

      (
        manager as unknown as {
          _displayDiff: (oldObj: unknown, newObj: unknown) => void;
        }
      )._displayDiff(oldObj, newObj);

      expect(terminal.print).toHaveBeenCalled();
    });
  });

  describe('_printDiffLines', () => {
    it('should print modified values with both old and new', () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      (
        manager as unknown as {
          _printDiffLines: (
            oldValues: Record<string, unknown>,
            newValues: Record<string, unknown>,
          ) => void;
        }
      )._printDiffLines({ key: 'oldValue' }, { key: 'newValue' });

      expect(terminal.print).toHaveBeenCalled();
    });

    it('should print added values with green plus', () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      (
        manager as unknown as {
          _printDiffLines: (
            oldValues: Record<string, unknown>,
            newValues: Record<string, unknown>,
          ) => void;
        }
      )._printDiffLines({}, { key: 'newValue' });

      expect(terminal.print).toHaveBeenCalled();
    });

    it('should print removed values with red minus', () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      (
        manager as unknown as {
          _printDiffLines: (
            oldValues: Record<string, unknown>,
            newValues: Record<string, unknown>,
          ) => void;
        }
      )._printDiffLines({ key: 'oldValue' }, {});

      expect(terminal.print).toHaveBeenCalled();
    });
  });

  describe('_applyConfigMigrations', () => {
    it('should call spinner start for each config', () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      const mockSpinner = {
        fail: vi.fn(),
        start: vi.fn(),
        succeed: vi.fn(),
        text: '',
      };

      vi.spyOn(configStorage, 'edit').mockResolvedValue({} as ConfigDocument);

      const outdated: { doc: ConfigDocument; version: string }[] = [
        {
          doc: {
            config: {
              $schema:
                'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.19.json',
              options: { durationSec: 60, headers: {}, rampUpDurationSec: 0, threads: 1 },
              requests: [],
            },
            epoch_created_at: 0,
            epoch_updated_at: 0,
            id: 'config-1',
            name: 'Test Config',
          } as unknown as ConfigDocument,
          version: '0.0.19',
        },
      ];

      const failures: string[] = [];

      (
        manager as unknown as {
          _applyConfigMigrations: (
            outdated: { doc: ConfigDocument; version: string }[],
            spinner: unknown,
            failures: string[],
          ) => void;
        }
      )._applyConfigMigrations(outdated, mockSpinner, failures);

      expect(mockSpinner.start).toHaveBeenCalled();
    });

    it('should handle migration failures and record them', () => {
      const mockDb = {} as unknown as Kysely<Database>;
      const manager = new MigrationManager(mockDb);

      const mockSpinner = {
        fail: vi.fn(),
        start: vi.fn(),
        succeed: vi.fn(),
        text: '',
      };

      vi.spyOn(configStorage, 'edit').mockImplementation(() => {
        throw new Error('Storage error');
      });

      const outdated: { doc: ConfigDocument; version: string }[] = [
        {
          doc: {
            config: {
              $schema: 'invalid',
            },
            epoch_created_at: 0,
            epoch_updated_at: 0,
            id: 'config-1',
            name: 'Bad Config',
          } as unknown as ConfigDocument,
          version: '0.0.12',
        },
      ];

      const failures: string[] = [];

      (
        manager as unknown as {
          _applyConfigMigrations: (
            outdated: { doc: ConfigDocument; version: string }[],
            spinner: unknown,
            failures: string[],
          ) => void;
        }
      )._applyConfigMigrations(outdated, mockSpinner, failures);

      expect(failures.length).toBeGreaterThan(0);
    });
  });
});
