import contrib from 'blessed-contrib';

import type { AggregatedMetrics } from '../../workers/metrics-aggregator';

/**
 * Manages the response code chart component for the terminal UI.
 */
export class ResponseChart {
  private chart: contrib.Widgets.LineElement;
  private historicalData: {
    [statusCode: string]: number[];
  } = {};
  private currentView: 'global' | 'endpoint' = 'global';
  private selectedEndpoint: string | null = null;

  /**
   * Creates a new response code chart component.
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
      label: 'Response Codes Over Time',
      showLegend: true,
      valign: 'bottom',
      wholeNumbersOnly: true,
    });
  }

  /**
   * Updates the response code chart with new data.
   * @param responseData Response code data for each category
   * @param timeLabels Array of time labels for x-axis
   */
  update(
    responseData: {
      success: number[];
      redirect: number[];
      clientError: number[];
      serverError: number[];
    },
    timeLabels: string[],
  ): void {
    // Convert category data to status code format for backward compatibility
    this.historicalData = {
      '2xx': [...responseData.success],
      '3xx': [...responseData.redirect],
      '4xx': [...responseData.clientError],
      '5xx': [...responseData.serverError],
    };

    const series = [];

    if (responseData.success.some((v: number) => v > 0)) {
      series.push({
        title: '2xx',
        x: timeLabels,
        y: responseData.success,
        style: { line: 'green' },
      });
    }
    if (responseData.redirect.some((v: number) => v > 0)) {
      series.push({
        title: '3xx',
        x: timeLabels,
        y: responseData.redirect,
        style: { line: 'yellow' },
      });
    }
    if (responseData.clientError.some((v: number) => v > 0)) {
      series.push({
        title: '4xx',
        x: timeLabels,
        y: responseData.clientError,
        style: { line: 'red' },
      });
    }
    if (responseData.serverError.some((v: number) => v > 0)) {
      series.push({
        title: '5xx',
        x: timeLabels,
        y: responseData.serverError,
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
  }

  /**
   * Updates the response code chart directly from aggregated metrics.
   * @param metrics The aggregated metrics from worker threads
   * @param timeLabels Array of time labels for x-axis
   * @param historicalData Historical status code data over time
   */
  updateFromAggregatedMetrics(
    metrics: AggregatedMetrics,
    timeLabels: string[],
    historicalData: { [statusCode: string]: number[] },
  ): void {
    this.historicalData = { ...historicalData };

    // Get status codes to display based on current view
    const statusCodesToDisplay = this.getStatusCodesToDisplay(metrics);

    const series = [];

    // Display individual status codes with color coding
    for (const [statusCode, counts] of Object.entries(historicalData)) {
      const codeNum = parseInt(statusCode);
      if (
        counts.some((v: number) => v > 0) &&
        statusCodesToDisplay.includes(codeNum)
      ) {
        const color = this.getStatusCodeColor(codeNum);
        series.push({
          title: statusCode,
          x: timeLabels,
          y: counts,
          style: { line: color },
        });
      }
    }

    // If no data, show empty chart
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

    // Update chart label based on view
    const viewLabel =
      this.currentView === 'endpoint' && this.selectedEndpoint
        ? `Response Codes - ${this.selectedEndpoint}`
        : 'Response Codes Over Time';
    this.chart.setLabel(viewLabel);
  }

  /**
   * Gets status codes to display based on current view and settings.
   * @param metrics Current aggregated metrics
   * @returns Array of status codes to display
   */
  private getStatusCodesToDisplay(metrics: AggregatedMetrics): number[] {
    const statusCodeDistribution =
      this.currentView === 'endpoint' && this.selectedEndpoint
        ? metrics.endpointMetrics[this.selectedEndpoint]
            ?.statusCodeDistribution || {}
        : metrics.statusCodeDistribution;

    // Get top status codes by count
    const sortedCodes = Object.entries(statusCodeDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8) // Limit to top 8 status codes for readability
      .map(([code]) => parseInt(code));

    return sortedCodes.length > 0 ? sortedCodes : [200, 404, 500]; // Default codes if no data
  }

  /**
   * Gets color for status code based on its range.
   * @param statusCode HTTP status code
   * @returns Color string for the status code
   */
  private getStatusCodeColor(statusCode: number): string {
    if (statusCode >= 200 && statusCode < 300) return 'green';
    if (statusCode >= 300 && statusCode < 400) return 'yellow';
    if (statusCode >= 400 && statusCode < 500) return 'red';
    if (statusCode >= 500 && statusCode < 600) return 'magenta';
    return 'white';
  }

  /**
   * Toggles between global and per-endpoint view.
   * @param endpoint Optional endpoint URL for per-endpoint view
   */
  toggleView(endpoint?: string): void {
    if (this.currentView === 'global' && endpoint) {
      this.currentView = 'endpoint';
      this.selectedEndpoint = endpoint;
    } else {
      this.currentView = 'global';
      this.selectedEndpoint = null;
    }
  }

  /**
   * Gets the current chart data.
   * @returns Current historical data
   */
  getData(): { [statusCode: string]: number[] } {
    return { ...this.historicalData };
  }

  /**
   * Clears the chart data.
   */
  clear(): void {
    this.historicalData = {};
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
