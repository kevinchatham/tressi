import * as readline from 'node:readline/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '../data/database';
import { terminal } from '../tui/terminal';
import { ResetCommand } from './reset-command';

vi.mock('../data/database', () => ({
  db: {
    deleteFrom: vi.fn().mockReturnThis(),
    execute: vi.fn(),
    executeTakeFirst: vi.fn(),
    fn: {
      countAll: vi.fn().mockReturnValue({ as: vi.fn().mockReturnValue('count') }),
    },
    select: vi.fn().mockReturnThis(),
    selectFrom: vi.fn().mockReturnThis(),
  },
}));

vi.mock('../tui/terminal', () => ({
  terminal: {
    print: vi.fn(),
  },
}));

vi.mock('node:readline/promises', () => ({
  createInterface: vi.fn().mockReturnValue({
    close: vi.fn(),
    question: vi.fn(),
  }),
}));

describe('ResetCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the correct description', () => {
    expect(ResetCommand.getDescription()).toBe(
      'Reset the database, removing all configurations and test data.',
    );
  });

  it('should execute reset without confirmation if force is true', async () => {
    const command = new ResetCommand();
    const deleteFromMock = vi.mocked(db.deleteFrom);
    const executeMock = vi.fn().mockResolvedValue({});
    deleteFromMock.mockReturnValue({
      execute: executeMock,
    } as unknown as ReturnType<typeof db.deleteFrom>);

    const selectFromMock = vi.mocked(db.selectFrom);
    selectFromMock.mockReturnValue({
      executeTakeFirst: vi.fn().mockResolvedValue({ count: 0 }),
      select: vi.fn().mockReturnThis(),
    } as unknown as ReturnType<typeof db.selectFrom>);

    await command.execute(true);

    expect(deleteFromMock).toHaveBeenCalledWith('configs');
    expect(executeMock).toHaveBeenCalled();
    expect(terminal.print).toHaveBeenCalledWith(
      expect.stringContaining('Resetting Tressi database...'),
    );
    expect(terminal.print).toHaveBeenCalledWith(expect.stringContaining('successfully reset'));
  });

  it('should ask for confirmation if force is false', async () => {
    const command = new ResetCommand();
    const rl = vi.mocked(readline.createInterface({} as unknown as readline.ReadLineOptions));
    rl.question.mockResolvedValue('y');

    const deleteFromMock = vi.mocked(db.deleteFrom);
    const executeMock = vi.fn().mockResolvedValue({});
    deleteFromMock.mockReturnValue({
      execute: executeMock,
    } as unknown as ReturnType<typeof db.deleteFrom>);

    const selectFromMock = vi.mocked(db.selectFrom);
    selectFromMock.mockReturnValue({
      executeTakeFirst: vi.fn().mockResolvedValue({ count: 0 }),
      select: vi.fn().mockReturnThis(),
    } as unknown as ReturnType<typeof db.selectFrom>);

    await command.execute(false);

    expect(rl.question).toHaveBeenCalled();
    expect(deleteFromMock).toHaveBeenCalled();
    expect(rl.close).toHaveBeenCalled();
  });

  it('should cancel reset if user does not confirm', async () => {
    const command = new ResetCommand();
    const rl = vi.mocked(readline.createInterface({} as unknown as readline.ReadLineOptions));
    rl.question.mockResolvedValue('n');

    await command.execute(false);

    expect(db.deleteFrom).not.toHaveBeenCalled();
    expect(terminal.print).toHaveBeenCalledWith(expect.stringContaining('Reset cancelled'));
    expect(rl.close).toHaveBeenCalled();
  });

  it('should report partial reset if tables are not empty', async () => {
    const command = new ResetCommand();
    const deleteFromMock = vi.mocked(db.deleteFrom);
    const executeMock = vi.fn().mockResolvedValue({});
    deleteFromMock.mockReturnValue({
      execute: executeMock,
    } as unknown as ReturnType<typeof db.deleteFrom>);

    const selectFromMock = vi.mocked(db.selectFrom);
    selectFromMock.mockReturnValue({
      executeTakeFirst: vi.fn().mockResolvedValue({ count: 1 }),
      select: vi.fn().mockReturnThis(),
    } as unknown as ReturnType<typeof db.selectFrom>);

    await command.execute(true);

    expect(terminal.print).toHaveBeenCalledWith(expect.stringContaining('Partial reset'));
  });

  it('should throw error if database operation fails', async () => {
    const command = new ResetCommand();
    const deleteFromMock = vi.mocked(db.deleteFrom);
    deleteFromMock.mockReturnValue({
      execute: vi.fn().mockRejectedValue(new Error('DB Error')),
    } as unknown as ReturnType<typeof db.deleteFrom>);

    await expect(command.execute(true)).rejects.toThrow('DB Error');
    expect(terminal.print).toHaveBeenCalledWith(
      expect.stringContaining('Error during reset: DB Error'),
    );
  });
});
