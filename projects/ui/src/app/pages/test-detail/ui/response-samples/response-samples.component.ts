import { Component, input, output, signal } from '@angular/core';
import type { IconName, ResponseSample } from '@tressi/shared/ui';

import { CollapsibleCardComponent } from '../../../../components/collapsible-card/collapsible-card.component';
import { IconComponent } from '../../../../components/icon/icon.component';
import { JsonTextareaComponent } from '../../../../components/json-textarea/json-textarea.component';
import { FormatNumberDirective } from '../../../../directives/format/format-number.directive';
import { FormatPercentageDirective } from '../../../../directives/format/format-percentage.directive';

type StatusCategory = 'success' | 'redirect' | 'client-error' | 'server-error';

/**
 * Component for displaying response samples captured during the test
 * Allows filtering by status code and displays headers and body in a collapsible card
 */
@Component({
  imports: [
    CollapsibleCardComponent,
    IconComponent,
    JsonTextareaComponent,
    FormatNumberDirective,
    FormatPercentageDirective,
  ],
  selector: 'app-response-samples',
  templateUrl: './response-samples.component.html',
})
export class ResponseSamplesComponent {
  /** Response samples data */
  readonly responseSamples = input<ResponseSample[] | undefined>();

  /** Status code distribution data */
  readonly statusCodeDistribution = input<Record<string, number> | undefined>();

  /** Total requests count */
  readonly totalRequests = input<number | undefined>();

  /** Whether the card is collapsed */
  readonly collapsed = input<boolean>(false);

  /** Emits when collapsed state changes */
  readonly collapsedChange = output<boolean>();

  readonly selectedStatusCode = signal<string>('all');
  readonly maxSamplesPerCode = 3;

  /**
   * Handle collapsed state change from collapsible card
   */
  onCollapsedChange(collapsed: boolean): void {
    this.collapsedChange.emit(collapsed);
  }

  /**
   * Gets available status codes for filtering, including 'all' option
   */
  getAvailableStatusCodes(): string[] {
    const statusCodeDistribution = this.statusCodeDistribution();
    if (!statusCodeDistribution) return ['all'];

    const codes = Object.keys(statusCodeDistribution)
      .map((code) => parseInt(code, 10))
      .sort((a, b) => a - b)
      .map((code) => code.toString());

    return ['all', ...codes];
  }

  /**
   * Filters samples based on selected status code
   */
  getFilteredSamples(): ResponseSample[] {
    const responseSamples = this.responseSamples();
    if (!responseSamples) return [];

    const samples = responseSamples.slice(0, this.maxSamplesPerCode * 5); // Limit total samples

    if (this.selectedStatusCode() === 'all') {
      return samples;
    }

    return samples.filter((sample) => sample.statusCode.toString() === this.selectedStatusCode());
  }

  /**
   * Formats headers object as JSON string
   */
  formatHeaders(headers: Record<string, string>): string {
    try {
      return JSON.stringify(headers, null, 2);
    } catch {
      return 'Unable to format headers';
    }
  }

  /**
   * Formats body as JSON if possible, otherwise returns as-is
   */
  formatBody(body: string): string {
    try {
      // Try to parse and format as JSON if possible
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // Return as-is if not valid JSON
      return body;
    }
  }

  /**
   * Returns CSS classes for status code badges
   */
  getStatusCodeClasses(statusCode: number): string {
    if (statusCode >= 200 && statusCode < 300) return 'bg-success/20 text-success';
    if (statusCode >= 300 && statusCode < 400) return 'bg-info/20 text-info';
    if (statusCode >= 400 && statusCode < 500) return 'bg-warning/20 text-warning';
    return 'bg-error/20 text-error';
  }

  /**
   * Checks if headers object has any keys
   */
  hasHeaders(headers: Record<string, string>): boolean {
    return headers && Object.keys(headers).length > 0;
  }

  /**
   * Gets the count for a status code (or total for 'all')
   */
  getCount(code: string): number {
    if (code === 'all') {
      return this.responseSamples()?.length || 0;
    }
    return this.statusCodeDistribution()?.[code] || 0;
  }

  /**
   * Gets the percentage for a status code (or 100% for 'all')
   */
  getPercentage(code: string): number {
    if (code === 'all') {
      return 100;
    }
    const totalRequests = this.totalRequests();
    if (!totalRequests || totalRequests === 0) {
      return 0;
    }
    const count = this.statusCodeDistribution()?.[code] || 0;
    return (count / totalRequests) * 100;
  }

  /**
   * Gets the category for a status code
   */
  private _getCategory(code: number): StatusCategory {
    if (code >= 200 && code < 300) return 'success';
    if (code >= 300 && code < 400) return 'redirect';
    if (code >= 400 && code < 500) return 'client-error';
    return 'server-error';
  }

  /**
   * Returns the appropriate icon name for each status code category
   */
  getCategoryIcon(code: string): IconName {
    if (code === 'all') {
      return 'list_alt';
    }
    const category = this._getCategory(parseInt(code, 10));
    switch (category) {
      case 'success':
        return 'check';
      case 'redirect':
        return 'info';
      case 'client-error':
        return 'warning';
      case 'server-error':
        return 'error';
    }
  }

  /**
   * Returns CSS classes for status code category
   */
  getCategoryClasses(code: string): string {
    if (code === 'all') {
      return 'bg-base-300 text-base-content';
    }
    const category = this._getCategory(parseInt(code, 10));
    switch (category) {
      case 'success':
        return 'bg-success/20 text-success';
      case 'redirect':
        return 'bg-info/20 text-info';
      case 'client-error':
        return 'bg-warning/20 text-warning';
      case 'server-error':
        return 'bg-error/20 text-error';
    }
  }
}
