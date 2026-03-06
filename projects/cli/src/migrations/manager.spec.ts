import * as fs from 'node:fs/promises';

import { ConfigDocument, TressiConfigSchema } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { configStorage } from '../collections/config-collection';
import { MigrationManager } from './manager';
import { MIGRATIONS } from './registry';

vi.mock('../collections/config-collection', () => ({
  configStorage: {
    getAll: vi.fn(),
    edit: vi.fn(),
  },
}));

vi.mock('@tressi/shared/common', async () => {
  const actual = (await vi.importActual('@tressi/shared/common')) as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    TressiConfigSchema: {
      parse: vi.fn((data) => ({
        ...data,
        $schema:
          'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.14.json',
      })),
    },
  };
});

vi.mock('./registry', () => ({
  MIGRATIONS: {},
}));

vi.mock('../../../../package.json', () => ({
  default: { version: '0.0.14' },
}));

vi.mock('node:readline/promises', () => ({
  createInterface: vi.fn(() => ({
    question: vi.fn().mockResolvedValue('y'),
    close: vi.fn(),
  })),
}));

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  copyFile: vi.fn(),
  constants: {
    R_OK: 4,
    W_OK: 2,
  },
}));

describe('MigrationManager', () => {
  let manager: MigrationManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset MIGRATIONS object since it's shared across tests
    for (const key in MIGRATIONS) {
      delete MIGRATIONS[key];
    }

    manager = new MigrationManager();
    // Default to TTY for tests
    vi.stubGlobal('process', {
      ...process,
      stdin: { ...process.stdin, isTTY: true },
    });
  });

  describe('getVersion', () => {
    it('should extract version from schema URL', () => {
      const url =
        'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json';
      expect(MigrationManager.getVersion(url)).toBe('0.0.13');
    });

    it('should throw for invalid URL format', () => {
      expect(() => MigrationManager.getVersion('invalid')).toThrow(
        'Invalid "$schema" format',
      );
    });

    it('should throw for null or undefined', () => {
      expect(() => MigrationManager.getVersion(null)).toThrow(
        'Missing required property: "$schema"',
      );
      expect(() => MigrationManager.getVersion(undefined)).toThrow(
        'Missing required property: "$schema"',
      );
    });
  });

  describe('run (Database Migrations)', () => {
    it('should do nothing if no configurations are outdated', async () => {
      vi.mocked(configStorage.getAll).mockResolvedValue([
        {
          id: '1',
          name: 'Test',
          config: {
            $schema:
              'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.14.json',
          },
          epochCreatedAt: 0,
          epochUpdatedAt: 0,
        } as ConfigDocument,
      ]);

      await manager.run();

      expect(configStorage.edit).not.toHaveBeenCalled();
    });

    it('should migrate outdated configurations', async () => {
      const outdatedConfig = {
        id: '1',
        name: 'Outdated',
        config: {
          $schema:
            'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
          oldField: 'value',
        },
        epochCreatedAt: 0,
        epochUpdatedAt: 0,
      } as unknown as ConfigDocument;

      vi.mocked(configStorage.getAll).mockResolvedValue([outdatedConfig]);

      // Mock a migration object
      MIGRATIONS['0.0.13'] = {
        summary: 'Test migration',
        transform: vi.fn((config) => ({
          ...config,
          $schema: config.$schema.replace('0.0.13', '0.0.14'),
          newField: config.oldField,
        })),
      };

      await manager.run();

      expect(MIGRATIONS['0.0.13'].transform).toHaveBeenCalled();
      expect(TressiConfigSchema.parse).toHaveBeenCalled();
      expect(configStorage.edit).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '1',
          config: expect.objectContaining({
            newField: 'value',
            $schema: expect.stringContaining('v0.0.14'),
          }),
        }),
      );
    });

    it('should summarize failures at the end', async () => {
      const outdatedConfig = {
        id: '1',
        name: 'Outdated',
        config: {
          $schema:
            'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        },
      } as unknown as ConfigDocument;

      vi.mocked(configStorage.getAll).mockResolvedValue([outdatedConfig]);

      // Force a migration failure
      MIGRATIONS['0.0.13'] = {
        summary: 'Failing migration',
        transform: vi.fn(() => {
          throw new Error('Migration failed');
        }),
      };

      const { terminal } = await import('../tui/terminal');
      const errorSpy = vi.spyOn(terminal, 'error');

      await manager.run();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Database migration complete with 1 failure(s)',
        ),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Outdated: Migration failed'),
      );
    });

    it('should handle invalid configurations in database', async () => {
      vi.mocked(configStorage.getAll).mockResolvedValue([
        {
          id: '1',
          name: 'Invalid',
          config: {
            // Missing $schema
          },
        } as unknown as ConfigDocument,
      ]);

      const { terminal } = await import('../tui/terminal');
      const errorSpy = vi.spyOn(terminal, 'error');

      await manager.run();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Configuration "Invalid" in database is invalid: Missing required property: "$schema"',
        ),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Found 1 invalid configuration(s) in database'),
      );
    });

    it('should skip migration if user declines', async () => {
      const { createInterface } = await import('node:readline/promises');
      vi.mocked(createInterface).mockReturnValue({
        question: vi.fn().mockResolvedValue('n'),
        close: vi.fn(),
      } as unknown as ReturnType<typeof createInterface>);

      vi.mocked(configStorage.getAll).mockResolvedValue([
        {
          id: '1',
          name: 'Outdated',
          config: {
            $schema:
              'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
          },
        } as ConfigDocument,
      ]);

      await manager.run();

      expect(configStorage.edit).not.toHaveBeenCalled();
    });

    it('should migrate automatically if force is true', async () => {
      const outdatedConfig = {
        id: '1',
        name: 'Outdated',
        config: {
          $schema:
            'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        },
      } as unknown as ConfigDocument;

      vi.mocked(configStorage.getAll).mockResolvedValue([outdatedConfig]);

      MIGRATIONS['0.0.13'] = {
        summary: 'Test migration',
        transform: vi.fn((config) => ({
          ...config,
          $schema: config.$schema.replace('0.0.13', '0.0.14'),
        })),
      };

      const { createInterface } = await import('node:readline/promises');
      const questionSpy = vi.fn().mockResolvedValue('y');
      vi.mocked(createInterface).mockReturnValue({
        question: questionSpy,
        close: vi.fn(),
      } as unknown as ReturnType<typeof createInterface>);

      await manager.run(true);

      expect(questionSpy).not.toHaveBeenCalled();
      expect(configStorage.edit).toHaveBeenCalled();
    });
  });

  describe('migrateFile', () => {
    const filePath = 'tressi.config.json';

    it('should do nothing if file is not accessible', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Not accessible'));

      await manager.migrateFile(filePath);

      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('should do nothing if file is not outdated', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          $schema:
            'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.14.json',
        }),
      );

      await manager.migrateFile(filePath);

      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle invalid configuration file', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          // Missing $schema
        }),
      );

      const { terminal } = await import('../tui/terminal');
      const errorSpy = vi.spyOn(terminal, 'error');

      await manager.migrateFile(filePath);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Configuration file "tressi.config.json" is invalid: Missing required property: "$schema"',
        ),
      );
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should migrate outdated file', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          $schema:
            'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
          oldField: 'value',
        }),
      );

      MIGRATIONS['0.0.13'] = {
        summary: 'Test migration',
        transform: vi.fn((config) => ({
          ...config,
          $schema: config.$schema.replace('0.0.13', '0.0.14'),
          newField: config.oldField,
        })),
      };

      const { createInterface } = await import('node:readline/promises');
      vi.mocked(createInterface).mockReturnValue({
        question: vi.fn().mockResolvedValue('y'),
        close: vi.fn(),
      } as unknown as ReturnType<typeof createInterface>);

      await manager.migrateFile(filePath);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"newField": "value"'),
        'utf-8',
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('v0.0.14'),
        'utf-8',
      );
    });

    it('should create a backup before migrating file', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          $schema:
            'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        }),
      );

      const { createInterface } = await import('node:readline/promises');
      vi.mocked(createInterface).mockReturnValue({
        question: vi.fn().mockResolvedValue('y'),
        close: vi.fn(),
      } as unknown as ReturnType<typeof createInterface>);

      await manager.migrateFile(filePath);

      expect(fs.copyFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('tressi.config.json.bak'),
      );
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should skip file migration if user declines', async () => {
      const { createInterface } = await import('node:readline/promises');
      vi.mocked(createInterface).mockReturnValue({
        question: vi.fn().mockResolvedValue('n'),
        close: vi.fn(),
      } as unknown as ReturnType<typeof createInterface>);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          $schema:
            'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        }),
      );

      await manager.migrateFile(filePath);

      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should skip file migration in non-TTY environment', async () => {
      vi.stubGlobal('process', {
        ...process,
        stdin: { ...process.stdin, isTTY: false },
      });

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          $schema:
            'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        }),
      );

      await manager.migrateFile(filePath);

      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should migrate file automatically if force is true', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          $schema:
            'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
        }),
      );

      MIGRATIONS['0.0.13'] = {
        summary: 'Test migration',
        transform: vi.fn((config) => ({
          ...config,
          $schema: config.$schema.replace('0.0.13', '0.0.14'),
        })),
      };

      const { createInterface } = await import('node:readline/promises');
      const questionSpy = vi.fn().mockResolvedValue('y');
      vi.mocked(createInterface).mockReturnValue({
        question: questionSpy,
        close: vi.fn(),
      } as unknown as ReturnType<typeof createInterface>);

      await manager.migrateFile(filePath, true);

      expect(questionSpy).not.toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });
});
