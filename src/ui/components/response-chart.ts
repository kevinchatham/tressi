import contrib from 'blessed-contrib';

/**
 * Manages the response code chart component for the terminal UI.
 */
export class ResponseChart {
  private chart: contrib.Widgets.LineElement;
  private historicalData: {
    success: number[];
    redirect: number[];
    clientError: number[];
    serverError: number[];
  } = {
    success: [],
    redirect: [],
    clientError: [],
    serverError: [],
  };

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
      showLegend: false,
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
    this.historicalData = {
      success: [...responseData.success],
      redirect: [...responseData.redirect],
      clientError: [...responseData.clientError],
      serverError: [...responseData.serverError],
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
   * Gets the current chart data.
   * @returns Current historical data
   */
  getData(): {
    success: number[];
    redirect: number[];
    clientError: number[];
    serverError: number[];
  } {
    return {
      success: [...this.historicalData.success],
      redirect: [...this.historicalData.redirect],
      clientError: [...this.historicalData.clientError],
      serverError: [...this.historicalData.serverError],
    };
  }

  /**
   * Clears the chart data.
   */
  clear(): void {
    this.historicalData = {
      success: [],
      redirect: [],
      clientError: [],
      serverError: [],
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
