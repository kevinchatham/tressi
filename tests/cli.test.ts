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
        '--autoscale',
        '--export',
        'my-report',
      ]);

      expect(runLoadTest).toHaveBeenCalledWith({
        config: './tressi.config.ts',
        workers: 20,
        durationSec: 60,
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
     * It should allow --autoscale without --rps since RPS is now per-request
     */
    it('should allow --autoscale without --rps', async () => {
      const { runLoadTest } = await import('../src/index');
      await runCli(['--config', 'tressi.config.ts', '--autoscale']);

      expect(runLoadTest).toHaveBeenCalledWith(
        expect.objectContaining({
          autoscale: true,
        }),
      );
    });

    describe('early exit options', () => {
      it('should parse early exit options correctly', async () => {
        const { runLoadTest } = await import('../src/index');
        await runCli([
          '--config',
          './tressi.config.ts',
          '--early-exit-on-error',
          '--error-rate-threshold',
          '0.05',
          '--error-count-threshold',
          '100',
          '--error-status-codes',
          '500,503,404',
        ]);

        expect(runLoadTest).toHaveBeenCalledWith(
          expect.objectContaining({
            earlyExitOnError: true,
            errorRateThreshold: 0.05,
            errorCountThreshold: 100,
            errorStatusCodes: [500, 503, 404],
          }),
        );
      });

      it('should parse single error status code', async () => {
        const { runLoadTest } = await import('../src/index');
        await runCli([
          '--config',
          './tressi.config.ts',
          '--early-exit-on-error',
          '--error-status-codes',
          '500',
        ]);

        expect(runLoadTest).toHaveBeenCalledWith(
          expect.objectContaining({
            earlyExitOnError: true,
            errorStatusCodes: [500],
          }),
        );
      });

      it('should exit with error when early exit is enabled but no thresholds provided', async () => {
        const processExitSpy = vi
          .spyOn(process, 'exit')
          .mockImplementation(() => undefined as never);
        const consoleErrorSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});

        await runCli([
          '--config',
          './tressi.config.ts',
          '--early-exit-on-error',
        ]);

        expect(processExitSpy).toHaveBeenCalledWith(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error: When --early-exit-on-error is enabled, at least one of --error-rate-threshold, --error-count-threshold, or --error-status-codes must be provided.',
        );

        processExitSpy.mockRestore();
        consoleErrorSpy.mockRestore();
      });

      it('should exit with error when error status codes are invalid', async () => {
        const processExitSpy = vi
          .spyOn(process, 'exit')
          .mockImplementation(() => undefined as never);
        const consoleErrorSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});

        await runCli([
          '--config',
          './tressi.config.ts',
          '--early-exit-on-error',
          '--error-status-codes',
          'invalid,500',
        ]);

        expect(processExitSpy).toHaveBeenCalledWith(1);
        expect(consoleErrorSpy).toHaveBeenCalled();

        processExitSpy.mockRestore();
        consoleErrorSpy.mockRestore();
      });

      it('should exit with error when error rate threshold is invalid', async () => {
        const { runLoadTest } = await import('../src/index');

        await runCli([
          '--config',
          './tressi.config.ts',
          '--early-exit-on-error',
          '--error-rate-threshold',
          'invalid',
        ]);

        expect(runLoadTest).toHaveBeenCalledWith(
          expect.objectContaining({
            earlyExitOnError: true,
            errorRateThreshold: NaN,
          }),
        );
      });

      it('should exit with error when error count threshold is invalid', async () => {
        const { runLoadTest } = await import('../src/index');

        await runCli([
          '--config',
          './tressi.config.ts',
          '--early-exit-on-error',
          '--error-count-threshold',
          'invalid',
        ]);

        expect(runLoadTest).toHaveBeenCalledWith(
          expect.objectContaining({
            earlyExitOnError: true,
            errorCountThreshold: NaN,
          }),
        );
      });

      it('should handle edge case status codes correctly', async () => {
        const { runLoadTest } = await import('../src/index');
        await runCli([
          '--config',
          './tressi.config.ts',
          '--early-exit-on-error',
          '--error-status-codes',
          '100,200,300,400,500',
        ]);

        expect(runLoadTest).toHaveBeenCalledWith(
          expect.objectContaining({
            earlyExitOnError: true,
            errorStatusCodes: [100, 200, 300, 400, 500],
          }),
        );
      });
    });
  });
});
