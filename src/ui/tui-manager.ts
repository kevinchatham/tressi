import blessed from 'blessed';
import contrib from 'blessed-contrib';

import type { Runner } from '../core/runner';
import type { AggregatedMetrics } from '../workers/metrics-aggregator';
import { QuadrantBufferManager } from './buffer-manager';
import { Quadrant1RPS } from './components/quadrant-1-rps';
import { Quadrant2Latency } from './components/quadrant-2-latency';
import { Quadrant3System } from './components/quadrant-3-system';
import { Quadrant4Status } from './components/quadrant-4-status';
import { QuadrantMemoryManager } from './performance/quadrant-memory-manager';
import type {
  Quadrant1RPSData,
  Quadrant2LatencyData,
  Quadrant3SystemData,
  Quadrant4StatusData,
} from './types/quadrant-data';

/**
 * Enhanced TUI Manager with quadrant-based architecture
 */
export class TuiManager {
  private screen: blessed.Widgets.Screen;
  private grid: contrib.grid;
  // private _tressiVersion: string; // Removed - not currently used
  private onExit: () => Promise<void>;

  // Quadrant components
  private quadrant1RPS: Quadrant1RPS;
  private quadrant2Latency: Quadrant2Latency;
  private quadrant3System: Quadrant3System;
  private quadrant4Status: Quadrant4Status;

  // Buffer and performance management
  private bufferManager: QuadrantBufferManager;
  // private _performanceMonitor: TuiPerformanceMonitor; // Removed - not currently used
  private memoryManager: QuadrantMemoryManager;

  // Navigation and state management
  private selectedQuadrant: 1 | 2 | 3 | 4 = 1;
  private isFullScreen: boolean = false;
  private currentView: 'global' | 'endpoint' = 'global';
  private selectedEndpoint: string | null = null;
  private availableEndpoints: string[] = [];

  // Configurable update frequencies (in milliseconds)
  private updateFrequencies: {
    quadrant1: number; // RPS chart
    quadrant2: number; // Latency
    quadrant3: number; // System metrics
    quadrant4: number; // Status distribution
  };

  // Status bar elements
  private statusBar: blessed.Widgets.BoxElement;
  private helpOverlay: blessed.Widgets.BoxElement | null = null;
  private isHelpVisible: boolean = false;

  // Time management
  private timeLabelsBuffer: string[] = [];
  // private _startTime: number = 0; // Removed - not currently used

  // Store current runner for view switching
  private currentRunner: Runner | null = null;
  private currentElapsedSec: number = 0;
  private currentTotalSec: number = 0;
  private currentTargetReqPerSec: number | undefined;

  constructor(
    onExit: () => Promise<void>,
    _tressiVersion: string, // Reserved for future use
    updateFrequencies?: {
      quadrant1?: number;
      quadrant2?: number;
      quadrant3?: number;
      quadrant4?: number;
    },
  ) {
    this.onExit = onExit;
    // Store version for potential future use
    // this._tressiVersion = tressiVersion;
    // this._startTime = Date.now();

    // Set default update frequencies (can be overridden)
    this.updateFrequencies = {
      quadrant1: updateFrequencies?.quadrant1 ?? 500, // RPS chart - 500ms default
      quadrant2: updateFrequencies?.quadrant2 ?? 500, // Latency - 500ms default
      quadrant3: updateFrequencies?.quadrant3 ?? 1000, // System metrics - 1000ms default
      quadrant4: updateFrequencies?.quadrant4 ?? 1000, // Status distribution - 1000ms default
    };

    // Initialize screen and grid
    this.screen = blessed.screen({ smartCSR: true });
    this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });

    // Initialize buffer and performance managers
    this.bufferManager = new QuadrantBufferManager();
    // this._performanceMonitor = new TuiPerformanceMonitor(); // Reserved for future use
    this.memoryManager = new QuadrantMemoryManager();

    // Initialize quadrant components
    this.quadrant1RPS = new Quadrant1RPS(
      this.grid,
      0,
      0,
      6,
      6,
      this.bufferManager,
    );
    this.quadrant2Latency = new Quadrant2Latency(
      this.grid,
      0,
      6,
      6,
      6,
      this.bufferManager,
    );
    this.quadrant3System = new Quadrant3System(
      this.grid,
      6,
      0,
      6,
      6,
      this.bufferManager,
    );
    this.quadrant4Status = new Quadrant4Status(
      this.grid,
      6,
      6,
      6,
      6,
      this.bufferManager,
    );

    // Initialize status bar
    this.statusBar = this.createStatusBar();

    this.setupEventHandlers();
    this.updateStatusBar();
  }

  /**
   * Creates the enhanced status bar
   */
  private createStatusBar(): blessed.Widgets.BoxElement {
    const statusBar = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      right: 0,
      height: 1,
      style: {
        fg: 'white',
        bg: 'blue',
      },
    });

    return statusBar;
  }

  /**
   * Sets up comprehensive keyboard event handlers
   */
  private setupEventHandlers(): void {
    // Core navigation
    this.screen.key(['escape', 'q', 'C-c'], async () => {
      if (this.isHelpVisible) {
        this.hideHelpOverlay();
      } else {
        await this.onExit();
      }
    });

    // Global/Endpoint toggle
    this.screen.key(['tab'], () => {
      this.toggleGlobalEndpointView();
    });

    // Quadrant navigation
    this.screen.key(['left', 'h'], () => {
      this.navigateQuadrant('left');
    });

    this.screen.key(['right', 'l'], () => {
      this.navigateQuadrant('right');
    });

    this.screen.key(['up', 'k'], () => {
      this.navigateQuadrant('up');
    });

    this.screen.key(['down', 'j'], () => {
      this.navigateQuadrant('down');
    });

    // Full screen toggle
    this.screen.key(['f'], () => {
      this.toggleFullScreen();
    });

    // Help overlay
    this.screen.key(['?'], () => {
      this.toggleHelpOverlay();
    });

    // Quadrant-specific view toggles
    this.screen.key(['1'], () => {
      this.quadrant1RPS.cycleViewMode();
      this.updateStatusBar();
    });

    this.screen.key(['2'], () => {
      this.quadrant2Latency.toggleViewMode();
      this.updateStatusBar();
    });

    this.screen.key(['3'], () => {
      this.quadrant3System.toggleViewMode();
      this.updateStatusBar();
    });

    this.screen.key(['4'], () => {
      this.quadrant4Status.toggleViewMode();
      this.updateStatusBar();
    });
  }

  /**
   * Updates the UI with new data from the load test
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

    // Store current runner data for view switching
    this.currentRunner = runner;
    this.currentElapsedSec = elapsedSec;
    this.currentTotalSec = totalSec;
    this.currentTargetReqPerSec = targetReqPerSec;

    // Update available endpoints for cycling
    this.availableEndpoints = Object.keys(aggregatedMetrics.endpointMetrics);

    // Create quadrant data and update all quadrants simultaneously
    const quadrantData = this.createQuadrantData(
      aggregatedMetrics,
      elapsedSec,
      totalSec,
      targetReqPerSec,
    );

    // Update all quadrants with shared data (respecting individual frequencies)
    this.updateAllQuadrants(quadrantData);

    // Update status bar
    this.updateStatusBar();

    // Render the screen
    this.screen.render();
  }

  /**
   * Creates quadrant data from aggregated metrics
   */
  private createQuadrantData(
    metrics: AggregatedMetrics,
    elapsedSec: number,
    totalSec: number,
    targetReqPerSec?: number,
  ): {
    quadrant1: Quadrant1RPSData;
    quadrant2: Quadrant2LatencyData;
    quadrant3: Quadrant3SystemData;
    quadrant4: Quadrant4StatusData;
  } {
    const timestamp = Date.now();

    // Select data source: global metrics or endpoint-specific metrics
    const dataSource =
      this.currentView === 'endpoint' &&
      this.selectedEndpoint &&
      metrics.endpointMetrics[this.selectedEndpoint]
        ? metrics.endpointMetrics[this.selectedEndpoint]
        : metrics;

    // Calculate RPS data
    const actualRPS = dataSource.requestsPerSecond;
    const successRPS = actualRPS * (1 - dataSource.errorRate);
    const errorRPS = actualRPS * dataSource.errorRate;

    // Calculate status distribution
    const statusDistribution = this.calculateStatusDistribution(
      dataSource.statusCodeDistribution,
    );

    // Create time labels
    this.timeLabelsBuffer.push(`${elapsedSec.toFixed(0)}s`);
    if (this.timeLabelsBuffer.length > 100) {
      this.timeLabelsBuffer.shift();
    }

    const quadrant1Data: Quadrant1RPSData = {
      timestamp,
      elapsedSec,
      aggregatedMetrics: metrics,
      targetRPS: targetReqPerSec || 0,
      actualRPS,
      successRPS,
      errorRPS,
      viewMode: this.quadrant1RPS.getViewMode() as
        | 'actual-target'
        | 'success-error'
        | 'all-metrics',
    };

    const quadrant2Data: Quadrant2LatencyData = {
      timestamp,
      elapsedSec,
      aggregatedMetrics: metrics,
      percentiles: {
        p50: dataSource.p50Latency,
        p95: dataSource.p95Latency,
        p99: dataSource.p99Latency,
        avg: dataSource.averageLatency,
        min: dataSource.minLatency,
        max: dataSource.maxLatency,
      },
      viewMode: this.quadrant2Latency.getViewMode() as 'line-chart' | 'gauge',
      timeLabels: [...this.timeLabelsBuffer],
    };

    const quadrant3Data: Quadrant3SystemData = {
      timestamp,
      elapsedSec,
      aggregatedMetrics: metrics,
      systemMetrics: {
        cpuUsage: metrics.cpuUsagePercent, // Keep global CPU/memory for now
        memoryUsageMB: metrics.memoryUsageMB,
        networkThroughputMBps: dataSource.networkThroughputMBps,
      },
      configData: {
        endpoints: this.availableEndpoints,
        targetRPS: targetReqPerSec || 0,
        duration: totalSec,
        workers: metrics.threads, // Keep global worker count
        status: 'running', // This should come from runner state
      },
      viewMode: this.quadrant3System.getViewMode() as
        | 'system-metrics'
        | 'app-config',
    };

    const quadrant4Data: Quadrant4StatusData = {
      timestamp,
      elapsedSec,
      aggregatedMetrics: metrics,
      statusDistribution,
      detailedStatusCodes: this.createDetailedStatusCodes(
        dataSource.statusCodeDistribution,
      ),
      viewMode: this.quadrant4Status.getViewMode() as
        | 'status-distribution'
        | 'detailed-analysis',
      totalRequests: dataSource.totalRequests,
    };

    return {
      quadrant1: quadrant1Data,
      quadrant2: quadrant2Data,
      quadrant3: quadrant3Data,
      quadrant4: quadrant4Data,
    };
  }

  /**
   * Updates all quadrants with shared data
   */
  private updateAllQuadrants(data: {
    quadrant1: Quadrant1RPSData;
    quadrant2: Quadrant2LatencyData;
    quadrant3: Quadrant3SystemData;
    quadrant4: Quadrant4StatusData;
  }): void {
    // Update each quadrant with its specific data
    this.quadrant1RPS.update(data.quadrant1);
    this.quadrant2Latency.update(data.quadrant2);
    this.quadrant3System.update(data.quadrant3);
    this.quadrant4Status.update(data.quadrant4);
  }

  /**
   * Calculates status distribution from status code counts
   */
  private calculateStatusDistribution(
    statusCodeDistribution: Record<number, number>,
  ): {
    '2xx': number;
    '3xx': number;
    '4xx': number;
    '5xx': number;
  } {
    let count2xx = 0,
      count3xx = 0,
      count4xx = 0,
      count5xx = 0;

    for (const [code, count] of Object.entries(statusCodeDistribution)) {
      const statusCode = parseInt(code);
      if (statusCode >= 200 && statusCode < 300) {
        count2xx += count;
      } else if (statusCode >= 300 && statusCode < 400) {
        count3xx += count;
      } else if (statusCode >= 400 && statusCode < 500) {
        count4xx += count;
      } else if (statusCode >= 500 && statusCode < 600) {
        count5xx += count;
      }
    }

    return {
      '2xx': count2xx,
      '3xx': count3xx,
      '4xx': count4xx,
      '5xx': count5xx,
    };
  }

  /**
   * Creates detailed status codes for analysis view
   */
  private createDetailedStatusCodes(
    statusCodeDistribution: Record<number, number>,
  ): Array<{
    code: number;
    count: number;
    avgLatency: number;
  }> {
    return Object.entries(statusCodeDistribution)
      .map(([code, count]) => ({
        code: parseInt(code),
        count,
        avgLatency: 0, // This would need to be calculated from latency data
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Updates the enhanced status bar with cycle indicators
   */
  private updateStatusBar(): void {
    const viewMode =
      this.currentView === 'global'
        ? 'Global View'
        : `Endpoint: ${this.selectedEndpoint}`;

    const quadrant1Mode = this.quadrant1RPS.getViewMode();
    const quadrant2Mode = this.quadrant2Latency.getViewMode();
    const quadrant3Mode = this.quadrant3System.getViewMode();
    const quadrant4Mode = this.quadrant4Status.getViewMode();

    // Get cycle indicators for each quadrant
    const quadrant1Cycle = this.getViewModeCycleIndicator(1, quadrant1Mode);
    const quadrant2Cycle = this.getViewModeCycleIndicator(2, quadrant2Mode);
    const quadrant3Cycle = this.getViewModeCycleIndicator(3, quadrant3Mode);
    const quadrant4Cycle = this.getViewModeCycleIndicator(4, quadrant4Mode);

    const quadrantIndicators = [
      `[${this.selectedQuadrant === 1 ? '*' : ' '}1: ${this.getViewModeName(quadrant1Mode)} ${quadrant1Cycle}]`,
      `[${this.selectedQuadrant === 2 ? '*' : ' '}2: ${this.getViewModeName(quadrant2Mode)} ${quadrant2Cycle}]`,
      `[${this.selectedQuadrant === 3 ? '*' : ' '}3: ${this.getViewModeName(quadrant3Mode)} ${quadrant3Cycle}]`,
      `[${this.selectedQuadrant === 4 ? '*' : ' '}4: ${this.getViewModeName(quadrant4Mode)} ${quadrant4Cycle}]`,
    ].join(' ');

    const statusText = `[${viewMode}] ${quadrantIndicators} | Press ? for help`;

    this.statusBar.setContent(statusText);
  }

  /**
   * Gets cycle indicator for view mode (e.g., [1/3], [2/2])
   */
  private getViewModeCycleIndicator(
    quadrant: number,
    currentMode: string,
  ): string {
    const modeCycles: Record<number, string[]> = {
      1: ['actual-target', 'success-error', 'all-metrics'], // 3 modes
      2: ['line-chart', 'gauge'], // 2 modes
      3: ['system-metrics', 'app-config'], // 2 modes
      4: ['status-distribution', 'detailed-analysis'], // 2 modes
    };

    const modes = modeCycles[quadrant] || [];
    const currentIndex = modes.indexOf(currentMode);

    if (currentIndex === -1 || modes.length <= 1) {
      return '';
    }

    return `[${currentIndex + 1}/${modes.length}]`;
  }

  /**
   * Gets a friendly name for view mode
   */
  private getViewModeName(mode: string): string {
    const modeNames: Record<string, string> = {
      'actual-target': 'Actual/Target',
      'success-error': 'Success/Error',
      'all-metrics': 'All Metrics',
      'line-chart': 'Line Chart',
      gauge: 'Gauge',
      'system-metrics': 'System',
      'app-config': 'Config',
      'status-distribution': 'Status Dist',
      'detailed-analysis': 'Detailed',
    };
    return modeNames[mode] || mode;
  }

  /**
   * Toggles between global and endpoint view
   */
  private toggleGlobalEndpointView(): void {
    if (this.currentView === 'global' && this.availableEndpoints.length > 0) {
      // From global view, switch to first endpoint
      this.currentView = 'endpoint';
      this.selectedEndpoint = this.availableEndpoints[0];
    } else if (this.currentView === 'endpoint' && this.selectedEndpoint) {
      // From endpoint view, find current endpoint and switch to next
      const currentIndex = this.availableEndpoints.indexOf(
        this.selectedEndpoint,
      );
      if (
        currentIndex >= 0 &&
        currentIndex < this.availableEndpoints.length - 1
      ) {
        // Move to next endpoint
        this.selectedEndpoint = this.availableEndpoints[currentIndex + 1];
      } else {
        // Last endpoint reached, switch back to global view
        this.currentView = 'global';
        this.selectedEndpoint = null;
      }
    } else {
      // Fallback to global view
      this.currentView = 'global';
      this.selectedEndpoint = null;
    }
    this.updateStatusBar();

    // Trigger immediate data refresh if we have runner data
    if (this.currentRunner && this.currentRunner.aggregatedMetrics) {
      // Force a refresh with the current data using the new view state
      const quadrantData = this.createQuadrantData(
        this.currentRunner.aggregatedMetrics,
        this.currentElapsedSec,
        this.currentTotalSec,
        this.currentTargetReqPerSec,
      );
      this.updateAllQuadrants(quadrantData);
    }

    // Render the updated screen
    this.screen.render();
  }

  /**
   * Navigates between quadrants
   */
  private navigateQuadrant(direction: 'left' | 'right' | 'up' | 'down'): void {
    const currentRow = this.selectedQuadrant <= 2 ? 0 : 1;
    const currentCol = (this.selectedQuadrant - 1) % 2;

    let newRow = currentRow;
    let newCol = currentCol;

    switch (direction) {
      case 'left':
        newCol = Math.max(0, currentCol - 1);
        break;
      case 'right':
        newCol = Math.min(1, currentCol + 1);
        break;
      case 'up':
        newRow = Math.max(0, currentRow - 1);
        break;
      case 'down':
        newRow = Math.min(1, currentRow + 1);
        break;
    }

    const newQuadrant = newRow * 2 + newCol + 1;
    this.selectedQuadrant = newQuadrant as 1 | 2 | 3 | 4;
    this.updateStatusBar();
  }

  /**
   * Toggles full screen mode for selected quadrant
   */
  private toggleFullScreen(): void {
    this.isFullScreen = !this.isFullScreen;

    if (this.isFullScreen) {
      // Hide all quadrants except selected one
      this.setQuadrantVisibility(false);
      this.setSelectedQuadrantVisibility(true);
    } else {
      // Show all quadrants
      this.setQuadrantVisibility(true);
    }

    this.screen.render();
  }

  /**
   * Sets visibility for all quadrants
   */
  private setQuadrantVisibility(visible: boolean): void {
    const hidden = !visible;

    this.quadrant1RPS.getElement().hidden = hidden;
    this.quadrant2Latency.getElement().hidden = hidden;
    this.quadrant3System.getElement().hidden = hidden;
    this.quadrant4Status.getElement().hidden = hidden;
  }

  /**
   * Sets visibility for selected quadrant
   */
  private setSelectedQuadrantVisibility(visible: boolean): void {
    const hidden = !visible;

    switch (this.selectedQuadrant) {
      case 1:
        this.quadrant1RPS.getElement().hidden = hidden;
        break;
      case 2:
        this.quadrant2Latency.getElement().hidden = hidden;
        break;
      case 3:
        this.quadrant3System.getElement().hidden = hidden;
        break;
      case 4:
        this.quadrant4Status.getElement().hidden = hidden;
        break;
    }
  }

  /**
   * Toggles help overlay
   */
  private toggleHelpOverlay(): void {
    if (this.isHelpVisible) {
      this.hideHelpOverlay();
    } else {
      this.showHelpOverlay();
    }
  }

  /**
   * Shows help overlay
   */
  private showHelpOverlay(): void {
    if (this.helpOverlay) {
      this.helpOverlay.destroy();
    }

    const helpContent = `
┌─────────────────────────────────────────────────────────────────────────────┐
│ Tressi Terminal UI - Keyboard Shortcuts                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Core Navigation:                                                            │
│   q, esc, ctrl+c  - Quit application                                       │
│   tab             - Toggle global/endpoint view                            │
│   ?               - Toggle this help overlay                               │
│                                                                             │
│ Quadrant Navigation:                                                        │
│   arrow keys, h/j/k/l - Navigate between quadrants                        │
│   f                 - Toggle full screen for selected quadrant             │
│                                                                             │
│ View Mode Toggles:                                                          │
│   1 - Cycle Quadrant 1 views (Actual/Target → Success/Error → All Metrics) │
│   2 - Toggle Quadrant 2 views (Line Chart ↔ Gauge)                        │
│   3 - Toggle Quadrant 3 views (System Metrics ↔ App Config)               │
│   4 - Toggle Quadrant 4 views (Status Distribution ↔ Detailed Analysis)   │
│                                                                             │
│ Current Quadrant: ${this.selectedQuadrant} (${this.getQuadrantName(this.selectedQuadrant)})                    │
│ Current View: ${this.currentView === 'global' ? 'Global' : 'Endpoint'}                                    │
└─────────────────────────────────────────────────────────────────────────────┘
    `.trim();

    this.helpOverlay = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: 80,
      height: 20,
      content: helpContent,
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'cyan',
        bg: 'black',
      },
    });

    this.isHelpVisible = true;
    this.screen.render();
  }

  /**
   * Hides help overlay
   */
  private hideHelpOverlay(): void {
    if (this.helpOverlay) {
      this.helpOverlay.destroy();
      this.helpOverlay = null;
      this.isHelpVisible = false;
      this.screen.render();
    }
  }

  /**
   * Gets quadrant name
   */
  private getQuadrantName(quadrant: number): string {
    const names = {
      1: 'RPS Chart',
      2: 'Latency',
      3: 'System Metrics',
      4: 'Status Distribution',
    };
    return names[quadrant as keyof typeof names] || 'Unknown';
  }

  /**
   * Destroys the TUI and cleans up resources
   */
  public destroy(): void {
    // Clean up managers
    this.memoryManager.destroy();
    this.bufferManager.destroy();

    if (this.helpOverlay) {
      this.helpOverlay.destroy();
    }

    if (this.screen) {
      try {
        // Clear the screen and reset terminal before destruction
        const width =
          (this.screen as blessed.Widgets.Screen & { width?: number }).width ||
          80;
        const height =
          (this.screen as blessed.Widgets.Screen & { height?: number })
            .height || 24;
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
   * Gets the underlying blessed screen
   */
  public getScreen(): blessed.Widgets.Screen {
    return this.screen;
  }

  /**
   * Gets quadrant components for testing
   */
  public getQuadrants(): {
    quadrant1: Quadrant1RPS;
    quadrant2: Quadrant2Latency;
    quadrant3: Quadrant3System;
    quadrant4: Quadrant4Status;
  } {
    return {
      quadrant1: this.quadrant1RPS,
      quadrant2: this.quadrant2Latency,
      quadrant3: this.quadrant3System,
      quadrant4: this.quadrant4Status,
    };
  }

  /**
   * Gets current update frequencies
   */
  public getUpdateFrequencies(): {
    quadrant1: number;
    quadrant2: number;
    quadrant3: number;
    quadrant4: number;
  } {
    return { ...this.updateFrequencies };
  }

  /**
   * Updates update frequencies for specific quadrants
   */
  public setUpdateFrequencies(frequencies: {
    quadrant1?: number;
    quadrant2?: number;
    quadrant3?: number;
    quadrant4?: number;
  }): void {
    if (frequencies.quadrant1 !== undefined) {
      this.updateFrequencies.quadrant1 = frequencies.quadrant1;
    }
    if (frequencies.quadrant2 !== undefined) {
      this.updateFrequencies.quadrant2 = frequencies.quadrant2;
    }
    if (frequencies.quadrant3 !== undefined) {
      this.updateFrequencies.quadrant3 = frequencies.quadrant3;
    }
    if (frequencies.quadrant4 !== undefined) {
      this.updateFrequencies.quadrant4 = frequencies.quadrant4;
    }
  }
}
