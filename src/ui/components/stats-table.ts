import contrib from 'blessed-contrib';

import type { AggregatedMetrics } from '../../workers/metrics-aggregator';

/**
 * Manages the statistics table component for the terminal UI.
 */
export class StatsTable {
  private table: contrib.Widgets.TableElement;

  /**
   * Creates a new statistics table component.
   * @param grid The blessed-contrib grid for positioning
   * @param row Starting row position
   * @param col Starting column position
   * @param rowSpan Number of rows to span
   * @param colSpan Number of columns to span
   */
  constructor(
    grid: contrib.grid,
    row: number,
    col: number,
    rowSpan: number,
    colSpan: number,
  ) {
    this.table = grid.set(row, col, rowSpan, colSpan, contrib.table, {
      label: 'Live Stats',
      interactive: false,
      columnWidth: [25, 20],
    });
  }

  /**
   * Updates the statistics table with new data.
   * @param headers Array of column headers
   * @param data Array of row data (each row is an array of cell values)
   */
  update(headers: string[], data: string[][]): void {
    this.table.setData({
      headers,
      data: data.map((row) => row.map((cell) => cell.toString())),
    });
  }

  /**
   * Updates the statistics table using a pre-formatted data object.
   * @param tableData Object containing headers and data arrays
   */
  updateFromObject(tableData: { headers: string[]; data: string[][] }): void {
    this.table.setData({
      headers: tableData.headers,
      data: tableData.data.map((row) => row.map((cell) => cell.toString())),
    });
  }

  /**
   * Updates the statistics table directly from aggregated metrics.
   * @param metrics The aggregated metrics from worker threads
   * @param elapsedSec Current elapsed time in seconds
   * @param totalSec Total test duration in seconds
   * @param targetReqPerSec Target requests per second (optional)
   */
  updateFromAggregatedMetrics(
    metrics: AggregatedMetrics,
    elapsedSec: number,
    totalSec: number,
    targetReqPerSec?: number,
  ): void {
    const successRate =
      metrics.totalRequests > 0
        ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(
            1,
          )
        : '0.0';

    const rpsStat = targetReqPerSec
      ? `${metrics.requestsPerSecond.toFixed(1)} / ${targetReqPerSec}`
      : metrics.requestsPerSecond.toFixed(1);

    const data: string[][] = [
      ['Time', `${elapsedSec.toFixed(0)}s / ${totalSec}s`],
      ['Workers', metrics.threads.toString()],
      ['CPU Usage', `${metrics.cpuUsagePercent}%`],
      ['Memory Usage', `${metrics.memoryUsageMB}MB`],
      ['Total Requests', metrics.totalRequests.toLocaleString()],
      ['Success Rate', `${successRate}%`],
      ['Req/s (Actual/Target)', rpsStat],
      [
        'Success / Fail',
        `${metrics.successfulRequests.toLocaleString()} / ${metrics.failedRequests.toLocaleString()}`,
      ],
      ['Avg Latency (ms)', Math.round(metrics.averageLatency).toString()],
      ['p95 Latency (ms)', Math.round(metrics.p95Latency).toString()],
      ['p99 Latency (ms)', Math.round(metrics.p99Latency).toString()],
      [
        'Min / Max Latency (ms)',
        `${Math.round(metrics.minLatency)} / ${Math.round(metrics.maxLatency)}`,
      ],
    ];

    this.table.setData({
      headers: ['Stat', 'Value'],
      data: data.map((row) => row.map((cell) => cell.toString())),
    });
  }

  /**
   * Clears the table data.
   */
  clear(): void {
    this.table.setData({
      headers: ['Stat', 'Value'],
      data: [],
    });
  }

  /**
   * Gets the underlying blessed-contrib table element.
   * @returns The table element
   */
  getElement(): contrib.Widgets.TableElement {
    return this.table;
  }

  /**
   * Sets custom column widths for the table.
   * @param widths Array of column widths
   */
  setColumnWidths(widths: number[]): void {
    this.table.options.columnWidth = widths;
  }
}
