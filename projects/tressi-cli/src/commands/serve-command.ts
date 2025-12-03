import { TressiServer } from '../server';

/**
 * Handles the 'serve' command for starting a Hono server with healthcheck endpoint.
 */
export class ServeCommand {
  private server: TressiServer | null = null;

  /**
   * Executes the serve command.
   * @param options Command options
   * @returns Promise that resolves when the server starts
   * @throws Error when server fails to start
   */
  async execute(options: { port?: number }): Promise<void> {
    try {
      this.server = new TressiServer(options.port);

      // Handle graceful shutdown
      const handleShutdown = async (): Promise<void> => {
        if (this.server) {
          await this.server.stop();
          process.exit(0);
        }
      };

      process.on('SIGINT', handleShutdown);
      process.on('SIGTERM', handleShutdown);

      // Start the server
      await this.server.start();
    } catch (error) {
      throw new Error(`Failed to start server: ${(error as Error).message}`);
    }
  }

  /**
   * Gets the command description for help text.
   * @returns Command description
   */
  static getDescription(): string {
    return 'Start a Hono server with a healthcheck endpoint for monitoring and testing purposes.';
  }
}
