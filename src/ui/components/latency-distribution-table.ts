import contrib from 'blessed-contrib';

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
