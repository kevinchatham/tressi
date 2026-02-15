import ora from 'ora';
import { performance } from 'perf_hooks';

import { TressiConfig } from '../common/config/types';
import type { Runner } from '../core/runner';

/**
 * Enhanced minimal UI for Tressi load testing
 */
export class MinimalTUI {
  private spinner: ReturnType<typeof ora>;
  private interval: NodeJS.Timeout | undefined;
  private config: TressiConfig;

  private silent: boolean;

  constructor(config: TressiConfig, silent?: boolean) {
    this.config = config;
    this.silent = silent ?? false;
    this.spinner = ora({ text: 'Test starting...' });
  }

  /**
   * Starts the enhanced minimal UI with real-time metrics display.
   *
   * @param runner - The test runner instance providing access to metrics
   *
   * @remarks
   * Initializes a spinner-based UI that updates every 500ms with current test metrics.
   * Respects the silent parameter - if silent mode is enabled, no UI is displayed.
   *
   * The UI displays:
   * - Elapsed time and total duration
   * - Requests per second (RPS)
   * - Average latency
   * - Memory usage
   * - CPU usage percentage
   *
   * Uses a non-blocking approach with setInterval to avoid impacting test performance.
   */
  start(runner: Runner): void {
    if (this.silent) return;

    this.spinner.start();

    this.interval = setInterval(() => {
      this.updateDisplay(runner);
    }, 500);
  }

  /**
   * Stops the minimal UI and displays completion message.
   *
   * @remarks
   * Clears the update interval and displays a success message indicating test completion.
   * Respects silent mode parameter. The completion message serves as a visual
   * confirmation that the test has finished and summary generation is beginning.
   */
  stop(): void {
    if (this.silent) return;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    this.spinner.succeed('Test finished. Generating summary...');
  }

  /**
   * Updates the UI display with current test metrics.
   *
   * @param runner - The test runner instance
   *
   * @remarks
   * Retrieves real-time metrics from the runner and formats them for display.
   * Handles cases where metrics might be temporarily unavailable by providing
   * fallback display text.
   *
   * Calculates elapsed time and clamps it to the configured duration to prevent
   * display of times beyond the test completion point.
   *
   * The display format is optimized for readability: "rps | avg_latency | memory | cpu%".
   */
  private updateDisplay(runner: Runner): void {
    if (this.silent) return;

    const startTime = runner.getStartTime();
    const durationSec = this.config.options.durationSec || 10;
    const elapsedSec = Math.trunc(
      Math.min(
        startTime > 0 ? (performance.now() - startTime) / 1000 : 0,
        durationSec,
      ),
    );

    // Get real-time metrics
    let metricsText = '';

    try {
      // Use aggregated metrics directly as requested in comments
      const aggregatedMetrics = runner.getAggregatedMetrics();
      const { memoryUsageMB, cpuUsagePercent } = aggregatedMetrics;
      const {
        averageRequestsPerSecond: averageRequestsPerSecond,
        p50LatencyMs,
      } = aggregatedMetrics.global;

      metricsText = `${averageRequestsPerSecond} rps | ${p50LatencyMs}ms p50 | ${memoryUsageMB}MB | ${cpuUsagePercent}% CPU`;
    } catch {
      // Fallback to basic display if metrics unavailable
    }

    const timeText = `[${elapsedSec}s/${durationSec}s]`;
    const spinnerText = metricsText
      ? `${timeText} ${metricsText}`
      : `${timeText} Test running...`;

    this.spinner.text = spinnerText;
  }
}
