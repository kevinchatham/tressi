import { runLoadTest } from '..';
import { loadConfig } from '../core/config';
import { MigrationManager } from '../migrations/manager';

/**
 * Handles the main 'run' command for executing load tests.
 */
export class RunCommand {
  /**
   * Executes the run command.
   * @param configPath Optional path to configuration file
   * @param exportPath Optional path to export test results
   * @param silent Optional flag to run in silent mode
   * @param migrate Optional flag to automatically migrate outdated configurations
   * @returns Promise that resolves when the command completes
   * @throws Error when config loading or test execution fails
   */
  async execute(
    configPath?: string,
    exportPath?: string,
    silent?: boolean,
    migrate?: boolean,
  ): Promise<void> {
    // Run migrations before loading config
    const migrationManager = new MigrationManager();
    await migrationManager.migrateFile(
      configPath || 'tressi.config.json',
      migrate,
    );

    const { config } = await loadConfig(configPath);
    await runLoadTest(config, exportPath, silent);
  }

  /**
   * Gets the command description for help text.
   * @returns Command description
   */
  static getDescription(): string {
    return 'Execute a load test using a local or remote configuration file.';
  }
}
