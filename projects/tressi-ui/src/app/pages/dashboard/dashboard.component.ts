import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { HeaderComponent } from '../../components/header/header.component';
import { IconComponent } from '../../components/icon/icon.component';
import { StartButtonComponent } from '../../components/start-button/start-button.component';
import { TestListComponent } from '../../components/test-list/test-list.component';
import { ConfigService } from '../../services/config.service';
import { EventService } from '../../services/event.service';
import { LoadingService } from '../../services/loading.service';
import { LocalStorageService } from '../../services/local-storage.service';
import { LogService } from '../../services/log.service';
import { ConfigDocument } from '../../services/rpc.service';

@Component({
  selector: 'app-dashboard',
  imports: [
    HeaderComponent,
    IconComponent,
    TestListComponent,
    StartButtonComponent,
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  /** Service injection */
  private readonly configService = inject(ConfigService);
  private readonly logService = inject(LogService);
  private readonly router = inject(Router);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly loadingService = inject(LoadingService);
  private readonly eventService = inject(EventService);

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

  /** Signal to track if there are tests available for the selected config */
  readonly hasTestHistory = signal<boolean>(false);

  /** Signal to track if a test is currently running */
  readonly isTestRunning = signal<boolean>(false);

  /** Subject for managing subscription cleanup */
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadingService.registerPage('dashboard');
    this.loadConfigurations();
    this.subscribeToTestEvents();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
   * Handles test started event from StartButtonComponent
   */
  onTestStarted(): void {
    const testList = this.testListComponent();
    if (testList) {
      testList.refreshTests();
    }
  }

  /**
   * Handles test start failed event from StartButtonComponent
   */
  onTestStartFailed(error: Error): void {
    this.logService.error('Failed to start test:', error);
  }

  /**
   * Updates the test history state based on whether tests exist
   */
  onTestHistoryUpdate(hasTests: boolean): void {
    this.hasTestHistory.set(hasTests);
  }

  /**
   * Sets up test event listeners to track test execution state
   */
  private subscribeToTestEvents(): void {
    this.eventService
      .getTestEventsStream()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (event) => {
          if (event.status === 'running') {
            this.isTestRunning.set(true);
          } else if (
            event.status === 'completed' ||
            event.status === 'failed'
          ) {
            this.isTestRunning.set(false);
          }
        },
        error: (error) => {
          this.logService.error('Failed to handle test event:', error);
        },
      });
  }
}
