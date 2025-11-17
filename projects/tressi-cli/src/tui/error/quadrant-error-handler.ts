import type blessed from 'blessed';

import type { QuadrantComponent } from '../types/quadrant-data';

/**
 * Handles error states for quadrant components with standardized formatting
 */
export class QuadrantErrorHandler {
  /**
   * Handle no data available state
   */
  static handleNoData(
    quadrant: QuadrantComponent,
    message = 'No data available',
  ): void {
    const content = `⚠ ${message}\n[Waiting for data...]`;

    if (hasSetContent(quadrant.getElement())) {
      quadrant.getElement().setContent(content);
    }

    this.updateTitleWithSuffix(quadrant, 'No Data');
  }

  /**
   * Handle connection error state
   */
  static handleConnectionError(
    quadrant: QuadrantComponent,
    retryInSeconds: number,
  ): void {
    const content = `⚠ Connection lost\nRetrying in ${retryInSeconds}s...\n[Reconnecting...]`;

    if (hasSetContent(quadrant.getElement())) {
      quadrant.getElement().setContent(content);
    }

    this.updateTitleWithSuffix(quadrant, 'Error');
  }

  /**
   * Handle partial data state
   */
  static handlePartialData(
    quadrant: QuadrantComponent,
    availableMetrics: string[],
  ): void {
    const content =
      availableMetrics.length > 0
        ? `⚠ Partial data available:\n${availableMetrics.join('\n')}\n⚠ Some metrics missing`
        : '⚠ No metrics available';

    if (hasSetContent(quadrant.getElement())) {
      quadrant.getElement().setContent(content);
    }
  }

  /**
   * Handle generic error state
   */
  static handleError(quadrant: QuadrantComponent, error: Error | string): void {
    const message = error instanceof Error ? error.message : error;
    const content = `✗ Error: ${message}\n[Please check configuration]`;

    if (hasSetContent(quadrant.getElement())) {
      quadrant.getElement().setContent(content);
    }

    this.updateTitleWithSuffix(quadrant, 'Error');
  }

  /**
   * Update quadrant title with suffix
   */
  private static updateTitleWithSuffix(
    quadrant: QuadrantComponent,
    suffix: string,
  ): void {
    const element = quadrant.getElement();
    if (hasSetLabel(element)) {
      const currentLabel = this.getCurrentLabel(element);
      const baseTitle = currentLabel.split(':')[0];
      element.setLabel(`${baseTitle}: ${suffix}`);
    }
  }

  /**
   * Get current label from element
   */
  private static getCurrentLabel(
    element: blessed.Widgets.BlessedElement,
  ): string {
    if (hasGetLabel(element)) {
      return element.getLabel();
    }
    return 'Unknown';
  }
}

/**
 * Type guard for elements with setLabel method
 */
function hasSetLabel(
  element: blessed.Widgets.BlessedElement,
): element is blessed.Widgets.BlessedElement & {
  setLabel: (label: string) => void;
} {
  const el = element as unknown as Record<string, unknown>;
  return 'setLabel' in el && typeof el.setLabel === 'function';
}

/**
 * Type guard for elements with setContent method
 */
function hasSetContent(
  element: blessed.Widgets.BlessedElement,
): element is blessed.Widgets.BlessedElement & {
  setContent: (content: string) => void;
} {
  const el = element as unknown as Record<string, unknown>;
  return 'setContent' in el && typeof el.setContent === 'function';
}

/**
 * Type guard for elements with getLabel method
 */
function hasGetLabel(
  element: blessed.Widgets.BlessedElement,
): element is blessed.Widgets.BlessedElement & { getLabel: () => string } {
  const el = element as unknown as Record<string, unknown>;
  return 'getLabel' in el && typeof el.getLabel === 'function';
}
