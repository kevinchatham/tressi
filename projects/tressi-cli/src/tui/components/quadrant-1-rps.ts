import contrib from 'blessed-contrib';

import type { QuadrantBufferManager } from '../buffer-manager';
import type { Quadrant1RPSData, QuadrantData } from '../types/quadrant-data';
import { QuadrantBase } from './base/quadrant-base';

/**
 * Quadrant 1: RPS Chart Component with multiple view modes
 */
export class Quadrant1RPS extends QuadrantBase {
  private lineChart: contrib.Widgets.LineElement;
  private rpsViewMode: 'actual-target' | 'success-error' | 'all-metrics' =
    'actual-target';
  private viewModeCycle: ('actual-target' | 'success-error' | 'all-metrics')[] =
    ['actual-target', 'success-error', 'all-metrics'];

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
      'Requests Per Second: Actual vs Target',
      'actual-target',
    );
    this.lineChart = this.element as contrib.Widgets.LineElement;
  }

  /**
   * Create the line chart element
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
        maxY: 100,
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
   * Update the RPS chart with new data
   */
  update(data: QuadrantData): void {
    if (!this.isQuadrant1RPSData(data)) {
      this.handleNoDataState('Invalid data format');
      return;
    }

    const rpsData = data as Quadrant1RPSData;

    // Update buffers
    this.updateBuffer('quadrant1-time', `${rpsData.elapsedSec.toFixed(0)}s`);
    this.updateBuffer('quadrant1-actual-rps', rpsData.actualRPS);
    this.updateBuffer('quadrant1-target-rps', rpsData.targetRPS || 0);
    this.updateBuffer('quadrant1-success-rps', rpsData.successRPS);
    this.updateBuffer('quadrant1-error-rps', rpsData.errorRPS);

    // Smart error detection: auto-switch to success-error view when errors are detected
    this.handleSmartErrorDetection(rpsData);

    // Render based on current view mode
    switch (this.rpsViewMode) {
      case 'actual-target':
        this.renderActualVsTarget(rpsData);
        break;
      case 'success-error':
        this.renderSuccessVsError(rpsData);
        break;
      case 'all-metrics':
        this.renderAllMetrics(rpsData);
        break;
    }

    // Update title
    this.updateTitle();
  }

  /**
   * Check if data is Quadrant1RPSData
   */
  private isQuadrant1RPSData(data: QuadrantData): data is Quadrant1RPSData {
    return (
      'actualRPS' in data &&
      'successRPS' in data &&
      'errorRPS' in data &&
      'viewMode' in data
    );
  }

  /**
   * Render actual vs target RPS view
   */
  private renderActualVsTarget(data: Quadrant1RPSData): void {
    const timeLabels = this.getBufferData('quadrant1-time') as string[];
    const actualRPS = this.getBufferData('quadrant1-actual-rps') as number[];
    const targetRPS = this.getBufferData('quadrant1-target-rps') as number[];

    if (actualRPS.length === 0) {
      this.handleNoDataState('No RPS data available');
      return;
    }

    const series = [];

    if (actualRPS.length > 0) {
      series.push({
        title: 'Actual RPS',
        x: timeLabels,
        y: actualRPS.map((x: number) => Math.round(x)),
        style: { line: 'white' },
      });
    }

    if (targetRPS.length > 0 && data.targetRPS && data.targetRPS > 0) {
      series.push({
        title: 'Target RPS',
        x: timeLabels,
        y: targetRPS.map((x: number) => Math.round(x)),
        style: { line: 'yellow' },
      });
    }

    this.lineChart.setData(series);

    // Adjust Y-axis based on target RPS
    const maxTarget = Math.max(...targetRPS, data.targetRPS || 0);
    const maxActual = Math.max(...actualRPS);
    const maxY = Math.max(maxTarget * 1.5, maxActual * 1.1, 100);
    this.lineChart.options.maxY = Math.ceil(maxY);
  }

  /**
   * Handle smart error detection - auto-switch to success-error view when errors are detected
   */
  private handleSmartErrorDetection(data: Quadrant1RPSData): void {
    // Only auto-switch if we're currently in actual-target mode and errors are detected
    if (this.rpsViewMode === 'actual-target' && data.errorRPS > 0) {
      // Auto-switch to success-error view when errors are detected
      this.rpsViewMode = 'success-error';
    }
  }

  /**
   * Render success vs error RPS view
   */
  private renderSuccessVsError(data: Quadrant1RPSData): void {
    const timeLabels = this.getBufferData('quadrant1-time') as string[];
    const successRPS = this.getBufferData('quadrant1-success-rps') as number[];
    const errorRPS = this.getBufferData('quadrant1-error-rps') as number[];

    if (successRPS.length === 0 && errorRPS.length === 0) {
      this.handleNoDataState('No request data available');
      return;
    }

    // Check if there are any errors in the current data
    const hasErrors = errorRPS.some((x: number) => x > 0) || data.errorRPS > 0;

    if (!hasErrors) {
      // Show "No errors detected" message when in success-error mode with no errors
      this.handleNoErrorsDetected();
      return;
    }

    const series = [];

    if (successRPS.length > 0) {
      series.push({
        title: 'Success RPS',
        x: timeLabels,
        y: successRPS.map((x: number) => Math.round(x)),
        style: { line: 'green' },
      });
    }

    if (errorRPS.length > 0 && errorRPS.some((x: number) => x > 0)) {
      series.push({
        title: 'Error RPS',
        x: timeLabels,
        y: errorRPS.map((x: number) => Math.round(x)),
        style: { line: 'red' },
      });
    }

    this.lineChart.setData(series);

    // Adjust Y-axis
    const maxSuccess = Math.max(...successRPS, 0);
    const maxError = Math.max(...errorRPS, 0);
    const maxY = Math.max(maxSuccess * 1.1, maxError * 1.1, 100);
    this.lineChart.options.maxY = Math.ceil(maxY);
  }

  /**
   * Handle "No errors detected" state
   */
  private handleNoErrorsDetected(): void {
    const content = `✅ No errors detected\n\nAll requests are successful!\n[Monitoring for errors...]`;

    if (this.lineChart.setContent) {
      this.lineChart.setContent(content);
    }

    // Update title to indicate no errors
    this.updateTitleWithSuffix('No Errors');
  }

  /**
   * Render all metrics view
   */
  private renderAllMetrics(data: Quadrant1RPSData): void {
    const timeLabels = this.getBufferData('quadrant1-time') as string[];
    const actualRPS = this.getBufferData('quadrant1-actual-rps') as number[];
    const targetRPS = this.getBufferData('quadrant1-target-rps') as number[];
    const successRPS = this.getBufferData('quadrant1-success-rps') as number[];
    const errorRPS = this.getBufferData('quadrant1-error-rps') as number[];

    if (actualRPS.length === 0) {
      this.handleNoDataState('No RPS data available');
      return;
    }

    const series = [];

    if (actualRPS.length > 0) {
      series.push({
        title: 'Actual RPS',
        x: timeLabels,
        y: actualRPS.map((x: number) => Math.round(x)),
        style: { line: 'white' },
      });
    }

    if (targetRPS.length > 0 && data.targetRPS && data.targetRPS > 0) {
      series.push({
        title: 'Target RPS',
        x: timeLabels,
        y: targetRPS.map((x: number) => Math.round(x)),
        style: { line: 'yellow' },
      });
    }

    if (successRPS.length > 0) {
      series.push({
        title: 'Success RPS',
        x: timeLabels,
        y: successRPS.map((x: number) => Math.round(x)),
        style: { line: 'green' },
      });
    }

    if (errorRPS.length > 0 && errorRPS.some((x: number) => x > 0)) {
      series.push({
        title: 'Error RPS',
        x: timeLabels,
        y: errorRPS.map((x: number) => Math.round(x)),
        style: { line: 'red' },
      });
    }

    this.lineChart.setData(series);

    // Adjust Y-axis
    const maxActual = Math.max(...actualRPS);
    const maxTarget = Math.max(...targetRPS, data.targetRPS || 0);
    const maxSuccess = Math.max(...successRPS, 0);
    const maxError = Math.max(...errorRPS, 0);
    const maxY = Math.max(
      maxActual * 1.1,
      maxTarget * 1.1,
      maxSuccess * 1.1,
      maxError * 1.1,
      100,
    );
    this.lineChart.options.maxY = Math.ceil(maxY);
  }

  /**
   * Get title for current view mode
   */
  protected getTitleForViewMode(): string {
    const titles = {
      'actual-target': 'Requests Per Second: Actual vs Target',
      'success-error': 'Requests Per Second: Success vs Errors',
      'all-metrics': 'Requests Per Second: All Metrics',
    };
    return titles[this.rpsViewMode];
  }

  /**
   * Get cycle indicator for current view mode
   */
  protected getCycleIndicator(): string {
    const currentIndex = this.viewModeCycle.indexOf(this.rpsViewMode);
    if (currentIndex === -1) return '';
    return `[${currentIndex + 1}/${this.viewModeCycle.length}]`;
  }

  /**
   * Cycle to next view mode
   */
  cycleViewMode(): void {
    const currentIndex = this.viewModeCycle.indexOf(this.rpsViewMode);
    const nextIndex = (currentIndex + 1) % this.viewModeCycle.length;
    this.rpsViewMode = this.viewModeCycle[nextIndex];
    this.setViewMode(this.rpsViewMode);
  }

  /**
   * Set view mode
   */
  setViewMode(mode: 'actual-target' | 'success-error' | 'all-metrics'): void {
    this.rpsViewMode = mode;
    this.updateTitle();
  }

  /**
   * Clear the chart data
   */
  clear(): void {
    this.lineChart.setData([
      {
        title: '',
        x: [],
        y: [],
      },
    ]);

    // Clear buffers
    this.bufferManager.clearBuffer('quadrant1-time');
    this.bufferManager.clearBuffer('quadrant1-actual-rps');
    this.bufferManager.clearBuffer('quadrant1-target-rps');
    this.bufferManager.clearBuffer('quadrant1-success-rps');
    this.bufferManager.clearBuffer('quadrant1-error-rps');
  }

  /**
   * Get the underlying line chart element
   */
  getLineChart(): contrib.Widgets.LineElement {
    return this.lineChart;
  }
}
