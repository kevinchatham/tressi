import { JsonMigrationManager } from '../data/json-migration-manager';
import { TressiServer } from '../server';

/**
 * Handles the 'serve' command for starting a Hono server with healthcheck endpoint.
 */
export class ServeCommand {
  private _server: TressiServer | null = null;

  /**
   * Executes the serve command.
   * @param options Command options
   * @returns Promise that resolves when the server starts
   * @throws Error when server fails to start
   */
  async execute(options: { port?: number; migrate?: boolean }): Promise<void> {
    try {
      // Run migrations before server starts
      const migrationManager = new JsonMigrationManager();
      await migrationManager.run(options.migrate);

      this._server = new TressiServer(options.port);

      const handleShutdown = async (): Promise<void> => {
        if (this._server) {
          await this._server.stop();
          process.exit(0);
        }
      };

      process.on('SIGINT', handleShutdown);
      process.on('SIGTERM', handleShutdown);

      await this._server.start();
    } catch (error) {
      throw new Error(`Failed to start server: ${(error as Error).message}`);
    }
  }

  /**
   * Gets the command description for help text.
   * @returns Command description
   */
  static getDescription(): string {
    return 'Start the management server and interactive dashboard.';
  }
}
