import contrib from 'blessed-contrib';

/**
 * Manages the latency chart component for the terminal UI.
 */
export class LatencyChart {
  private chart: contrib.Widgets.LineElement;
  private historicalData: number[] = [];

  /**
   * Creates a new latency chart component.
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
    this.chart = grid.set(row, col, rowSpan, colSpan, contrib.line, {
      label: 'Avg Latency (ms)',
      showLegend: false,
      maxY: 1000,
      valign: 'bottom',
    });
  }

  /**
   * Updates the latency chart with new data.
   * @param latencyData Array of latency values
   * @param timeLabels Array of time labels for x-axis
   */
  update(latencyData: number[], timeLabels: string[]): void {
    this.historicalData = [...latencyData];

    if (latencyData.length === 0) {
      this.chart.setData([
        {
          title: 'Latency',
          x: [],
          y: [],
        },
      ]);
      return;
    }

    this.chart.setData([
      {
        title: 'Latency',
        x: timeLabels,
        y: latencyData.map((x: number) => Math.round(x)),
      },
    ]);
  }

  /**
   * Gets the current chart data.
   * @returns Current historical data
   */
  getData(): number[] {
    return [...this.historicalData];
  }

  /**
   * Clears the chart data.
   */
  clear(): void {
    this.historicalData = [];
    this.chart.setData([
      {
        title: 'Latency',
        x: [],
        y: [],
      },
    ]);
  }

  /**
   * Gets the underlying blessed-contrib chart element.
   * @returns The chart element
   */
  getElement(): contrib.Widgets.LineElement {
    return this.chart;
  }
}
