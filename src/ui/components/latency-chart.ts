import contrib from 'blessed-contrib';

import type { AggregatedMetrics } from '../../workers/metrics-aggregator';

/**
 * Manages the latency chart component for the terminal UI.
 */
export class LatencyChart {
  private chart: contrib.Widgets.LineElement;
  private historicalData: {
    p50: number[];
    p95: number[];
    p99: number[];
    avg: number[];
    min: number[];
    max: number[];
  } = {
    p50: [],
    p95: [],
    p99: [],
    avg: [],
    min: [],
    max: [],
  };

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
      label: 'Latency Percentiles (ms)',
      showLegend: true,
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
    // Store as average latency for backward compatibility
    this.historicalData.avg = [...latencyData];

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
        title: 'Avg Latency',
        x: timeLabels,
        y: latencyData.map((x: number) => Math.round(x)),
      },
    ]);
  }

  /**
   * Updates the latency chart directly from aggregated metrics with percentile bands.
   * @param metrics The aggregated metrics from worker threads
   * @param timeLabels Array of time labels for x-axis
   * @param historicalPercentiles Historical percentile data over time
   */
  updateFromAggregatedMetrics(
    metrics: AggregatedMetrics,
    timeLabels: string[],
    historicalPercentiles: {
      p50: number[];
      p95: number[];
      p99: number[];
      avg: number[];
      min: number[];
      max: number[];
    },
  ): void {
    this.historicalData = { ...historicalPercentiles };

    const series = [];

    // Add percentile bands with different colors and styles
    if (historicalPercentiles.p50.length > 0) {
      series.push({
        title: 'p50 (median)',
        x: timeLabels,
        y: historicalPercentiles.p50.map((x: number) => Math.round(x)),
        style: { line: 'cyan' },
      });
    }

    if (historicalPercentiles.avg.length > 0) {
      series.push({
        title: 'average',
        x: timeLabels,
        y: historicalPercentiles.avg.map((x: number) => Math.round(x)),
        style: { line: 'white' },
      });
    }

    if (historicalPercentiles.p95.length > 0) {
      series.push({
        title: 'p95',
        x: timeLabels,
        y: historicalPercentiles.p95.map((x: number) => Math.round(x)),
        style: { line: 'yellow' },
      });
    }

    if (historicalPercentiles.p99.length > 0) {
      series.push({
        title: 'p99',
        x: timeLabels,
        y: historicalPercentiles.p99.map((x: number) => Math.round(x)),
        style: { line: 'red' },
      });
    }

    // Add range indicators (min/max) as dotted lines if available
    if (historicalPercentiles.min.length > 0) {
      series.push({
        title: 'min',
        x: timeLabels,
        y: historicalPercentiles.min.map((x: number) => Math.round(x)),
        style: { line: 'green' },
      });
    }

    if (historicalPercentiles.max.length > 0) {
      series.push({
        title: 'max',
        x: timeLabels,
        y: historicalPercentiles.max.map((x: number) => Math.round(x)),
        style: { line: 'magenta' },
      });
    }

    if (series.length === 0) {
      this.chart.setData([
        {
          title: '',
          x: [],
          y: [],
        },
      ]);
    } else {
      this.chart.setData(series);
    }

    // Update chart label with worker context
    const workerContext =
      metrics.threads > 1 ? ` (${metrics.threads} workers)` : '';
    this.chart.setLabel(`Latency Percentiles (ms)${workerContext}`);

    // Adjust max Y axis based on current data range
    const allValues = [
      ...historicalPercentiles.p50,
      ...historicalPercentiles.p95,
      ...historicalPercentiles.p99,
      ...historicalPercentiles.avg,
      ...historicalPercentiles.max,
    ];
    const maxValue = Math.max(...allValues, 100); // Minimum 100ms for readability
    this.chart.options.maxY = Math.ceil(maxValue * 1.1); // Add 10% padding
  }

  /**
   * Gets the current chart data.
   * @returns Current historical data
   */
  getData(): {
    p50: number[];
    p95: number[];
    p99: number[];
    avg: number[];
    min: number[];
    max: number[];
  } {
    return { ...this.historicalData };
  }

  /**
   * Clears the chart data.
   */
  clear(): void {
    this.historicalData = {
      p50: [],
      p95: [],
      p99: [],
      avg: [],
      min: [],
      max: [],
    };
    this.chart.setData([
      {
        title: '',
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
