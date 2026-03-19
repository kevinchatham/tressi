import { Component, input, output } from '@angular/core';
import type { LatencyHistogram, LatencyHistogramBucket } from '@tressi/shared/common';

import { CollapsibleCardComponent } from '../../../../components/collapsible-card/collapsible-card.component';
import { IconComponent } from '../../../../components/icon/icon.component';
import { FormatLatencyDirective } from '../../../../directives/format/format-latency.directive';

interface HistogramPercentile {
  label: string;
  percentile: number;
  value: number;
}

/**
 * Component for displaying latency distribution data
 * Shows percentile distribution and summary statistics in a collapsible card
 */
@Component({
  imports: [CollapsibleCardComponent, IconComponent, FormatLatencyDirective],
  selector: 'app-latency-distribution',
  templateUrl: './latency-distribution.component.html',
})
export class LatencyDistributionComponent {
  /** Histogram data */
  readonly histogram = input<LatencyHistogram | undefined>();

  /** Whether the card is collapsed */
  readonly collapsed = input<boolean>(false);

  /** Emits when collapsed state changes */
  readonly collapsedChange = output<boolean>();

  /**
   * Handle collapsed state change from collapsible card
   */
  onCollapsedChange(collapsed: boolean): void {
    this.collapsedChange.emit(collapsed);
  }

  /**
   * Get bucket data for histogram visualization
   */
  getHistogramBuckets(): Array<LatencyHistogramBucket> {
    const histogram = this.histogram();
    if (!histogram?.buckets?.length) return [];

    // Sort by lowerBound to ensure correct display order and avoid UI glitches
    return [...histogram.buckets].sort((a, b) => a.lowerBound - b.lowerBound);
  }

  /**
   * Calculate horizontal bar width as percentage
   */
  getHorizontalBarWidth(count: number): string {
    const histogram = this.histogram();
    if (!histogram?.buckets?.length) return '0%';

    const maxCount = Math.max(...histogram.buckets.map((b) => b.count));
    if (maxCount === 0) return '0%';

    // Use linear scale for horizontal bars (height uses sqrt for vertical)
    const percentage = (count / maxCount) * 100;
    return `${Math.max(percentage, 0)}%`;
  }

  /**
   * Calculate bucket height using sqrt scale for better visual distribution
   */
  getBucketHeight(count: number): string {
    const histogram = this.histogram();
    if (!histogram?.buckets?.length) return '0%';

    const maxCount = Math.max(...histogram.buckets.map((b) => b.count));
    if (maxCount === 0) return '0%';

    // Use sqrt scale to prevent tall bars from dominating
    return `${Math.sqrt(count / maxCount) * 100}%`;
  }

  /**
   * Generate tooltip text for a bucket
   */
  getBucketTooltip(bucket: LatencyHistogramBucket): string {
    const histogram = this.histogram();
    if (!histogram) return '';

    const percentage = ((bucket.count / histogram.totalCount) * 100).toFixed(1);

    return `${this.formatLatency(bucket.lowerBound)} - ${this.formatLatency(
      bucket.upperBound,
    )}: ${bucket.count.toLocaleString()} requests (${percentage}%)`;
  }

  /**
   * Transforms histogram percentile data for display
   */
  getPercentileData(): HistogramPercentile[] {
    const histogram = this.histogram();
    if (!histogram) return [];

    const percentiles = [
      { key: 1, label: '1st (Fastest)' },
      { key: 5, label: '5th' },
      { key: 10, label: '10th' },
      { key: 25, label: '25th' },
      { key: 50, label: '50th (Median)' },
      { key: 75, label: '75th' },
      { key: 90, label: '90th' },
      { key: 95, label: '95th' },
      { key: 99, label: '99th (Slowest)' },
    ];

    return percentiles.map(({ key, label }) => ({
      label,
      percentile: key,
      value: (histogram.percentiles[key] || 0) as number,
    }));
  }

  /**
   * Gets min/max values from histogram
   */
  getMinMax(): { min: number; max: number } | null {
    const histogram = this.histogram();
    if (!histogram) return null;
    return {
      max: histogram.max,
      min: histogram.min,
    };
  }

  /**
   * Formats latency value with appropriate units
   */
  formatLatency(ms: number): string {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  /**
   * Calculates bar width as percentage for visualization
   */
  getBarWidth(value: number, min: number, max: number): string {
    if (max === min) return '100%';
    const percentage = ((value - min) / (max - min)) * 100;
    return `${Math.max(5, percentage)}%`; // Minimum 5% width for visibility
  }

  /**
   * Calculate percentile bar width as percentage of max latency value
   * Used to show relative latency magnitude across percentiles
   */
  getPercentileBarWidth(value: number): string {
    const percentileData = this.getPercentileData();
    if (percentileData.length === 0) return '0%';

    const maxValue = Math.max(...percentileData.map((p) => p.value));
    if (maxValue === 0) return '0%';

    const percentage = (value / maxValue) * 100;
    return `${Math.max(percentage, 0)}%`;
  }
}
