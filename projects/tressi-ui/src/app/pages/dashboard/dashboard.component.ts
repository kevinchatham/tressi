import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { defaultTressiConfig } from 'tressi-common/config';
import { AggregatedMetrics } from 'tressi-common/metrics';

import { IconComponent } from '../../components/icon/icon.component';
import { LineChartComponent } from '../../components/line-chart/line-chart.component';
import { ConfigService } from '../../services/config.service';
import { LogService } from '../../services/log.service';
import {
  GetAllConfigsResponse,
  GetConfigByIdResponse,
  RPCService,
} from '../../services/rpc.service';
import { SSEService } from '../../services/sse.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [LineChartComponent, IconComponent],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  /** Service injection */
  private readonly sseService = inject(SSEService);
  private readonly configService = inject(ConfigService);
  private readonly logService = inject(LogService);
  private readonly router = inject(Router);
  private readonly rpc = inject(RPCService);

  /** Reactive signal holding the history of aggregated metrics. */
  private readonly metricsHistory = signal<AggregatedMetrics[]>([]);

  /** Reactive signal holding available configurations. */
  readonly configs = signal<GetAllConfigsResponse>([]);

  /** Reactive signal holding the selected configuration. */
  readonly selectedConfig = signal<GetConfigByIdResponse | null>(null);

  /** Reactive signal for loading state. */
  readonly isLoading = signal<boolean>(true);

  /**
   * Computed array of requests per second values extracted from the metric history.
   *
   * The returned array is used by LineChartComponent to render the throughput chart.
   */
  public readonly throughputData = computed<number[]>(() =>
    this.metricsHistory().map((m) => m.global.requestsPerSecond),
  );

  /**
   * Computed array of error rate percentages extracted from the metric history.
   *
   * The returned array is used by LineChartComponent to render the error‑rate chart.
   */
  public readonly errorRateData = computed<number[]>(() =>
    this.metricsHistory().map((m) => m.global.errorRate),
  );

  /**
   * Computed array of average latency values extracted from the metric history.
   *
   * The returned array is used by LineChartComponent to render the latency chart.
   */
  public readonly latencyData = computed<number[]>(() =>
    this.metricsHistory().map((m) => m.global.averageLatency),
  );

  /**
   * Computed timestamps (in milliseconds) for each metric entry, relative to now.
   *
   * The array is used as X‑axis labels in the charts and represents one second intervals
   * between successive metrics samples.
   */
  public readonly timeLabels = computed<number[]>(() => {
    const now = Date.now();
    return this.metricsHistory().map(
      (_, i) => now - (this.metricsHistory.length - 1 - i) * 1000,
    );
  });

  /** Computed signal that returns only the array of configs (or empty array) */
  readonly safeConfigs = computed(() => {
    const cfg = this.configs();
    if (!cfg || 'error' in cfg) return [];
    return cfg;
  });

  ngOnInit(): void {
    this.loadConfigurations();
    this.sseService
      .getMetrics()
      .subscribe((metrics) => this.updateCharts(metrics));
  }

  /**
   * Loads all available configurations from the server.
   */
  private loadConfigurations(): void {
    this.isLoading.set(true);
    this.configService.getAllConfigMetadata().subscribe({
      next: (configs) => {
        this.configs.set(configs);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.logService.error('Failed to load configurations:', error);
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Handles configuration selection change.
   */
  onConfigSelect(configId: string): void {
    const allConfigs = this.configs();

    if ('error' in allConfigs) return;

    const config = allConfigs.find((c) => c.id === configId);
    if (config) {
      this.configService.getConfig(configId).subscribe({
        next: (configRecord) => {
          this.selectedConfig.set(configRecord);
        },
        error: (error) => {
          this.logService.error('Failed to load configuration:', error);
        },
      });
    }
  }

  /**
   * Handles configuration selection event from template.
   */
  onConfigSelectEvent(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const configId = target.value;
    if (configId) {
      this.onConfigSelect(configId);
    } else {
      this.selectedConfig.set(null);
    }
  }

  /**
   * Navigates to the settings page.
   */
  navigateToSettings(): void {
    this.router.navigate(['/settings']);
  }

  /**
   * Initiates a fresh load test using the default Tressi configuration.
   *
   * @remarks
   * - Clears any previously collected metrics by resetting {@link DashboardComponent.metricsHistory}.
   * - Calls {@link HttpService.startLoadTest} with {@link defaultTressiConfig} and subscribes to its observable to start execution.
   *
   * This method is intended for UI triggers such as button clicks. It performs no return value.
   */
  start(): void {
    this.metricsHistory.set([]);

    const selected = this.selectedConfig();

    if (selected && 'error' in selected) {
      this.logService.error('No valid configuration selected');
      return;
    }

    const config = selected?.config || defaultTressiConfig;

    this.rpc.client.test
      .$post({ json: config })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        this.logService.info('Load test started successfully:', data);
        // You could also update UI state here
      })
      .catch((error) => {
        this.logService.error('Failed to start load test:', error);
        // Show user-friendly error message
      });
  }

  /**
   * Processes a new set of aggregated metrics and updates the chart data streams.
   *
   * @param metrics - The latest {@link AggregatedMetrics} received from the load test.
   *
   * @remarks
   * 1. Validates that `metrics` is defined (runtime guard).
   * 2. Appends it to the rolling history stored in {@link DashboardComponent.metricsHistory}.
   * 3. Signals Angular's computed properties (`throughputData`, `errorRateData`, etc.) to re‑render charts.
   *
   * The method does not return a value; its side effects are reflected through reactive signals.
   */
  private updateCharts(metrics: AggregatedMetrics): void {
    this.metricsHistory.update((history) => [...history, metrics]);
  }
}
