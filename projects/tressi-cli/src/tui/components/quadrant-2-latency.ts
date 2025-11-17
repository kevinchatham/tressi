import contrib from 'blessed-contrib';

import type { QuadrantBufferManager } from '../buffer-manager';
import type {
  Quadrant2LatencyData,
  QuadrantData,
} from '../types/quadrant-data';
import { QuadrantBase } from './base/quadrant-base';

/**
 * Quadrant 2: Latency Component with line chart and gauge views
 */
export class Quadrant2Latency extends QuadrantBase {
  private lineChart: contrib.Widgets.LineElement;
  private gaugeView: contrib.Widgets.GaugeElement | null = null;
  private latencyViewMode: 'line-chart' | 'gauge' = 'line-chart';
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
      'Latency Percentiles Over Time',
      'line-chart',
    );
    this.lineChart = this.element as contrib.Widgets.LineElement;
  }

  /**
   * Create the latency element (line chart by default)
   */
  protected createElement(): contrib.Widgets.LineElement {
    return this.grid.set(
      this.row,
      this.col,
      this.rowSpan,
      this.colSpan,
      contrib.line,
      {
        label: this.getTitleForViewMode(),
        showLegend: true,
        maxY: 1000,
        valign: 'bottom',
        style: {
          line: 'white',
          text: 'white',
          baseline: 'black',
        },
      },
    );
  }

  /**
   * Update the latency component with new data
   */
  update(data: QuadrantData): void {
    if (!this.isQuadrant2LatencyData(data)) {
      this.handleNoDataState('Invalid latency data format');
      return;
    }

    const latencyData = data as Quadrant2LatencyData;

    // Update buffers
    this.updateBuffer(
      'quadrant2-time',
      `${latencyData.elapsedSec.toFixed(0)}s`,
    );
    this.updateBuffer('quadrant2-p50', latencyData.percentiles.p50);
    this.updateBuffer('quadrant2-p95', latencyData.percentiles.p95);
    this.updateBuffer('quadrant2-p99', latencyData.percentiles.p99);
    this.updateBuffer('quadrant2-avg', latencyData.percentiles.avg);
    this.updateBuffer('quadrant2-min', latencyData.percentiles.min);
    this.updateBuffer('quadrant2-max', latencyData.percentiles.max);

    // Render based on current view mode
    if (this.latencyViewMode === 'line-chart') {
      this.renderLineChart();
    } else {
      this.renderGaugeView(latencyData);
    }

    // Update title
    this.updateTitle();
  }

  /**
   * Check if data is Quadrant2LatencyData
   */
  private isQuadrant2LatencyData(
    data: QuadrantData,
  ): data is Quadrant2LatencyData {
    return 'percentiles' in data && 'viewMode' in data;
  }

  /**
   * Render line chart view
   */
  private renderLineChart(): void {
    const timeLabels = this.getBufferData('quadrant2-time') as string[];
    const p50Data = this.getBufferData('quadrant2-p50') as number[];
    const p95Data = this.getBufferData('quadrant2-p95') as number[];
    const p99Data = this.getBufferData('quadrant2-p99') as number[];
    const avgData = this.getBufferData('quadrant2-avg') as number[];

    if (p50Data.length === 0) {
      this.handleNoDataState('No latency data available');
      return;
    }

    const series = [];

    if (p50Data.length > 0) {
      series.push({
        title: 'p50 (median)',
        x: timeLabels,
        y: p50Data.map((x: number) => Math.round(x)),
        style: { line: 'cyan' },
      });
    }

    if (avgData.length > 0) {
      series.push({
        title: 'average',
        x: timeLabels,
        y: avgData.map((x: number) => Math.round(x)),
        style: { line: 'white' },
      });
    }

    if (p95Data.length > 0) {
      series.push({
        title: 'p95',
        x: timeLabels,
        y: p95Data.map((x: number) => Math.round(x)),
        style: { line: 'yellow' },
      });
    }

    if (p99Data.length > 0) {
      series.push({
        title: 'p99',
        x: timeLabels,
        y: p99Data.map((x: number) => Math.round(x)),
        style: { line: 'red' },
      });
    }

    this.lineChart.setData(series);

    // Adjust Y-axis based on current data
    const allValues = [...p50Data, ...p95Data, ...p99Data, ...avgData];
    const maxValue = Math.max(...allValues, 100); // Minimum 100ms for readability
    this.lineChart.options.maxY = Math.ceil(maxValue * 1.1); // Add 10% padding
  }

  /**
   * Render gauge view
   */
  private renderGaugeView(data: Quadrant2LatencyData): void {
    if (!this.gaugeView) {
      this.createGaugeView();
    }

    const { p50, p95, p99 } = data.percentiles;

    // Update gauges with current values and color coding
    this.updateGauge(
      this.gauges[0],
      'p50',
      p50,
      this.getLatencyColor(p50, 50, 100),
    );
    this.updateGauge(
      this.gauges[1],
      'p95',
      p95,
      this.getLatencyColor(p95, 100, 200),
    );
    this.updateGauge(
      this.gauges[2],
      'p99',
      p99,
      this.getLatencyColor(p99, 200, 500),
    );
  }

  /**
   * Create gauge view elements
   */
  private createGaugeView(): void {
    // Clear existing gauges
    this.gauges.forEach((gauge) => {
      if (gauge && gauge.destroy) {
        gauge.destroy();
      }
    });
    this.gauges = [];

    // Create 3 gauges in vertical stack (optimized for 6x6 grid)
    const gaugeHeight = Math.floor(this.rowSpan / 3);

    for (let i = 0; i < 3; i++) {
      const gauge = this.grid.set(
        this.row + i * gaugeHeight,
        this.col,
        gaugeHeight,
        this.colSpan,
        contrib.gauge,
        {
          label: i === 0 ? 'p50 (median)' : i === 1 ? 'p95' : 'p99',
          stroke: 'green',
          fill: 'white',
          width: '50%',
          height: '50%',
          percent: [0],
        },
      );
      this.gauges.push(gauge);
    }

    this.gaugeView = this.gauges[0]; // Reference to first gauge for compatibility
  }

  /**
   * Update individual gauge
   */
  private updateGauge(
    gauge: contrib.Widgets.GaugeElement,
    label: string,
    value: number,
    color: string,
  ): void {
    // Calculate percentage based on reasonable latency thresholds
    const maxLatency = label === 'p50' ? 200 : label === 'p95' ? 500 : 1000;
    const percentage = Math.min((value / maxLatency) * 100, 100);

    gauge.setPercent(percentage);
    gauge.setLabel(`${label}: ${Math.round(value)}ms`);
    gauge.options.stroke = color;
  }

  /**
   * Get color for latency value based on thresholds
   */
  private getLatencyColor(
    value: number,
    yellowThreshold: number,
    redThreshold: number,
  ): string {
    if (value < yellowThreshold) return 'green';
    if (value < redThreshold) return 'yellow';
    return 'red';
  }

  /**
   * Get title for current view mode
   */
  protected getTitleForViewMode(): string {
    const titles = {
      'line-chart': 'Latency Percentiles Over Time',
      gauge: 'Current Latency Percentiles',
    };
    return titles[this.latencyViewMode];
  }

  /**
   * Get cycle indicator for current view mode
   */
  protected getCycleIndicator(): string {
    const modes = ['line-chart', 'gauge'];
    const currentIndex = modes.indexOf(this.latencyViewMode);
    if (currentIndex === -1) return '';
    return `[${currentIndex + 1}/${modes.length}]`;
  }

  /**
   * Toggle between line chart and gauge view
   */
  toggleViewMode(): void {
    this.latencyViewMode =
      this.latencyViewMode === 'line-chart' ? 'gauge' : 'line-chart';

    if (this.latencyViewMode === 'gauge') {
      this.createGaugeView();
    }

    this.updateTitle();
  }

  /**
   * Set view mode
   */
  setViewMode(mode: 'line-chart' | 'gauge'): void {
    this.latencyViewMode = mode;
    if (mode === 'gauge') {
      this.createGaugeView();
    }
    this.updateTitle();
  }

  /**
   * Clear the component data
   */
  clear(): void {
    if (this.latencyViewMode === 'line-chart') {
      this.lineChart.setData([
        {
          title: '',
          x: [],
          y: [],
        },
      ]);
    } else {
      this.gauges.forEach((gauge) => {
        if (gauge) {
          gauge.setPercent(0);
          gauge.setLabel('');
        }
      });
    }

    // Clear buffers
    this.bufferManager.clearBuffer('quadrant2-time');
    this.bufferManager.clearBuffer('quadrant2-p50');
    this.bufferManager.clearBuffer('quadrant2-p95');
    this.bufferManager.clearBuffer('quadrant2-p99');
    this.bufferManager.clearBuffer('quadrant2-avg');
    this.bufferManager.clearBuffer('quadrant2-min');
    this.bufferManager.clearBuffer('quadrant2-max');
  }

  /**
   * Get the underlying line chart element
   */
  getLineChart(): contrib.Widgets.LineElement {
    return this.lineChart;
  }

  /**
   * Get the gauge elements
   */
  getGauges(): contrib.Widgets.GaugeElement[] {
    return this.gauges;
  }
}
