import { runLoadTest } from '..';
import { loadConfig } from '../core/config';

/**
 * Handles the main 'run' command for executing load tests.
 */
export class RunCommand {
  /**
   * Executes the run command.
   * @param configPath Optional path to configuration file
   * @param exportPath Optional path to export test results
   * @param silent Optional flag to run in silent mode
   * @returns Promise that resolves when the command completes
   * @throws Error when config loading or test execution fails
   */
  async execute(
    configPath?: string,
    exportPath?: string,
    silent?: boolean,
  ): Promise<void> {
    const { config } = await loadConfig(configPath);
    await runLoadTest(config, exportPath, silent);
  }

  /**
   * Gets the command description for help text.
   * @returns Command description
   */
  static getDescription(): string {
    return 'Run a load test using the specified configuration file. This is the default action when no specific command is provided.';
  }
}
