import blessed from 'blessed';
import contrib from 'blessed-contrib';

import type { QuadrantBufferManager } from '../buffer-manager';
import type { Quadrant4StatusData, QuadrantData } from '../types/quadrant-data';
import { QuadrantBase } from './base/quadrant-base';

/**
 * Quadrant 4: Status Distribution Component with donut chart and detailed analysis
 */
export class Quadrant4Status extends QuadrantBase {
  private donutChart: contrib.Widgets.DonutElement;
  private statusTable: contrib.Widgets.TableElement | null = null;
  private statusViewMode: 'status-distribution' | 'detailed-analysis' =
    'status-distribution';

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
      'Status Code Distribution',
      'status-distribution',
    );
    this.donutChart = this.element as contrib.Widgets.DonutElement;
  }

  /**
   * Create the status distribution element (donut chart by default)
   */
  protected createElement(): contrib.Widgets.DonutElement {
    return this.grid.set(
      this.row,
      this.col,
      this.rowSpan,
      this.colSpan,
      contrib.donut,
      {
        label: this.getTitleForViewMode(),
        radius: 8,
        arcWidth: 3,
        remainColor: 'black',
        yPadding: 2,
      },
    );
  }

  /**
   * Update the status component with new data
   */
  update(data: QuadrantData): void {
    if (!this.isQuadrant4StatusData(data)) {
      this.handleNoDataState('Invalid status data format');
      return;
    }

    const statusData = data as Quadrant4StatusData;

    // Update buffers
    this.updateBuffer('quadrant4-2xx', statusData.statusDistribution['2xx']);
    this.updateBuffer('quadrant4-3xx', statusData.statusDistribution['3xx']);
    this.updateBuffer('quadrant4-4xx', statusData.statusDistribution['4xx']);
    this.updateBuffer('quadrant4-5xx', statusData.statusDistribution['5xx']);

    // Render based on current view mode
    if (this.statusViewMode === 'status-distribution') {
      this.renderStatusDistribution(statusData);
    } else {
      this.renderDetailedAnalysis(statusData);
    }

    // Update title
    this.updateTitle();
  }

  /**
   * Check if data is Quadrant4StatusData
   */
  private isQuadrant4StatusData(
    data: QuadrantData,
  ): data is Quadrant4StatusData {
    return (
      'statusDistribution' in data &&
      'totalRequests' in data &&
      'viewMode' in data
    );
  }

  /**
   * Render status distribution donut chart
   */
  private renderStatusDistribution(data: Quadrant4StatusData): void {
    const { statusDistribution, totalRequests } = data;

    // Calculate percentages
    const total =
      statusDistribution['2xx'] +
      statusDistribution['3xx'] +
      statusDistribution['4xx'] +
      statusDistribution['5xx'];

    if (total === 0) {
      this.handleNoDataState('No HTTP requests recorded');
      return;
    }

    const data2xx = statusDistribution['2xx'];
    const data3xx = statusDistribution['3xx'];
    const data4xx = statusDistribution['4xx'];
    const data5xx = statusDistribution['5xx'];

    const donutData = [
      {
        percent: ((data2xx / total) * 100).toString(),
        label: '2xx',
        color: 'green',
      },
      {
        percent: ((data3xx / total) * 100).toString(),
        label: '3xx',
        color: 'yellow',
      },
      {
        percent: ((data4xx / total) * 100).toString(),
        label: '4xx',
        color: 'red',
      },
      {
        percent: ((data5xx / total) * 100).toString(),
        label: '5xx',
        color: 'magenta',
      },
    ].filter((item) => parseFloat(item.percent) > 0); // Only show categories with data

    this.donutChart.setData(donutData);

    // Update label with total requests
    this.donutChart.setLabel(
      `Status Code Distribution - Total: ${totalRequests.toLocaleString()}`,
    );
  }

  /**
   * Render detailed analysis table
   */
  private renderDetailedAnalysis(data: Quadrant4StatusData): void {
    if (!this.statusTable) {
      this.createDetailedAnalysisView();
    }

    const { detailedStatusCodes, totalRequests } = data;

    if (!detailedStatusCodes || detailedStatusCodes.length === 0) {
      this.handleNoDataState('No detailed status code data available');
      return;
    }

    // Sort by count (most frequent first)
    const sortedCodes = [...detailedStatusCodes].sort(
      (a, b) => b.count - a.count,
    );

    const tableData = {
      headers: ['Code', 'Count', 'Avg Latency', 'Percentage'],
      data: sortedCodes.map((item) => [
        item.code.toString(),
        item.count.toLocaleString(),
        `${Math.round(item.avgLatency)}ms`,
        `${((item.count / totalRequests) * 100).toFixed(1)}%`,
      ]),
    };

    if (this.statusTable) {
      this.statusTable.setData(tableData);
    }
  }

  /**
   * Create detailed analysis table view
   */
  private createDetailedAnalysisView(): void {
    // Clear existing donut chart
    if (this.donutChart && this.donutChart.destroy) {
      this.donutChart.destroy();
    }

    this.statusTable = this.grid.set(
      this.row,
      this.col,
      this.rowSpan,
      this.colSpan,
      contrib.table,
      {
        label: 'Detailed Status Code Analysis',
        interactive: false,
        columnWidth: [8, 12, 15, 12],
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

    this.element = this.statusTable as blessed.Widgets.BlessedElement;
  }

  /**
   * Get title for current view mode
   */
  protected getTitleForViewMode(): string {
    const titles = {
      'status-distribution': 'Status Code Distribution',
      'detailed-analysis': 'Detailed Status Code Analysis',
    };
    return titles[this.statusViewMode];
  }

  /**
   * Get cycle indicator for current view mode
   */
  protected getCycleIndicator(): string {
    const modes = ['status-distribution', 'detailed-analysis'];
    const currentIndex = modes.indexOf(this.statusViewMode);
    if (currentIndex === -1) return '';
    return `[${currentIndex + 1}/${modes.length}]`;
  }

  /**
   * Toggle between status distribution and detailed analysis views
   */
  toggleViewMode(): void {
    this.statusViewMode =
      this.statusViewMode === 'status-distribution'
        ? 'detailed-analysis'
        : 'status-distribution';

    if (this.statusViewMode === 'status-distribution') {
      // Recreate donut chart
      this.donutChart = this.grid.set(
        this.row,
        this.col,
        this.rowSpan,
        this.colSpan,
        contrib.donut,
        {
          label: this.getTitleForViewMode(),
          radius: 8,
          arcWidth: 3,
          remainColor: 'black',
          yPadding: 2,
        },
      );
      this.element = this.donutChart;
    } else {
      this.createDetailedAnalysisView();
    }

    this.updateTitle();
  }

  /**
   * Set view mode
   */
  setViewMode(mode: 'status-distribution' | 'detailed-analysis'): void {
    this.statusViewMode = mode;
    if (mode === 'status-distribution') {
      // Recreate donut chart
      this.donutChart = this.grid.set(
        this.row,
        this.col,
        this.rowSpan,
        this.colSpan,
        contrib.donut,
        {
          label: this.getTitleForViewMode(),
          radius: 8,
          arcWidth: 3,
          remainColor: 'black',
          yPadding: 2,
        },
      );
      this.element = this.donutChart;
    } else {
      this.createDetailedAnalysisView();
    }
    this.updateTitle();
  }

  /**
   * Clear the component data
   */
  clear(): void {
    if (this.statusViewMode === 'status-distribution') {
      // Clear donut chart
      this.donutChart.setData([]);
      this.donutChart.setLabel(this.getTitleForViewMode());
    } else if (this.statusTable) {
      // Clear status table
      this.statusTable.setData({
        headers: ['Code', 'Count', 'Avg Latency', 'Percentage'],
        data: [],
      });
    }

    // Clear buffers
    this.bufferManager.clearBuffer('quadrant4-2xx');
    this.bufferManager.clearBuffer('quadrant4-3xx');
    this.bufferManager.clearBuffer('quadrant4-4xx');
    this.bufferManager.clearBuffer('quadrant4-5xx');
  }

  /**
   * Get the donut chart element
   */
  getDonutChart(): contrib.Widgets.DonutElement {
    return this.donutChart;
  }

  /**
   * Get the status table element
   */
  getStatusTable(): contrib.Widgets.TableElement | null {
    return this.statusTable;
  }
}
