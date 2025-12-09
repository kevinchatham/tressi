import { DatePipe } from '@angular/common';
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
import { IconComponent } from '../../components/icon/icon.component';
import { ConfigService } from '../../services/config.service';
import { LogService } from '../../services/log.service';
import {
  GetAllConfigsResponse,
  ModifyConfigRequest,
} from '../../services/rpc.service';

@Component({
  selector: 'app-settings',
  imports: [
    IconComponent,
    DatePipe,
    ThemeSwitcherComponent,
    ConfigFormComponent,
  ],
  templateUrl: './settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit {
  /** Service injection */
  private readonly configService = inject(ConfigService);
  private readonly logService = inject(LogService);
  private readonly router = inject(Router);

  /** Reactive signals for state management */
  readonly configs = signal<GetAllConfigsResponse>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isEditing = signal<boolean>(false);
  readonly editingConfig = signal<ModifyConfigRequest | null>(null);
  readonly showDeleteModal = signal<boolean>(false);
  readonly configToDelete = signal<ModifyConfigRequest | null>(null);

  /** Current configuration being edited */
  readonly currentConfig = signal<ModifyConfigRequest | null>(null);

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

  /** Computed signal for config form metadata */
  readonly configFormMetadata = computed(() => {
    const editing = this.editingConfig();
    const current = this.currentConfig();

    if (!editing || !current) {
      return null;
    }

    return {
      name: editing.name,
      description: (current as { description?: string }).description || '',
    };
  });

  ngOnInit(): void {
    this.loadConfigurations();
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
   * Starts creating a new configuration.
   */
  startCreate(): void {
    this.isEditing.set(true);
    this.editingConfig.set(null);
    this.currentConfig.set(null);
  }

  /**
   * Starts editing an existing configuration.
   */
  startEdit(config: ModifyConfigRequest): void {
    if ('error' in config) return;
    this.isEditing.set(true);
    this.editingConfig.set(config);
    this.currentConfig.set(config);
    this.isLoading.set(false);
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

    this.isLoading.set(true);
    this.configService.deleteConfig(config.id).subscribe({
      next: () => {
        this.loadConfigurations();
        this.showDeleteModal.set(false);
        this.configToDelete.set(null);
      },
      error: (error) => {
        this.logService.error('Failed to delete configuration:', error);
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Handles configuration saved event from config-form component.
   */
  onConfigSaved(event: ModifyConfigRequest): void {
    if (!event.config) return;
    this.isLoading.set(true);
    this.configService.saveConfig(event).subscribe({
      next: () => {
        this.loadConfigurations();
        this.cancelEdit();
      },
      error: (error) => {
        this.logService.error('Failed to save configuration:', error);
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Cancels editing and returns to list view.
   */
  cancelEdit(): void {
    this.isEditing.set(false);
    this.editingConfig.set(null);
    this.currentConfig.set(null);
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
