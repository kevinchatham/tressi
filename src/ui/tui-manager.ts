import blessed from 'blessed';
import contrib from 'blessed-contrib';

import type { CoreRunner } from '../core/runner/core-runner';
import { CircularBuffer } from '../utils/circular-buffer';
import { LatencyChart } from './components/latency-chart';
import { LatencyDistributionTable } from './components/latency-distribution-table';
import { ResponseChart } from './components/response-chart';
import { StatsTable } from './components/stats-table';
import { DataTransformer } from './data-transformer';

/**
 * Manages the terminal user interface for Tressi.
 */
export class TuiManager {
  private screen: blessed.Widgets.Screen;
  private grid: contrib.grid;
  private tressiVersion: string;
  private onExit: () => void;

  // UI Components
  private latencyChart: LatencyChart;
  private responseChart: ResponseChart;
  private statsTable: StatsTable;
  private latencyDistributionTable: LatencyDistributionTable;

  // Data buffers for historical data
  private successData: CircularBuffer<number>;
  private redirectData: CircularBuffer<number>;
  private clientErrorData: CircularBuffer<number>;
  private serverErrorData: CircularBuffer<number>;
  private avgLatencyData: CircularBuffer<number>;

  /**
   * Creates a new TUI manager instance.
   * @param onExit A callback function to be called when the user exits the UI.
   * @param tressiVersion The version of Tressi being used.
   */
  constructor(onExit: () => void, tressiVersion: string) {
    this.onExit = onExit;
    this.tressiVersion = tressiVersion;

    this.screen = blessed.screen({ smartCSR: true });
    this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });

    // Initialize CircularBuffers for UI data with 100 items capacity
    this.successData = new CircularBuffer<number>(100);
    this.redirectData = new CircularBuffer<number>(100);
    this.clientErrorData = new CircularBuffer<number>(100);
    this.serverErrorData = new CircularBuffer<number>(100);
    this.avgLatencyData = new CircularBuffer<number>(100);

    // Initialize UI components
    this.latencyChart = new LatencyChart(this.grid, 0, 0, 6, 6);
    this.responseChart = new ResponseChart(this.grid, 0, 6, 6, 6);
    this.statsTable = new StatsTable(this.grid, 6, 0, 6, 6);
    this.latencyDistributionTable = new LatencyDistributionTable(
      this.grid,
      6,
      6,
      6,
      6,
    );

    this.setupEventHandlers();
    this.setupFooter();
  }

  /**
   * Sets up keyboard event handlers for the UI.
   */
  private setupEventHandlers(): void {
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.onExit();
    });
  }

  /**
   * Sets up the footer with version and exit instructions.
   */
  private setupFooter(): void {
    blessed.text({
      parent: this.screen,
      bottom: 0,
      left: 'center',
      content: ' q / esc / ctrl+c to quit ',
      style: {
        fg: 'white',
      },
    });

    blessed.text({
      parent: this.screen,
      bottom: 0,
      left: 0,
      content: `tressi v${this.tressiVersion}`,
      style: {
        fg: 'white',
      },
    });
  }

  /**
   * Updates the UI with new data from the load test.
   * @param runner The Runner instance for the test.
   * @param elapsedSec The elapsed time of the test in seconds.
   * @param totalSec The total duration of the test in seconds.
   * @param targetReqPerSec The target requests per second, if any.
   */
  public update(
    runner: CoreRunner,
    elapsedSec: number,
    totalSec: number,
    targetReqPerSec: number | undefined,
  ): void {
    // Extract data from runner
    const runnerData = DataTransformer.extractRunnerData(runner);

    // Update latency data buffer
    const avgLatencyForInterval = runnerData.histogram.mean;
    this.avgLatencyData.add(avgLatencyForInterval);

    // Transform latency distribution data
    const latencyDistributionData =
      DataTransformer.transformLatencyDistributionData(
        runnerData.latencyDistribution,
      );
    this.latencyDistributionTable.updateFromObject(latencyDistributionData);

    // Get current response code distribution
    const currentDistribution = this.getStatusCodeDistribution(
      runnerData.statusCodeMap,
    );

    // Update response code data buffers
    this.successData.add(currentDistribution['2xx']);
    this.redirectData.add(currentDistribution['3xx']);
    this.clientErrorData.add(currentDistribution['4xx']);
    this.serverErrorData.add(currentDistribution['5xx']);

    // Get data as arrays for chart rendering
    const successArray = this.successData.getAll();
    const redirectArray = this.redirectData.getAll();
    const clientErrorArray = this.clientErrorData.getAll();
    const serverErrorArray = this.serverErrorData.getAll();
    const avgLatencyArray = this.avgLatencyData.getAll();

    const dataPointsCount = successArray.length;

    // Generate time labels
    const timeLabels = DataTransformer.generateTimeLabels(
      elapsedSec,
      dataPointsCount,
    );

    // Update charts
    this.latencyChart.update(avgLatencyArray, timeLabels);

    this.responseChart.update(
      {
        success: successArray,
        redirect: redirectArray,
        clientError: clientErrorArray,
        serverError: serverErrorArray,
      },
      timeLabels,
    );

    // Transform and update stats table
    const statsData = DataTransformer.transformStatsData({
      elapsedSec,
      totalSec,
      currentReqPerSec: runnerData.currentReqPerSec,
      targetReqPerSec,
      successfulRequests: runnerData.successfulRequests,
      failedRequests: runnerData.failedRequests,
      averageLatency: runnerData.averageLatency,
      workerCount: runnerData.workerCount,
    });
    this.statsTable.updateFromObject(statsData);

    // Render the screen
    this.screen.render();
  }

  /**
   * Gets status code distribution by category.
   * @param statusCodeMap Map of status codes to counts
   * @returns Distribution by category
   */
  private getStatusCodeDistribution(statusCodeMap: Record<number, number>): {
    '2xx': number;
    '3xx': number;
    '4xx': number;
    '5xx': number;
    other: number;
  } {
    const distribution = {
      '2xx': 0,
      '3xx': 0,
      '4xx': 0,
      '5xx': 0,
      other: 0,
    };

    for (const [codeStr, count] of Object.entries(statusCodeMap)) {
      const code = Number(codeStr);
      if (code >= 200 && code < 300) {
        distribution['2xx'] += count;
      } else if (code >= 300 && code < 400) {
        distribution['3xx'] += count;
      } else if (code >= 400 && code < 500) {
        distribution['4xx'] += count;
      } else if (code >= 500 && code < 600) {
        distribution['5xx'] += count;
      } else {
        distribution.other += count;
      }
    }

    return distribution;
  }

  /**
   * Destroys the TUI and cleans up resources.
   */
  public destroy(): void {
    if (this.screen) {
      try {
        // Clear the screen and reset terminal before destruction
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const width = (this.screen as any).width || 80;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const height = (this.screen as any).height || 24;
        this.screen.clearRegion(0, width - 1, 0, height - 1);
        this.screen.render();
      } catch {
        // Silently handle screen clearing errors - not critical
      }

      this.screen.destroy();

      // Additional terminal cleanup to ensure clean display
      process.stdout.write('\x1b[2J\x1b[0;0H'); // Clear screen and move cursor to top
      process.stdout.write('\x1b[?25h'); // Show cursor
    }
  }

  /**
   * Gets the underlying blessed screen.
   * @returns The blessed screen
   */
  public getScreen(): blessed.Widgets.Screen {
    return this.screen;
  }

  /**
   * Gets the latency chart component.
   * @returns The latency chart
   */
  public getLatencyChart(): LatencyChart {
    return this.latencyChart;
  }

  /**
   * Gets the response chart component.
   * @returns The response chart
   */
  public getResponseChart(): ResponseChart {
    return this.responseChart;
  }

  /**
   * Gets the stats table component.
   * @returns The stats table
   */
  public getStatsTable(): StatsTable {
    return this.statsTable;
  }

  /**
   * Gets the latency distribution table component.
   * @returns The latency distribution table
   */
  public getLatencyDistributionTable(): LatencyDistributionTable {
    return this.latencyDistributionTable;
  }
}
