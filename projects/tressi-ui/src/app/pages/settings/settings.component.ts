import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ThemeSwitcherComponent } from 'src/app/components/theme-switcher/theme-switcher.component';

import { ConfigFormComponent } from '../../components/config-form/config-form.component';
import { ConfigurationCardComponent } from '../../components/configuration-card/configuration-card.component';
import { HeaderComponent } from '../../components/header/header.component';
import { IconComponent } from '../../components/icon/icon.component';
import { ConfigService } from '../../services/config.service';
import { LogService } from '../../services/log.service';
import {
  GetAllConfigsResponse,
  ModifyConfigRequest,
} from '../../services/rpc.service';
import { TimeService } from '../../services/time.service';

@Component({
  selector: 'app-settings',
  imports: [
    IconComponent,
    ThemeSwitcherComponent,
    ConfigFormComponent,
    HeaderComponent,
    ConfigurationCardComponent,
  ],
  templateUrl: './settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit {
  /** Service injection */
  private readonly configService = inject(ConfigService);
  private readonly logService = inject(LogService);
  private readonly router = inject(Router);
  readonly timeService = inject(TimeService);

  /** Reactive signals for state management */
  readonly configs = signal<GetAllConfigsResponse>([]);
  readonly showDeleteModal = signal<boolean>(false);
  readonly configToDelete = signal<ModifyConfigRequest | null>(null);

  /** Current configuration being edited */
  readonly currentConfig = signal<ModifyConfigRequest | null>(null);

  /** Signal to track if we're showing the form (for create or edit) */
  readonly showForm = signal<boolean>(false);

  /** Computed signal that returns only the array of configs (or empty array) */
  readonly safeConfigs = computed(() => {
    const cfg = this.configs();
    if (!cfg || 'error' in cfg) return [];
    return cfg;
  });

  /** Computed signal to check if there are no configs to display */
  readonly hasNoConfigs = computed(() => {
    return this.safeConfigs().length === 0;
  });

  /** Computed signal to check if there's an error */
  readonly hasError = computed(() => {
    const cfg = this.configs();
    return cfg && 'error' in cfg;
  });

  ngOnInit(): void {
    this.loadConfigurations();
  }

  /**
   * Loads all available configurations from the server.
   */
  private loadConfigurations(): void {
    this.configService.getAllConfigMetadata().subscribe({
      next: (configs) => {
        this.configs.set(configs);
      },
      error: (error) => {
        this.logService.error('Failed to load configurations:', error);
      },
    });
  }

  /**
   * Starts creating a new configuration.
   */
  startCreate(): void {
    this.currentConfig.set(null);
    this.showForm.set(true);
  }

  /**
   * Starts editing an existing configuration.
   */
  startEdit(config: ModifyConfigRequest): void {
    if ('error' in config) return;
    this.currentConfig.set(config);
    this.showForm.set(true);
  }

  /**
   * Shows delete confirmation modal.
   */
  showDeleteConfirm(config: ModifyConfigRequest): void {
    this.configToDelete.set(config);
    this.showDeleteModal.set(true);
  }

  /**
   * Cancels delete operation.
   */
  cancelDelete(): void {
    this.showDeleteModal.set(false);
    this.configToDelete.set(null);
  }

  /**
   * Deletes a configuration.
   */
  deleteConfig(): void {
    const config = this.configToDelete();
    if (!config || 'error' in config || !config.id) return;

    this.configService.deleteConfig(config.id).subscribe({
      next: () => {
        this.loadConfigurations();
        this.showDeleteModal.set(false);
        this.configToDelete.set(null);
      },
      error: (error) => {
        this.logService.error('Failed to delete configuration:', error);
      },
    });
  }

  /**
   * Handles configuration saved event from config-form component.
   */
  onConfigSaved(event: ModifyConfigRequest): void {
    if (!event.config) return;
    this.configService.saveConfig(event).subscribe({
      next: () => {
        this.loadConfigurations();
        this.cancelEdit();
      },
      error: (error) => {
        this.logService.error('Failed to save configuration:', error);
      },
    });
  }

  /**
   * Cancels editing and returns to list view.
   */
  cancelEdit(): void {
    this.currentConfig.set(null);
    this.showForm.set(false);
  }

  /**
   * Gets the name of the config to delete safely.
   */
  getConfigToDeleteName(): string {
    const config = this.configToDelete();
    if (config && 'error' in config) return 'error';
    return config?.name || 'this configuration';
  }

  /**
   * Navigates back to dashboard.
   */
  navigateToDashboard(): void {
    this.router.navigate(['/']);
  }
}
