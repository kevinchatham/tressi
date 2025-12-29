import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  EndpointMetricDocument,
  TestMetrics,
} from '../../../services/rpc.service';

@Component({
  selector: 'app-endpoint-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './endpoint-filter.component.html',
})
export class EndpointFilterComponent {
  readonly endpoints = input<string[]>([]);
  readonly metrics = input<TestMetrics | null>(null);

  // Outputs
  readonly filteredEndpoints = output<EndpointMetricDocument[]>();

  // State
  searchQuery = '';
  minThroughput = 0;
  maxLatency = 0;
  maxErrorRate = 100;

  // Computed properties
  get filteredCount(): number {
    return this.applyFilters().length;
  }

  get totalCount(): number {
    return this.endpoints().length;
  }

  ngOnInit(): void {
    this.applyFilters();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.minThroughput = 0;
    this.maxLatency = 0;
    this.maxErrorRate = 100;
    this.applyFilters();
  }

  hasActiveFilters(): boolean {
    return (
      this.searchQuery.trim() !== '' ||
      this.minThroughput > 0 ||
      this.maxLatency > 0 ||
      this.maxErrorRate < 100
    );
  }

  private applyFilters(): EndpointMetricDocument[] {
    const metrics = this.metrics();
    if (!metrics) return [];

    let filtered = metrics.endpoints || [];

    // Apply search filter
    if (this.searchQuery.trim()) {
      const searchLower = this.searchQuery.toLowerCase();
      filtered = filtered.filter((endpoint) =>
        endpoint.url.toLowerCase().includes(searchLower),
      );
    }

    // Apply performance filters
    if (this.minThroughput > 0) {
      filtered = filtered.filter(
        (endpoint) => endpoint.metric.requestsPerSecond >= this.minThroughput,
      );
    }

    if (this.maxLatency > 0) {
      filtered = filtered.filter(
        (endpoint) => endpoint.metric.averageLatency <= this.maxLatency,
      );
    }

    if (this.maxErrorRate < 100) {
      filtered = filtered.filter(
        (endpoint) => endpoint.metric.errorRate <= this.maxErrorRate,
      );
    }

    this.filteredEndpoints.emit(filtered);
    return filtered;
  }
}
