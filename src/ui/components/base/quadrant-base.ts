import blessed from 'blessed';
import contrib from 'blessed-contrib';

import type { QuadrantBufferManager } from '../../buffer-manager';
import type {
  QuadrantComponent,
  QuadrantData,
} from '../../types/quadrant-data';

/**
 * Type guard for elements with setLabel method
 */
function hasSetLabel(
  element: blessed.Widgets.BlessedElement,
): element is blessed.Widgets.BlessedElement & {
  setLabel: (label: string) => void;
} {
  return (
    'setLabel' in element && typeof (element as any).setLabel === 'function'
  );
}

/**
 * Type guard for elements with setContent method
 */
function hasSetContent(
  element: blessed.Widgets.BlessedElement,
): element is blessed.Widgets.BlessedElement & {
  setContent: (content: string) => void;
} {
  return (
    'setContent' in element && typeof (element as any).setContent === 'function'
  );
}

/**
 * Abstract base class for all quadrant components with common functionality
 */
export abstract class QuadrantBase implements QuadrantComponent {
  protected element: blessed.Widgets.BlessedElement;
  protected bufferManager: QuadrantBufferManager;
  protected currentViewMode: string;
  protected title: string;
  protected grid: contrib.grid;
  protected row: number;
  protected col: number;
  protected rowSpan: number;
  protected colSpan: number;

  constructor(
    grid: contrib.grid,
    row: number,
    col: number,
    rowSpan: number,
    colSpan: number,
    bufferManager: QuadrantBufferManager,
    title: string,
    defaultViewMode: string,
  ) {
    this.grid = grid;
    this.row = row;
    this.col = col;
    this.rowSpan = rowSpan;
    this.colSpan = colSpan;
    this.bufferManager = bufferManager;
    this.title = title;
    this.currentViewMode = defaultViewMode;
    this.element = this.createElement();
  }

  /**
   * Abstract method to create the blessed element for this quadrant
   */
  protected abstract createElement(): blessed.Widgets.BlessedElement;

  /**
   * Update the quadrant with new data
   */
  abstract update(data: QuadrantData): void;

  /**
   * Clear the quadrant data
   */
  abstract clear(): void;

  /**
   * Get the underlying blessed element
   */
  getElement(): blessed.Widgets.BlessedElement {
    return this.element;
  }

  /**
   * Set the view mode for this quadrant
   */
  setViewMode(mode: string): void {
    this.currentViewMode = mode;
    this.updateTitle();
  }

  /**
   * Get the current view mode
   */
  getViewMode(): string {
    return this.currentViewMode;
  }

  /**
   * Update the title of the quadrant based on current view mode
   */
  protected updateTitle(): void {
    if (hasSetLabel(this.element)) {
      const title = this.getTitleForViewMode();
      const cycleIndicator = this.getCycleIndicator();
      const fullTitle = cycleIndicator ? `${title} ${cycleIndicator}` : title;
      this.element.setLabel(fullTitle);
    }
  }

  /**
   * Get cycle indicator for current view mode (e.g., "[1/3]")
   */
  protected getCycleIndicator(): string {
    // Override in subclasses to provide specific cycle indicators
    return '';
  }

  /**
   * Get the title for the current view mode
   */
  protected abstract getTitleForViewMode(): string;

  /**
   * Handle error states with standardized formatting
   */
  protected handleErrorState(message: string, isWarning = false): void {
    const symbol = isWarning ? '⚠' : '✗';
    const content = `${symbol} ${message}\n[Waiting for data...]`;

    if (hasSetContent(this.element)) {
      this.element.setContent(content);
    }

    this.updateTitleWithSuffix(isWarning ? 'Warning' : 'Error');
  }

  /**
   * Handle no data state
   */
  protected handleNoDataState(message = 'No data available'): void {
    const content = `⚠ ${message}\n[Waiting for data...]`;

    if (hasSetContent(this.element)) {
      this.element.setContent(content);
    }

    this.updateTitleWithSuffix('No Data');
  }

  /**
   * Update title with a suffix
   */
  protected updateTitleWithSuffix(suffix: string): void {
    if (hasSetLabel(this.element)) {
      const baseTitle = this.getTitleForViewMode();
      this.element.setLabel(`${baseTitle}: ${suffix}`);
    }
  }

  /**
   * Get buffer data for this quadrant
   */
  protected getBufferData(bufferId: string): (string | number)[] {
    return this.bufferManager.getAllData(bufferId);
  }

  /**
   * Update buffer with new data
   */
  protected updateBuffer(bufferId: string, data: string | number): void {
    this.bufferManager.update(bufferId, data);
  }

  /**
   * Throttled buffer update
   */
  protected throttledUpdateBuffer(
    bufferId: string,
    data: string | number,
    throttleMs = 500,
  ): void {
    this.bufferManager.throttledUpdate(bufferId, data, throttleMs);
  }

  /**
   * Format number with proper precision
   */
  protected formatNumber(value: number, decimals = 1): string {
    return value.toFixed(decimals);
  }

  /**
   * Format percentage
   */
  protected formatPercentage(
    value: number,
    total: number,
    decimals = 1,
  ): string {
    if (total === 0) return '0.0%';
    return ((value / total) * 100).toFixed(decimals) + '%';
  }

  /**
   * Get color based on percentage thresholds
   */
  protected getColorForPercentage(percentage: number): string {
    if (percentage < 60) return 'green';
    if (percentage < 85) return 'yellow';
    return 'red';
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Override in subclasses if needed
  }
}
