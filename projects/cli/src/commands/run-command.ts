import { runLoadTest } from '..';
import { loadConfig } from '../core/config';
import { JsonMigrationManager } from '../data/json-migration-manager';

/**
 * Handles the main 'run' command for executing load tests.
 */
export class RunCommand {
  /**
   * Executes the run command.
   */
  async execute(
    configPath: string,
    exportPath?: string,
    silent?: boolean,
  ): Promise<void> {
    // Validate config version before loading
    const migrationManager = new JsonMigrationManager();
    await migrationManager.validateVersion(configPath);

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
