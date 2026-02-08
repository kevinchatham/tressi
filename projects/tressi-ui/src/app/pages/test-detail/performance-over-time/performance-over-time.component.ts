import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

import { CollapsibleCardComponent } from '../../../components/collapsible-card/collapsible-card.component';
import { IconComponent } from '../../../components/icon/icon.component';
import { LineChartComponent } from '../../../components/line-chart/line-chart.component';
import { ChartData, ChartOption, ChartType } from '../../../types/chart.types';

/**
 * Component for displaying performance metrics over time with charts
 * Extracted from test-detail.component.html lines 302-361
 */
@Component({
  selector: 'app-performance-over-time',
  imports: [
    CommonModule,
    CollapsibleCardComponent,
    IconComponent,
    LineChartComponent,
  ],
  templateUrl: './performance-over-time.component.html',
})
export class PerformanceOverTimeComponent {
  /** Currently selected chart type */
  readonly selectedChartType = input<ChartType>('peak_throughput');

  /** Currently selected endpoint */
  readonly selectedEndpoint = input<string>('global');

  /** Available chart options for the dropdown */
  readonly chartOptions = input<ChartOption[]>([]);

  /** Test time range for chart x-axis */
  readonly testTimeRange = input<{ min: number; max: number } | null>(null);

  /** Whether chart data is available */
  readonly hasChartData = input<boolean>(false);

  /** Y-axis label for the chart */
  readonly yAxisLabel = input<string>('Value');

  /** Unique chart ID for synchronization */
  readonly chartId = input<string>('chart');

  /** Chart data for the line chart */
  readonly chartData = input<ChartData>({ data: [], labels: [] });

  /** Whether the card is collapsed */
  readonly collapsed = input<boolean>(false);

  /** Emits when chart type changes */
  readonly chartTypeChange = output<ChartType>();

  /** Emits when collapsed state changes */
  readonly collapsedChange = output<boolean>();

  /**
   * Handle chart type selection change
   */
  onChartTypeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const value = target.value as ChartType;
    this.chartTypeChange.emit(value);
  }

  /**
   * Handle collapsed state change from collapsible card
   */
  onCollapsedChange(collapsed: boolean): void {
    this.collapsedChange.emit(collapsed);
  }
}
