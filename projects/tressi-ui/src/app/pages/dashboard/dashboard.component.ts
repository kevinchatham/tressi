import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { HeaderComponent } from '../../components/header/header.component';
import { IconComponent } from '../../components/icon/icon.component';
import { TestListComponent } from '../../components/test-list/test-list.component';
import { ConfigService } from '../../services/config.service';
import { LoadingService } from '../../services/loading.service';
import { LocalStorageService } from '../../services/local-storage.service';
import { LogService } from '../../services/log.service';
import { ConfigDocument, RPCService } from '../../services/rpc.service';

@Component({
  selector: 'app-dashboard',
  imports: [HeaderComponent, IconComponent, TestListComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  /** Service injection */
  private readonly configService = inject(ConfigService);
  private readonly logService = inject(LogService);
  private readonly router = inject(Router);
  private readonly rpc = inject(RPCService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly loadingService = inject(LoadingService);

  /** Reactive signal holding available configurations. */
  readonly configs = signal<ConfigDocument[]>([]);

  /** Reactive signal holding the selected configuration. */
  readonly selectedConfig = signal<ConfigDocument | null>(null);

  /** Computed signal that returns the ID of the selected config, or empty string if none */
  readonly selectedConfigId = computed(() => {
    const config = this.selectedConfig();
    if (!config || 'error' in config) return '';
    return config.id;
  });

  /** Reference to the test list component for refreshing tests */
  readonly testListComponent = viewChild<TestListComponent>(TestListComponent);

  ngOnInit(): void {
    this.loadingService.registerPage('dashboard');
    this.loadConfigurations();
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
   * Navigates to the settings page.
   */
  navigateToSettings(): void {
    this.router.navigate(['/settings']);
  }

  /**
   * Initiates a fresh load test using the default Tressi configuration.
   *
   * @remarks
   * - Calls {@link HttpService.startLoadTest} with {@link defaultTressiConfig} and subscribes to its observable to start execution.
   *
   * This method is intended for UI triggers such as button clicks. It performs no return value.
   */
  start(): void {
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
      .$post({ json: { configId: selected.id } })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        this.logService.info('Load test started successfully:', data);
        // Refresh the test list to show the newly started test
        const testList = this.testListComponent();
        if (testList) {
          testList.refreshTests();
        }
      })
      .catch((error) => {
        this.logService.error('Failed to start load test:', error);
        // Show user-friendly error message
      });
  }
}
