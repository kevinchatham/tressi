import {
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ButtonComponent } from 'src/app/components/button/button.component';

import { HeaderComponent } from '../../components/header/header.component';
import { StartButtonComponent } from '../../components/start-button/start-button.component';
import { TestListComponent } from '../../components/test-list/test-list.component';
import { EventService } from '../../services/event.service';
import { LocalStorageService } from '../../services/local-storage.service';
import { LogService } from '../../services/log.service';
import { AppRouterService } from '../../services/router.service';
import { ConfigDocument } from '../../services/rpc.service';

@Component({
  selector: 'app-dashboard',
  imports: [
    HeaderComponent,
    TestListComponent,
    StartButtonComponent,
    ButtonComponent,
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  /** Service injection */
  readonly appRouter = inject(AppRouterService);
  private readonly _logService = inject(LogService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _localStorageService = inject(LocalStorageService);
  private readonly _eventService = inject(EventService);

  /** Route parameter for config ID */
  readonly configId = input<string>();

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
  private readonly _destroy$ = new Subject<void>();

  ngOnInit(): void {
    this._initializeFromResolvedData();
    this._subscribeToTestEvents();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  /**
   * Initializes the component using data pre-resolved by the router.
   */
  private _initializeFromResolvedData(): void {
    const configs = this._route.snapshot.data['configs'] as ConfigDocument[];

    this.configs.set(configs);

    if (configs.length === 0) {
      this.appRouter.toWelcome();
      return;
    }

    const routeConfigId = this.configId();
    const lastSelectedConfig =
      this._localStorageService.preferences().lastSelectedConfig;

    if (routeConfigId) {
      const configFromRoute = configs.find((c) => c.id === routeConfigId);
      if (configFromRoute) {
        this.onConfigSelect(configFromRoute.id);
      } else {
        this._selectFallbackConfig(configs, lastSelectedConfig);
      }
    } else {
      this._selectFallbackConfig(configs, lastSelectedConfig);
    }
  }

  /**
   * Selects a fallback configuration based on last selected or first available.
   */
  private _selectFallbackConfig(
    configs: ConfigDocument[],
    lastSelectedConfig: ConfigDocument | null | undefined,
  ): void {
    if (lastSelectedConfig) {
      const existingConfig = configs.find(
        (c) => c.id === lastSelectedConfig.id,
      );
      if (existingConfig) {
        this.onConfigSelect(existingConfig.id);
        return;
      }
    }

    // Fallback to first available
    const firstConfig = configs[0];
    this.onConfigSelect(firstConfig.id);
  }

  /**
   * Handles configuration selection change.
   */
  onConfigSelect(configId: string): void {
    const config = this.configs().find((c) => c.id === configId);
    if (!config) return;
    this.selectedConfig.set(config);
    // Save the selected config to localStorage
    this._localStorageService.savePreferences({
      ...this._localStorageService.preferences(),
      lastSelectedConfig: config,
    });

    this.appRouter.updateDashboardUrl(configId);
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
    this._logService.error('Failed to start test:', error);
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
  private _subscribeToTestEvents(): void {
    this._eventService
      .getTestEventsStream()
      .pipe(takeUntil(this._destroy$))
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
          this._logService.error('Failed to handle test event:', error);
        },
      });
  }
}
