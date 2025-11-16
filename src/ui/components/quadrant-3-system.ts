import type blessed from 'blessed';
import contrib from 'blessed-contrib';

import type { QuadrantBufferManager } from '../buffer-manager';
import type { Quadrant3SystemData, QuadrantData } from '../types/quadrant-data';
import { QuadrantBase } from './base/quadrant-base';

/**
 * Quadrant 3: System Metrics Component with system metrics and app config views
 */
export class Quadrant3System extends QuadrantBase {
  private cpuGauge: contrib.Widgets.GaugeElement;
  private memoryGauge: contrib.Widgets.GaugeElement;
  private networkGauge: contrib.Widgets.GaugeElement;
  private configTable: contrib.Widgets.TableElement | null = null;
  private systemViewMode: 'system-metrics' | 'app-config' = 'system-metrics';
  private gauges: contrib.Widgets.GaugeElement[] = [];

  constructor(
    grid: contrib.grid,
    row: number,
    col: number,
    rowSpan: number,
    colSpan: number,
    bufferManager: QuadrantBufferManager,
  ) {
    super(
      grid,
      row,
      col,
      rowSpan,
      colSpan,
      bufferManager,
      'System Health & Performance',
      'system-metrics',
    );

    // Create system metrics view by default
    this.createSystemMetricsView();
    this.cpuGauge = this.gauges[0];
    this.memoryGauge = this.gauges[1];
    this.networkGauge = this.gauges[2];
  }

  /**
   * Create the system metrics element (default)
   */
  protected createElement(): contrib.Widgets.GaugeElement {
    // This will be overridden by createSystemMetricsView
    return this.grid.set(
      this.row,
      this.col,
      this.rowSpan,
      this.colSpan,
      contrib.gauge,
      {
        label: this.getTitleForViewMode(),
        stroke: 'green',
        fill: 'white',
        percent: [0],
      },
    );
  }

  /**
   * Create the system metrics view (default)
   */
  private createSystemMetricsView(): void {
    // Clear existing elements
    this.clearExistingElements();

    // Create 3 side-by-side gauges for CPU, Memory, and Network
    const gaugeWidth = Math.floor(this.colSpan / 3);

    for (let i = 0; i < 3; i++) {
      const gauge = this.grid.set(
        this.row,
        this.col + i * gaugeWidth,
        this.rowSpan,
        gaugeWidth,
        contrib.gauge,
        {
          label:
            i === 0 ? 'CPU Usage' : i === 1 ? 'Memory Usage' : 'Network (MB/s)',
          stroke: 'green',
          fill: 'white',
          percent: [0],
        },
      );
      this.gauges.push(gauge);
    }

    this.cpuGauge = this.gauges[0];
    this.memoryGauge = this.gauges[1];
    this.networkGauge = this.gauges[2];
    this.element = this.cpuGauge; // Set primary element
  }

  /**
   * Create the app configuration view
   */
  private createAppConfigView(): void {
    // Clear existing elements
    this.clearExistingElements();

    this.configTable = this.grid.set(
      this.row,
      this.col,
      this.rowSpan,
      this.colSpan,
      contrib.table,
      {
        label: 'Test Configuration & Settings',
        interactive: false,
        columnWidth: [25, 30],
        style: {
          border: {
            fg: 'white',
          },
          header: {
            fg: 'white',
            bold: true,
          },
        },
      },
    );

    this.element = this.configTable as blessed.Widgets.BlessedElement;
  }

  /**
   * Clear existing elements
   */
  private clearExistingElements(): void {
    // Destroy existing gauges
    this.gauges.forEach((gauge) => {
      if (gauge && gauge.destroy) {
        gauge.destroy();
      }
    });
    this.gauges = [];

    // Destroy config table
    if (this.configTable && this.configTable.destroy) {
      this.configTable.destroy();
    }
    this.configTable = null;
  }

  /**
   * Update the system component with new data
   */
  update(data: QuadrantData): void {
    if (!this.isQuadrant3SystemData(data)) {
      this.handleNoDataState('Invalid system data format');
      return;
    }

    const systemData = data as Quadrant3SystemData;

    if (this.systemViewMode === 'system-metrics') {
      this.updateSystemMetrics(systemData);
    } else {
      this.updateAppConfig(systemData);
    }

    // Update title
    this.updateTitle();
  }

  /**
   * Check if data is Quadrant3SystemData
   */
  private isQuadrant3SystemData(
    data: QuadrantData,
  ): data is Quadrant3SystemData {
    return 'systemMetrics' in data && 'viewMode' in data;
  }

  /**
   * Update system metrics view
   */
  private updateSystemMetrics(data: Quadrant3SystemData): void {
    const { cpuUsage, memoryUsageMB, networkThroughputMBps } =
      data.systemMetrics;

    // Update buffers
    this.updateBuffer('quadrant3-cpu', cpuUsage);
    this.updateBuffer('quadrant3-memory', memoryUsageMB);
    this.updateBuffer('quadrant3-network', networkThroughputMBps);

    // Update CPU gauge
    const cpuColor = this.getColorForPercentage(cpuUsage);
    this.cpuGauge.setPercent(cpuUsage);
    this.cpuGauge.setLabel(`CPU Usage: ${cpuUsage.toFixed(1)}%`);
    this.cpuGauge.options.stroke = cpuColor;

    // Update Memory gauge
    const memoryColor = this.getColorForPercentage(
      (memoryUsageMB / 1024) * 100,
    ); // Assume 1GB total
    this.memoryGauge.setPercent((memoryUsageMB / 1024) * 100);
    this.memoryGauge.setLabel(`Memory: ${memoryUsageMB.toFixed(0)}MB`);
    this.memoryGauge.options.stroke = memoryColor;

    // Update Network gauge
    const networkColor = this.getNetworkColor(networkThroughputMBps);
    const networkPercent = Math.min((networkThroughputMBps / 200) * 100, 100); // 200MB/s max
    this.networkGauge.setPercent(networkPercent);
    this.networkGauge.setLabel(
      `Network: ${networkThroughputMBps.toFixed(1)}MB/s`,
    );
    this.networkGauge.options.stroke = networkColor;
  }

  /**
   * Update app configuration view
   */
  private updateAppConfig(data: Quadrant3SystemData): void {
    if (!data.configData) {
      this.handleNoDataState('No configuration data available');
      return;
    }

    const { endpoints, targetRPS, duration, workers, status } = data.configData;

    const statusEmoji =
      status === 'running' ? '🟢' : status === 'paused' ? '🟡' : '🔴';

    const tableData = {
      headers: ['Setting', 'Value'],
      data: [
        ['Test Endpoints', endpoints.join(', ')],
        ['Target RPS', targetRPS.toString()],
        ['Test Duration', `${duration}s`],
        ['Worker Threads', workers.toString()],
        ['Test Status', `${statusEmoji} ${status.toUpperCase()}`],
        ['Configuration', 'tressi.config.json'],
      ],
    };

    if (this.configTable) {
      this.configTable.setData(tableData);
    }
  }

  /**
   * Get color for network throughput
   */
  private getNetworkColor(throughputMBps: number): string {
    if (throughputMBps < 80) return 'green';
    if (throughputMBps < 150) return 'yellow';
    return 'red';
  }

  /**
   * Get title for current view mode
   */
  protected getTitleForViewMode(): string {
    const titles = {
      'system-metrics': 'System Health & Performance',
      'app-config': 'Test Configuration & Settings',
    };
    return titles[this.systemViewMode];
  }

  /**
   * Get cycle indicator for current view mode
   */
  protected getCycleIndicator(): string {
    const modes = ['system-metrics', 'app-config'];
    const currentIndex = modes.indexOf(this.systemViewMode);
    if (currentIndex === -1) return '';
    return `[${currentIndex + 1}/${modes.length}]`;
  }

  /**
   * Toggle between system metrics and app config views
   */
  toggleViewMode(): void {
    this.systemViewMode =
      this.systemViewMode === 'system-metrics'
        ? 'app-config'
        : 'system-metrics';

    if (this.systemViewMode === 'system-metrics') {
      this.createSystemMetricsView();
    } else {
      this.createAppConfigView();
    }

    this.updateTitle();
  }

  /**
   * Set view mode
   */
  setViewMode(mode: 'system-metrics' | 'app-config'): void {
    this.systemViewMode = mode;
    if (mode === 'system-metrics') {
      this.createSystemMetricsView();
    } else {
      this.createAppConfigView();
    }
    this.updateTitle();
  }

  /**
   * Clear the component data
   */
  clear(): void {
    if (this.systemViewMode === 'system-metrics') {
      // Clear gauges
      this.gauges.forEach((gauge) => {
        if (gauge) {
          gauge.setPercent(0);
          gauge.setLabel('');
        }
      });
    } else if (this.configTable) {
      // Clear config table
      this.configTable.setData({
        headers: ['Setting', 'Value'],
        data: [],
      });
    }

    // Clear buffers
    this.bufferManager.clearBuffer('quadrant3-cpu');
    this.bufferManager.clearBuffer('quadrant3-memory');
    this.bufferManager.clearBuffer('quadrant3-network');
  }

  /**
   * Get the system gauges
   */
  getGauges(): {
    cpu: contrib.Widgets.GaugeElement;
    memory: contrib.Widgets.GaugeElement;
    network: contrib.Widgets.GaugeElement;
  } {
    return {
      cpu: this.cpuGauge,
      memory: this.memoryGauge,
      network: this.networkGauge,
    };
  }

  /**
   * Get the configuration table
   */
  getConfigTable(): contrib.Widgets.TableElement | null {
    return this.configTable;
  }
}
