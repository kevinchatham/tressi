import contrib from 'blessed-contrib';

import type { AggregatedMetrics } from '../../workers/metrics-aggregator';

/**
 * Manages the latency distribution table component for the terminal UI.
 */
export class LatencyDistributionTable {
  private table: contrib.Widgets.TableElement;

  /**
   * Creates a new latency distribution table component.
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
      label: 'Latency Distribution (ms)',
      interactive: false,
      columnSpacing: 1,
      columnWidth: [15, 10, 15, 15],
    });
  }

  /**
   * Updates the latency distribution table with new data.
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
   * Updates the latency distribution table using a pre-formatted data object.
   * @param tableData Object containing headers and data arrays
   */
  updateFromObject(tableData: { headers: string[]; data: string[][] }): void {
    this.table.setData({
      headers: tableData.headers,
      data: tableData.data.map((row) => row.map((cell) => cell.toString())),
    });
  }

  /**
   * Updates the latency distribution table directly from aggregated metrics.
   * @param endpointMetrics Endpoint metrics data from aggregated metrics
   * @param selectedEndpoint Optional specific endpoint to focus on
   */
  updateFromAggregatedMetrics(
    endpointMetrics: AggregatedMetrics['endpointMetrics'],
    selectedEndpoint?: string,
  ): void {
    let data: string[][] = [];

    if (selectedEndpoint && endpointMetrics[selectedEndpoint]) {
      // Show detailed distribution for selected endpoint
      const metrics = endpointMetrics[selectedEndpoint];
      data = [
        ['Total Requests', metrics.totalRequests.toLocaleString()],
        ['Successful Requests', metrics.successfulRequests.toLocaleString()],
        ['Failed Requests', metrics.failedRequests.toLocaleString()],
        ['Error Rate', `${(metrics.errorRate * 100).toFixed(1)}%`],
        ['Average Latency', `${Math.round(metrics.averageLatency)}ms`],
        ['p50 Latency', `${Math.round(metrics.p50Latency)}ms`],
        ['p95 Latency', `${Math.round(metrics.p95Latency)}ms`],
        ['p99 Latency', `${Math.round(metrics.p99Latency)}ms`],
        ['Min Latency', `${Math.round(metrics.minLatency)}ms`],
        ['Max Latency', `${Math.round(metrics.maxLatency)}ms`],
        ['Requests/sec', metrics.requestsPerSecond.toFixed(1)],
      ];
    } else {
      // Show summary across all endpoints
      const totalRequests = Object.values(endpointMetrics).reduce(
        (sum, metrics) => sum + metrics.totalRequests,
        0,
      );
      const totalSuccessful = Object.values(endpointMetrics).reduce(
        (sum, metrics) => sum + metrics.successfulRequests,
        0,
      );
      const totalFailed = Object.values(endpointMetrics).reduce(
        (sum, metrics) => sum + metrics.failedRequests,
        0,
      );
      const avgLatency =
        Object.values(endpointMetrics).reduce(
          (sum, metrics) =>
            sum + metrics.averageLatency * metrics.totalRequests,
          0,
        ) / totalRequests;

      data = [
        ['Endpoints', Object.keys(endpointMetrics).length.toString()],
        ['Total Requests', totalRequests.toLocaleString()],
        ['Total Successful', totalSuccessful.toLocaleString()],
        ['Total Failed', totalFailed.toLocaleString()],
        [
          'Overall Error Rate',
          `${((totalFailed / totalRequests) * 100).toFixed(1)}%`,
        ],
        ['Average Latency', `${Math.round(avgLatency)}ms`],
      ];

      // Add top 3 endpoints by request count
      const topEndpoints = Object.entries(endpointMetrics)
        .sort(([, a], [, b]) => b.totalRequests - a.totalRequests)
        .slice(0, 3);

      if (topEndpoints.length > 0) {
        data.push(['', '']); // Empty row for separation
        data.push(['Top Endpoints:', '']);
        topEndpoints.forEach(([url, metrics], index) => {
          const shortUrl = url.length > 30 ? url.substring(0, 27) + '...' : url;
          data.push([
            `  ${index + 1}. ${shortUrl}`,
            metrics.totalRequests.toLocaleString(),
          ]);
        });
      }
    }

    this.table.setData({
      headers: ['Metric', 'Value'],
      data: data.map((row) => row.map((cell) => cell.toString())),
    });

    // Update label based on view
    const label = selectedEndpoint
      ? `Latency Distribution - ${selectedEndpoint}`
      : 'Latency Distribution (ms)';
    this.table.setLabel(label);
  }

  /**
   * Clears the table data.
   */
  clear(): void {
    this.table.setData({
      headers: ['Range', 'Count', '% of Total', 'Cumulative'],
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

  /**
   * Sets custom column spacing for the table.
   * @param spacing Column spacing value
   */
  setColumnSpacing(spacing: number): void {
    this.table.options.columnSpacing = spacing;
  }
}
