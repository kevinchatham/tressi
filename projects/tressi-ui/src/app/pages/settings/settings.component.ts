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
import { TressiConfig } from 'tressi-common/config';

import { ConfigFormComponent } from '../../components/config-form/config-form.component';
import { IconComponent } from '../../components/icon/icon.component';
import { ConfigService } from '../../services/config.service';
import { LogService } from '../../services/log.service';
import { GetAllConfigsResponse } from '../../services/rpc.service';

interface ConfigMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

interface ConfigFormData {
  name: string;
  description: string;
  endpoints: string;
}

// RequestConfig interface is no longer needed as we use TressiConfig from tressi-common

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
  readonly editingConfig = signal<ConfigMetadata | null>(null);
  readonly showDeleteModal = signal<boolean>(false);
  readonly configToDelete = signal<ConfigMetadata | null>(null);

  /** Current configuration being edited */
  readonly currentConfig = signal<TressiConfig | null>(null);
  readonly configName = signal<string>('');
  readonly configDescription = signal<string>('');

  /** Form data signal (deprecated - will be replaced by config-form) */
  readonly formData = signal<ConfigFormData>({
    name: '',
    description: '',
    endpoints: '',
  });

  /** Computed signal for form validation (deprecated) */
  readonly isFormValid = computed<boolean>(() => {
    const data = this.formData();
    return data.name.trim().length > 0 && data.endpoints.trim().length > 0;
  });

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
    this.configName.set('');
    this.configDescription.set('');
  }

  /**
   * Starts editing an existing configuration.
   */
  startEdit(config: ConfigMetadata): void {
    if ('error' in config) return;

    this.isLoading.set(true);
    this.configService.getConfig(config.id).subscribe({
      next: (configRecord) => {
        if (!configRecord || 'error' in configRecord) return;
        if (!configRecord.config) {
          this.logService.error('Invalid configuration data: missing config');
          this.isLoading.set(false);
          return;
        }
        this.isEditing.set(true);
        this.editingConfig.set(configRecord);
        this.currentConfig.set(configRecord.config);
        this.configName.set(configRecord.name);
        this.configDescription.set(
          (configRecord.config as { description?: string }).description || '',
        );
        this.isLoading.set(false);
      },
      error: (error) => {
        this.logService.error('Failed to load configuration:', error);
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Shows delete confirmation modal.
   */
  showDeleteConfirm(config: ConfigMetadata): void {
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
    if (!config || 'error' in config) return;

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
  onConfigSaved(config: TressiConfig): void {
    if (!config) return;

    // Add description to config if provided
    const configWithDescription = {
      ...config,
      description: this.configDescription(),
    };

    const name = this.editingConfig()
      ? this.editingConfig()!.name
      : this.configName();

    if (!name.trim()) {
      this.logService.error('Configuration name is required');
      return;
    }

    this.isLoading.set(true);
    this.configService.saveConfig(name, configWithDescription).subscribe({
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
    this.configName.set('');
    this.configDescription.set('');
    this.formData.set({
      name: '',
      description: '',
      endpoints: '',
    });
  }

  /**
   * Updates form data.
   */
  updateFormData(field: keyof ConfigFormData, value: string): void {
    this.formData.update((data) => ({ ...data, [field]: value }));
  }

  /**
   * Handles name input events for new configurations.
   */
  onNameInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.configName.set(target.value);
  }

  /**
   * Handles description input events.
   */
  onDescriptionInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.configDescription.set(target.value);
  }

  /**
   * Deprecated: Handles input events from old template.
   */
  onEndpointsInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.updateFormData('endpoints', target.value);
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
