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
import {
  ConfigMetadataApiResponse,
  ConfigRecordApiResponse,
} from 'tressi-common/api';
import { SafeTressiConfig } from 'tressi-common/config';
import { defaultTressiConfig } from 'tressi-common/config';

import { IconComponent } from '../../components/icon/icon.component';
import { ConfigService } from '../../services/config.service';
import { LogService } from '../../services/log.service';

interface ConfigFormData {
  name: string;
  description: string;
  endpoints: string;
}

interface RequestConfig {
  url: string;
  method: string;
  rps: number;
  payload?: unknown;
  headers?: Record<string, string> | null;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [IconComponent, DatePipe, ThemeSwitcherComponent],
  templateUrl: './settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit {
  /** Service injection */
  private readonly configService = inject(ConfigService);
  private readonly logService = inject(LogService);
  private readonly router = inject(Router);

  /** Reactive signals for state management */
  readonly configs = signal<ConfigMetadataApiResponse[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isEditing = signal<boolean>(false);
  readonly editingConfig = signal<ConfigRecordApiResponse | null>(null);
  readonly showDeleteModal = signal<boolean>(false);
  readonly configToDelete = signal<ConfigMetadataApiResponse | null>(null);

  /** Form data signal */
  readonly formData = signal<ConfigFormData>({
    name: '',
    description: '',
    endpoints: '',
  });

  /** Computed signal for form validation */
  readonly isFormValid = computed<boolean>(() => {
    const data = this.formData();
    return data.name.trim().length > 0 && data.endpoints.trim().length > 0;
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
    this.formData.set({
      name: '',
      description: '',
      endpoints: JSON.stringify(
        defaultTressiConfig.requests.map((e: RequestConfig) => ({
          url: e.url,
          method: e.method,
          rps: e.rps,
        })),
        null,
        2,
      ),
    });
  }

  /**
   * Starts editing an existing configuration.
   */
  startEdit(config: ConfigMetadataApiResponse): void {
    this.isLoading.set(true);
    this.configService.getConfig(config.id).subscribe({
      next: (configRecord) => {
        this.isEditing.set(true);
        this.editingConfig.set(configRecord);
        this.formData.set({
          name: configRecord.name,
          description:
            (configRecord.config as { description?: string }).description || '',
          endpoints: JSON.stringify(
            configRecord.config.requests.map((e: RequestConfig) => ({
              url: e.url,
              method: e.method,
              rps: e.rps,
            })),
            null,
            2,
          ),
        });
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
  showDeleteConfirm(config: ConfigMetadataApiResponse): void {
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
    if (!config) return;

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
   * Saves the configuration (create or update).
   */
  saveConfig(): void {
    if (!this.isFormValid()) return;

    const data = this.formData();
    let config: SafeTressiConfig;

    try {
      const requests = JSON.parse(data.endpoints);
      config = {
        ...defaultTressiConfig,
        requests: requests.map((e: RequestConfig) => ({
          url: e.url,
          method: e.method || 'GET',
          rps: e.rps || 1,
          payload: e.payload || null,
          headers: e.headers || null,
        })),
      };
    } catch (error) {
      this.logService.error('Invalid endpoints JSON:', error);
      return;
    }

    this.isLoading.set(true);
    this.configService.saveConfig(data.name, config).subscribe({
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
   * Handles input events from template.
   */
  onNameInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.updateFormData('name', target.value);
  }

  /**
   * Handles textarea events from template.
   */
  onDescriptionInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.updateFormData('description', target.value);
  }

  /**
   * Handles endpoints textarea events from template.
   */
  onEndpointsInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.updateFormData('endpoints', target.value);
  }

  /**
   * Gets the name of the config to delete safely.
   */
  getConfigToDeleteName(): string {
    return this.configToDelete()?.name || 'this configuration';
  }

  /**
   * Navigates back to dashboard.
   */
  navigateToDashboard(): void {
    this.router.navigate(['/']);
  }
}
