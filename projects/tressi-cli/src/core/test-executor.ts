import chalk from 'chalk';
import { promises as fs } from 'fs';
import ora from 'ora';
import path from 'path';

import { TressiConfig } from '../common/config/types';
import { JsonExporter } from '../reporting/exporters/json-exporter';
import { MarkdownExporter } from '../reporting/exporters/markdown-exporter';
import { XlsxExporter } from '../reporting/exporters/xlsx-exporter';
import { TestSummary } from '../reporting/types';
import { printSummary } from '../tui/cli-output';
import { MinimalTUI } from '../tui/minimal-tui';
import { FileUtils } from '../utils/file-utils';
import { Runner } from './runner';

export interface LoadTestOptions {
  enableTUI: boolean;
  setupSignalHandlers: boolean;
  exportPath?: string;
  silent?: boolean;
  testId?: string; // Only for server persistence
}

/**
 * Module-level variable to track the currently active load test runner.
 * This allows for external control (e.g., stopping the test) from the server.
 */
let activeRunner: Runner | null = null;

/**
 * Result of a load test execution, including the summary and whether it was stopped.
 */
export type LoadTestResult = {
  summary: TestSummary;
  isCanceled: boolean;
};

/**
 * Shared implementation for both load test entry points
 * Generates ephemeral runId for body sampling
 */
async function executeLoadTest(
  config: TressiConfig,
  options: LoadTestOptions,
): Promise<LoadTestResult> {
  const runner = new Runner(config);
  activeRunner = runner;

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
  if (options.enableTUI && !options.silent) {
    minimalUI = new MinimalTUI(config, options.silent);
    minimalUI.start(runner);
  }

  // Execute test
  try {
    await runner.run();
  } finally {
    activeRunner = null;
  }

  // Cleanup TUI
  if (minimalUI) {
    minimalUI.stop();
  }

  // Final cleanup
  await runner.stop();

  // Generate summary
  const summary = runner.getTestSummary();
  const isCanceled = runner.isCanceled();

  // Handle export and printing only for CLI
  if (options.enableTUI) {
    // await handleCLIExport(summary, samples, options.exportPath, options.silent);
    await handleCLIExport(summary, options.exportPath, options.silent);
    if (!options.silent) {
      printSummary(summary, config.options, config, options.silent);
    }
  }

  runner.cleanupResponseSamples();

  // Check for threshold violations in CLI mode
  if (options.enableTUI && checkThresholds(summary)) {
    throw new Error('Test failed: One or more error thresholds were exceeded.');
  }

  return { summary, isCanceled };
}

/**
 * Checks if any configured error thresholds were exceeded during the test.
 */
function checkThresholds(summary: TestSummary): boolean {
  const { configSnapshot, endpoints } = summary;
  const globalExitConfig = configSnapshot.options.workerEarlyExit;

  for (const endpoint of endpoints) {
    const requestConfig = configSnapshot.requests.find(
      (r) => r.url === endpoint.url,
    );
    if (!requestConfig) continue;

    // Determine effective early exit config for this endpoint
    const earlyExit =
      requestConfig.earlyExit !== undefined
        ? requestConfig.earlyExit
        : globalExitConfig;

    if (earlyExit && earlyExit.enabled) {
      // Check error rate threshold
      if (
        earlyExit.errorRateThreshold > 0 &&
        endpoint.errorRate >= earlyExit.errorRateThreshold
      ) {
        return true;
      }

      // Check status code thresholds
      if (earlyExit.exitStatusCodes && earlyExit.exitStatusCodes.length > 0) {
        for (const code of earlyExit.exitStatusCodes) {
          if (endpoint.statusCodeDistribution[code] > 0) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Handles export functionality for CLI mode
 */
async function handleCLIExport(
  summary: TestSummary,
  exportPath?: string,
  silent = false,
): Promise<void> {
  if (!exportPath) return;

  const exportSpinner = silent
    ? undefined
    : ora({
        text: 'Exporting results...',
      }).start();

  try {
    const baseExportName =
      typeof exportPath === 'string' ? exportPath : 'tressi-report';
    const runDate = new Date();

    const reportDir = path.join(
      process.cwd(),
      FileUtils.getSafeDirectoryName(
        `${baseExportName}-${runDate.toISOString()}`,
      ),
    );
    await FileUtils.ensureDirectoryExists(reportDir);

    const jsonExporter = new JsonExporter();
    const xlsxExporter = new XlsxExporter();
    const markdownExporter = new MarkdownExporter();

    // Export JSON files
    await jsonExporter.export(summary, path.join(reportDir, 'summary.json'));

    // Export XLSX
    await xlsxExporter.export(summary, path.join(reportDir, 'results.xlsx'));

    // Export Markdown report
    const markdownReport = markdownExporter.export(
      summary,
      path.join(reportDir, 'report.md'),
    );
    if (typeof markdownReport === 'string') {
      await fs.writeFile(path.join(reportDir, 'report.md'), markdownReport);
    }

    exportSpinner?.succeed(`Successfully exported results to ${reportDir}`);
  } catch (err) {
    exportSpinner?.fail(
      chalk.red(`Failed to export results: ${(err as Error).message}`),
    );
  }
}

/**
 * Execute a load test from CLI or programmatically
 */
export async function runLoadTest(
  config: TressiConfig,
  exportPath?: string,
  silent?: boolean,
): Promise<LoadTestResult> {
  return executeLoadTest(config, {
    enableTUI: true,
    setupSignalHandlers: true,
    exportPath,
    silent,
  });
}

/**
 * Execute a load test from UI/server
 * Looks up config from testId and executes load test
 */
export async function runLoadTestForServer(
  testId: string,
): Promise<LoadTestResult> {
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

/**
 * Stops the currently active load test if one is running.
 */
export async function stopLoadTest(): Promise<void> {
  if (activeRunner) {
    await activeRunner.cancel();
    activeRunner = null;
  }
}
