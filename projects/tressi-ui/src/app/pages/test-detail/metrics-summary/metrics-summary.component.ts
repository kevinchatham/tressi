import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-metrics-summary',
  imports: [CommonModule],
  templateUrl: './metrics-summary.component.html',
})
export class MetricsSummaryComponent {
  @Input() summary: any = null;
  @Input() endpointType: 'global' | 'endpoint' = 'global';

  isGlobalSummary(summary: any): summary is any {
    return this.endpointType === 'global' && summary !== null;
  }

  isEndpointSummary(summary: any): summary is any {
    return this.endpointType === 'endpoint' && summary !== null;
  }

  formatDuration(seconds: number | undefined): string {
    if (!seconds) return '0s';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }

  formatPercentage(value: number | undefined): string {
    if (value === undefined || value === null) return '0.0%';
    return `${value.toFixed(1)}%`;
  }

  formatRps(value: number | undefined): string {
    if (!value) return '0/s';
    return `${Math.round(value)}/s`;
  }

  formatNumber(value: number | undefined): string {
    if (value === undefined || value === null) return '0';
    return value.toLocaleString();
  }
}
