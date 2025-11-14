import ora from 'ora';
import { performance } from 'perf_hooks';

import type { CoreRunner } from '../core/core-runner';
import type { TressiConfig } from '../types';

/**
 * Enhanced minimal UI for Tressi load testing
 */
export class MinimalUI {
  private spinner: ReturnType<typeof ora>;
  private interval: NodeJS.Timeout | undefined;
  private config: TressiConfig;

  constructor(config: TressiConfig) {
    this.config = config;
    this.spinner = ora({ text: 'Test starting...' });
  }

  /**
   * Start the enhanced minimal UI
   */
  start(coreRunner: CoreRunner): void {
    this.spinner.start();

    this.interval = setInterval(() => {
      this.updateDisplay(coreRunner);
    }, 500);
  }

  /**
   * Update the display with real-time metrics
   */
  private updateDisplay(coreRunner: CoreRunner): void {
    const startTime = coreRunner.getStartTime();
    const durationSec = this.config.options.durationSec || 10;
    const elapsedSec = Math.min(
      startTime > 0 ? (performance.now() - startTime) / 1000 : 0,
      durationSec,
    );

    // Get real-time metrics
    let metricsText = '';

    try {
      // Use aggregated metrics directly as requested in comments
      const aggregatedMetrics = coreRunner.aggregatedMetrics;
      if (aggregatedMetrics) {
        const {
          requestsPerSecond,
          averageLatency,
          memoryUsageMB,
          cpuUsagePercent,
        } = aggregatedMetrics;

        metricsText = `${Math.round(requestsPerSecond)} rps | ${Math.round(averageLatency)}ms avg | ${memoryUsageMB}MB | ${cpuUsagePercent}% CPU`;
      }
    } catch {
      // Fallback to basic display if metrics unavailable
    }

    const timeText = `[${elapsedSec.toFixed(0)}s/${durationSec}s]`;
    const spinnerText = metricsText
      ? `${timeText} ${metricsText}`
      : `${timeText} Test running...`;

    this.spinner.text = spinnerText;
  }

  /**
   * Stop the minimal UI
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    this.spinner.succeed('Test finished. Generating summary...');
  }

  /**
   * Handle test failure
   */
  fail(message: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    this.spinner.fail(message);
  }
}
