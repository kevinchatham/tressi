import blessed from 'blessed';
import contrib from 'blessed-contrib';

import type { Runner } from '../core/runner';
import { CircularBuffer } from '../utils/circular-buffer';
import type { AggregatedMetrics } from '../workers/metrics-aggregator';
import { LatencyChart } from './components/latency-chart';
import { LatencyDistributionTable } from './components/latency-distribution-table';
import { ResponseChart } from './components/response-chart';
import { StatsTable } from './components/stats-table';

/**
 * Manages the terminal user interface for Tressi.
 */
export class TuiManager {
  private screen: blessed.Widgets.Screen;
  private grid: contrib.grid;
  private tressiVersion: string;
  private onExit: () => Promise<void>;

  // UI Components
  private latencyChart: LatencyChart;
  private responseChart: ResponseChart;
  private statsTable: StatsTable;
  private latencyDistributionTable: LatencyDistributionTable;

  // Historical data buffers for time-series charts
  private historicalPercentiles: {
    p50: CircularBuffer<number>;
    p95: CircularBuffer<number>;
    p99: CircularBuffer<number>;
    avg: CircularBuffer<number>;
    min: CircularBuffer<number>;
    max: CircularBuffer<number>;
  };
  private historicalStatusCodes: {
    [statusCode: string]: CircularBuffer<number>;
  } = {};
  private timeLabelsBuffer: CircularBuffer<string>;

  // View state management
  private currentView: 'global' | 'endpoint' = 'global';
  private selectedEndpoint: string | null = null;
  private availableEndpoints: string[] = [];

  /**
   * Creates a new TUI manager instance.
   * @param onExit A callback function to be called when the user exits the UI.
   * @param tressiVersion The version of Tressi being used.
   */
  constructor(onExit: () => Promise<void>, tressiVersion: string) {
    this.onExit = onExit;
    this.tressiVersion = tressiVersion;

    this.screen = blessed.screen({ smartCSR: true });
    this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });

    // Initialize CircularBuffers for historical data with 100 items capacity
    this.historicalPercentiles = {
      p50: new CircularBuffer<number>(100),
      p95: new CircularBuffer<number>(100),
      p99: new CircularBuffer<number>(100),
      avg: new CircularBuffer<number>(100),
      min: new CircularBuffer<number>(100),
      max: new CircularBuffer<number>(100),
    };
    this.timeLabelsBuffer = new CircularBuffer<string>(100);

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
    this.screen.key(['escape', 'q', 'C-c'], async () => {
      await this.onExit();
    });

    // Add view toggle handlers
    this.screen.key(['t'], () => {
      this.toggleView();
    });

    this.screen.key(['e'], () => {
      this.cycleEndpoint();
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
      content: ' q/esc/ctrl+c: quit | t: toggle view | e: cycle endpoints ',
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
    runner: Runner,
    elapsedSec: number,
    totalSec: number,
    targetReqPerSec?: number,
  ): void {
    const aggregatedMetrics = runner.aggregatedMetrics;

    if (!aggregatedMetrics) {
      this.screen.render();
      return;
    }

    // Update available endpoints for cycling
    this.availableEndpoints = Object.keys(aggregatedMetrics.endpointMetrics);

    // Update historical data buffers
    this.updateHistoricalData(aggregatedMetrics, elapsedSec);

    // Get current data as arrays for chart rendering
    const timeLabels = this.timeLabelsBuffer.getAll();
    const percentileData = {
      p50: this.historicalPercentiles.p50.getAll(),
      p95: this.historicalPercentiles.p95.getAll(),
      p99: this.historicalPercentiles.p99.getAll(),
      avg: this.historicalPercentiles.avg.getAll(),
      min: this.historicalPercentiles.min.getAll(),
      max: this.historicalPercentiles.max.getAll(),
    };

    const statusCodeData: { [statusCode: string]: number[] } = {};
    for (const [statusCode, buffer] of Object.entries(
      this.historicalStatusCodes,
    )) {
      statusCodeData[statusCode] = buffer.getAll();
    }

    // Update components directly with aggregated metrics
    this.statsTable.updateFromAggregatedMetrics(
      aggregatedMetrics,
      elapsedSec,
      totalSec,
      targetReqPerSec,
    );

    this.latencyChart.updateFromAggregatedMetrics(
      aggregatedMetrics,
      timeLabels,
      percentileData,
    );

    this.responseChart.updateFromAggregatedMetrics(
      aggregatedMetrics,
      timeLabels,
      statusCodeData,
    );

    this.latencyDistributionTable.updateFromAggregatedMetrics(
      aggregatedMetrics.endpointMetrics,
      this.selectedEndpoint ?? undefined,
    );

    this.screen.render();
  }

  /**
   * Updates historical data buffers with new metrics.
   */
  private updateHistoricalData(
    metrics: AggregatedMetrics,
    elapsedSec: number,
  ): void {
    // Update percentile data
    this.historicalPercentiles.p50.add(metrics.p50Latency);
    this.historicalPercentiles.p95.add(metrics.p95Latency);
    this.historicalPercentiles.p99.add(metrics.p99Latency);
    this.historicalPercentiles.avg.add(metrics.averageLatency);
    this.historicalPercentiles.min.add(metrics.minLatency);
    this.historicalPercentiles.max.add(metrics.maxLatency);

    // Update time labels
    this.timeLabelsBuffer.add(`${elapsedSec.toFixed(0)}s`);

    // Update status code distribution
    const statusCodesToTrack = this.getTopStatusCodes(metrics, 8);

    // Initialize buffers for new status codes
    for (const statusCode of statusCodesToTrack) {
      if (!this.historicalStatusCodes[statusCode]) {
        this.historicalStatusCodes[statusCode] = new CircularBuffer<number>(
          100,
        );
      }
    }

    // Update status code counts
    const currentDistribution =
      this.currentView === 'endpoint' && this.selectedEndpoint
        ? metrics.endpointMetrics[this.selectedEndpoint]
            ?.statusCodeDistribution || {}
        : metrics.statusCodeDistribution;

    for (const statusCode of statusCodesToTrack) {
      const count = currentDistribution[statusCode] || 0;
      this.historicalStatusCodes[statusCode].add(count);
    }
  }

  /**
   * Gets top status codes by frequency.
   */
  private getTopStatusCodes(
    metrics: AggregatedMetrics,
    limit: number,
  ): number[] {
    const distribution =
      this.currentView === 'endpoint' && this.selectedEndpoint
        ? metrics.endpointMetrics[this.selectedEndpoint]
            ?.statusCodeDistribution || {}
        : metrics.statusCodeDistribution;

    return Object.entries(distribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([code]) => parseInt(code));
  }

  /**
   * Toggles between global and per-endpoint view.
   */
  private toggleView(): void {
    if (this.currentView === 'global' && this.availableEndpoints.length > 0) {
      this.currentView = 'endpoint';
      this.selectedEndpoint = this.availableEndpoints[0];
    } else {
      this.currentView = 'global';
      this.selectedEndpoint = null;
    }
  }

  /**
   * Cycles through available endpoints.
   */
  private cycleEndpoint(): void {
    if (this.currentView === 'endpoint' && this.availableEndpoints.length > 0) {
      const currentIndex = this.selectedEndpoint
        ? this.availableEndpoints.indexOf(this.selectedEndpoint)
        : -1;

      const nextIndex = (currentIndex + 1) % this.availableEndpoints.length;
      this.selectedEndpoint = this.availableEndpoints[nextIndex];
    }
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
