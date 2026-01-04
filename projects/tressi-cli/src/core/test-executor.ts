import { TressiConfig } from '../common/config/types';
import { handleExport } from '../reporting/export-handler';
import { TestSummary } from '../reporting/types';
import { printSummary } from '../tui/cli-output';
import { MinimalTUI } from '../tui/minimal-tui';
import { Runner } from './runner';

export interface LoadTestOptions {
  enableTUI: boolean;
  setupSignalHandlers: boolean;
  testId?: string; // Only for server persistence
}

/**
 * Shared implementation for both load test entry points
 * Generates ephemeral runId for body sampling
 */
async function executeLoadTest(
  config: TressiConfig,
  options: LoadTestOptions,
): Promise<TestSummary> {
  const runner = new Runner(config);

  if (options.testId) runner.setTestId(options.testId);

  // Setup signal handlers only for CLI use
  if (options.setupSignalHandlers) {
    const cleanup = async (): Promise<void> => {
      await runner.stop();
      process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

  // Setup TUI only for CLI use
  let minimalUI: MinimalTUI | undefined;
  if (options.enableTUI && !config.options.silent) {
    minimalUI = new MinimalTUI(config);
    minimalUI.start(runner);
  }

  // Execute test
  await runner.run();

  // Cleanup TUI
  if (minimalUI) {
    minimalUI.stop();
  }

  // Final cleanup
  await runner.stop();

  // Generate summary
  const summary = runner.getTestSummary();

  // Always clean up body samples (they're ephemeral)
  runner.cleanupResponseSamples();

  // Handle export and printing only for CLI
  if (options.enableTUI) {
    await handleExport(summary, config);
    if (!config.options.silent) {
      printSummary(summary, config.options, config);
    }
  }

  return summary;
}

/**
 * Execute a load test from CLI or programmatically
 */
export async function runLoadTest(config: TressiConfig): Promise<TestSummary> {
  return executeLoadTest(config, {
    enableTUI: true,
    setupSignalHandlers: true,
  });
}

/**
 * Execute a load test from UI/server
 * Looks up config from testId and executes load test
 */
export async function runLoadTestForServer(
  testId: string,
): Promise<TestSummary> {
  // Import here to avoid circular dependency
  const { testStorage } = await import('../collections/test-collection');
  const { configStorage } = await import('../collections/config-collection');

  // Get test document to find configId
  const test = await testStorage.getById(testId);
  if (!test) {
    throw new Error(`Test with ID ${testId} not found`);
  }

  // Get config document
  const configDoc = await configStorage.getById(test.configId);
  if (!configDoc) {
    throw new Error(`Config with ID ${test.configId} not found`);
  }

  const config = configDoc.config;

  // Pass runId directly as a parameter, not in options
  return executeLoadTest(config, {
    enableTUI: false,
    setupSignalHandlers: false,
    testId, // For database persistence
  });
}
