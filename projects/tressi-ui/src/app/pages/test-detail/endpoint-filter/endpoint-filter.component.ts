import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface EndpointMetrics {
  url: string;
  metrics: Array<{
    epoch: number;
    url: string;
    metric: {
      requestsPerSecond: number;
      averageLatency: number;
      errorRate: number;
      totalRequests: number;
    };
  }>;
  summary: {
    avgThroughput: number;
    avgLatency: number;
    avgErrorRate: number;
  };
}

interface MetricsData {
  endpoints?: Array<{
    epoch: number;
    url: string;
    metric: {
      requestsPerSecond: number;
      averageLatency: number;
      errorRate: number;
      totalRequests: number;
    };
  }>;
}

@Component({
  selector: 'app-endpoint-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './endpoint-filter.component.html',
})
export class EndpointFilterComponent {
  readonly endpoints = input<string[]>([]);
  readonly metrics = input<MetricsData | null>(null);

  // Outputs
  readonly filteredEndpoints = output<EndpointMetrics[]>();

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

  private applyFilters(): EndpointMetrics[] {
    const metrics = this.metrics();
    if (!metrics) return [];

    const endpoints = this.groupEndpointMetrics(metrics);

    let filtered = endpoints;

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
        (endpoint) => endpoint.summary.avgThroughput >= this.minThroughput,
      );
    }

    if (this.maxLatency > 0) {
      filtered = filtered.filter(
        (endpoint) => endpoint.summary.avgLatency <= this.maxLatency,
      );
    }

    if (this.maxErrorRate < 100) {
      filtered = filtered.filter(
        (endpoint) => endpoint.summary.avgErrorRate <= this.maxErrorRate,
      );
    }

    this.filteredEndpoints.emit(filtered);
    return filtered;
  }

  private groupEndpointMetrics(metrics: MetricsData): EndpointMetrics[] {
    const endpointMap = new Map<string, EndpointMetrics>();

    for (const endpointMetric of metrics.endpoints || []) {
      const url = endpointMetric.url;
      if (!endpointMap.has(url)) {
        endpointMap.set(url, {
          url,
          metrics: [],
          summary: {
            avgThroughput: 0,
            avgLatency: 0,
            avgErrorRate: 0,
          },
        });
      }
      endpointMap.get(url)!.metrics.push(endpointMetric);
    }

    // Calculate summaries
    for (const endpoint of endpointMap.values()) {
      const values = endpoint.metrics.map((m) => m.metric);
      const avgThroughput =
        values.reduce((sum, m) => sum + m.requestsPerSecond, 0) /
          values.length || 0;
      const avgLatency =
        values.reduce((sum, m) => sum + m.averageLatency, 0) / values.length ||
        0;
      const avgErrorRate =
        values.reduce((sum, m) => sum + m.errorRate, 0) / values.length || 0;

      endpoint.summary = {
        avgThroughput,
        avgLatency,
        avgErrorRate,
      };
    }

    return Array.from(endpointMap.values()).sort((a, b) =>
      a.url.localeCompare(b.url),
    );
  }
}
