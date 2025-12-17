import { SlicePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { AggregatedMetric } from 'tressi-common/metrics';

import { HeaderComponent } from '../../components/header/header.component';
import { IconComponent } from '../../components/icon/icon.component';
import { LineChartComponent } from '../../components/line-chart/line-chart.component';
import { ChartSyncService } from '../../services/chart-sync.service';
import { ConfigService } from '../../services/config.service';
import { LoadingService } from '../../services/loading.service';
import { LocalStorageService } from '../../services/local-storage.service';
import { LogService } from '../../services/log.service';
import { SSEService } from '../../services/metrics.service';
import { ConfigDocument, RPCService } from '../../services/rpc.service';

@Component({
  selector: 'app-dashboard',
  imports: [LineChartComponent, HeaderComponent, IconComponent, SlicePipe],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ChartSyncService],
})
export class DashboardComponent implements OnInit {
  /** Service injection */
  private readonly sseService = inject(SSEService);
  private readonly configService = inject(ConfigService);
  private readonly logService = inject(LogService);
  private readonly router = inject(Router);
  private readonly rpc = inject(RPCService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly loadingService = inject(LoadingService);

  /** Reactive signal holding the history of aggregated metrics. */
  private readonly metricsHistory = signal<AggregatedMetric[]>([]);

  /** Reactive signal holding available configurations. */
  readonly configs = signal<ConfigDocument[]>([]);

  /** Reactive signal holding the selected configuration. */
  readonly selectedConfig = signal<ConfigDocument | null>(null);

  /** Reactive signal holding the current view mode ('global' or endpoint URL). */
  readonly currentViewMode = signal<string>('global');

  /** Computed signal that returns available endpoints from latest metrics. */
  readonly availableEndpoints = computed<string[]>(() => {
    const latestMetrics =
      this.metricsHistory()[this.metricsHistory().length - 1];
    if (!latestMetrics) return [];
    return Object.keys(latestMetrics.endpoints || {});
  });

  /**
   * Computed array of requests per second values extracted from the metric history.
   *
   * The returned array is used by LineChartComponent to render the throughput chart.
   */
  public readonly throughputData = computed<number[]>(() => {
    const viewMode = this.currentViewMode();
    return this.metricsHistory().map((m) => {
      if (viewMode === 'global') {
        return m.global.requestsPerSecond;
      }
      return m.endpoints[viewMode]?.requestsPerSecond ?? 0;
    });
  });

  /**
   * Computed array of error rate percentages extracted from the metric history.
   *
   * The returned array is used by LineChartComponent to render the error‑rate chart.
   */
  public readonly errorRateData = computed<number[]>(() => {
    const viewMode = this.currentViewMode();
    return this.metricsHistory().map((m) => {
      if (viewMode === 'global') {
        return m.global.errorRate;
      }
      return m.endpoints[viewMode]?.errorRate ?? 0;
    });
  });

  /**
   * Computed array of average latency values extracted from the metric history.
   *
   * The returned array is used by LineChartComponent to render the latency chart.
   */
  public readonly latencyData = computed<number[]>(() => {
    const viewMode = this.currentViewMode();
    return this.metricsHistory().map((m) => {
      if (viewMode === 'global') {
        return m.global.averageLatency;
      }
      return m.endpoints[viewMode]?.averageLatency ?? 0;
    });
  });

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

  /** Computed signal that returns the ID of the selected config, or empty string if none */
  readonly selectedConfigId = computed(() => {
    const config = this.selectedConfig();
    if (!config || 'error' in config) return '';
    return config.id;
  });

  /** Computed signal that returns true when there are metrics to display */
  readonly hasMetrics = computed(() => this.metricsHistory().length > 0);

  ngOnInit(): void {
    this.loadingService.registerPage('dashboard');
    this.loadConfigurations();
    this.sseService
      .getMetricsStream()
      .subscribe((metrics) => this.updateCharts(metrics));
  }

  /**
   * Loads all available configurations from the server.
   */
  private async loadConfigurations(): Promise<void> {
    this.loadingService.setPageLoading('dashboard', true);

    const configs = await this.configService.getAll();

    this.configs.set(configs);

    if (configs.length === 0) {
      this.router.navigate(['welcome']);
      this.loadingService.setPageLoading('dashboard', false);
      return;
    }

    const lastSelectedConfig =
      this.localStorageService.getPreferences().lastSelectedConfig;

    if (lastSelectedConfig) {
      // Check if the last selected config still exists
      const existingConfig = configs.find(
        (c) => c.id === lastSelectedConfig.id,
      );
      if (existingConfig) {
        this.onConfigSelect(existingConfig.id);
      } else {
        // Config no longer exists, select first available
        const firstConfig = configs[0];
        this.onConfigSelect(firstConfig.id);
      }
    } else {
      // No last selected config, select first available
      const firstConfig = configs[0];
      this.onConfigSelect(firstConfig.id);
    }

    this.loadingService.setPageLoading('dashboard', false);
  }

  /**
   * Handles configuration selection change.
   */
  onConfigSelect(configId: string): void {
    const config = this.configs().find((c) => c.id === configId);
    if (!config) return;
    this.selectedConfig.set(config);
    // Save the selected config to localStorage
    this.localStorageService.savePreferences({
      ...this.localStorageService.getPreferences(),
      lastSelectedConfig: config,
    });
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
   * Handles view mode selection change.
   */
  onViewModeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.currentViewMode.set(target.value);
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

    if (!selected || 'error' in selected) {
      this.logService.error('No valid configuration selected');
      return;
    }

    if (!selected.config) {
      this.logService.error('Configuration data is missing');
      return;
    }

    this.rpc.client.test
      .$post({ json: selected.config })
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
   * @param metrics - The latest {@link AggregatedMetric} received from the load test.
   *
   * @remarks
   * 1. Validates that `metrics` is defined (runtime guard).
   * 2. Appends it to the rolling history stored in {@link DashboardComponent.metricsHistory}.
   * 3. Signals Angular's computed properties (`throughputData`, `errorRateData`, etc.) to re‑render charts.
   *
   * The method does not return a value; its side effects are reflected through reactive signals.
   */
  private updateCharts(metrics: AggregatedMetric): void {
    this.metricsHistory.update((history) => [...history, metrics]);
  }
}
