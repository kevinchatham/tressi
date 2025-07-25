import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('fs/promises', () => ({
  access: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('../src/index', () => ({
  runLoadTest: vi.fn(),
}));

const runCli = async (args: string[]): Promise<void> => {
  process.argv = ['node', 'tressi', ...args];
  await import('../src/cli');
};

/**
 * Test suite for the main CLI functionality.
 */
describe('CLI', () => {
  beforeEach(() => {
    vi.resetModules(); // Reset module cache before each test
    vi.clearAllMocks(); // Clear mocks
  });

  afterEach(() => {
    // Restore original process.argv
    process.argv = process.env.npm_config_user_agent
      ? ['node', 'vitest', 'test']
      : ['node'];
  });

  /**
   * Test suite for the main command of the CLI.
   */
  describe('main command', () => {
    /**
     * It should correctly parse all the command-line arguments
     * and call the main `runLoadTest` function with the expected options object.
     */
    it('should call runLoadTest with the correct options', async () => {
      const { runLoadTest } = await import('../src/index');
      await runCli([
        '--config',
        './tressi.config.ts',
        '--workers',
        '20',
        '--duration',
        '60',
        '--rps',
        '500',
        '--autoscale',
        '--export',
        'my-report',
      ]);

      expect(runLoadTest).toHaveBeenCalledWith({
        config: './tressi.config.ts',
        workers: 20,
        durationSec: 60,
        rps: 500,
        autoscale: true,
        exportPath: 'my-report',
        rampUpTimeSec: undefined,
        useUI: true,
      });
    });

    /**
     * It should pass `exportPath: true` when the --export flag is used without a value.
     */
    it('should handle the --export flag without a path', async () => {
      const { runLoadTest } = await import('../src/index');
      await runCli(['--config', './tressi.config.ts', '--export']);

      expect(runLoadTest).toHaveBeenCalledWith(
        expect.objectContaining({
          exportPath: true,
        }),
      );
    });

    /**
     * It should validate that when --autoscale is used, --rps is also provided.
     * If not, it should print an error and exit with a non-zero status code.
     */
    it('should exit if --autoscale is used without --rps', async () => {
      const processExitSpy = vi
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await runCli(['--config', 'tressi.config.ts', '--autoscale']);

      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error: --rps is required when --autoscale is enabled.',
      );

      processExitSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
});
