import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from 'src/app/components/button/button.component';
import { ThemeSwitcherComponent } from 'src/app/components/theme-switcher/theme-switcher.component';

import { ConfigFormComponent } from '../../components/config-form/config-form.component';
import { ConfigurationCardComponent } from '../../components/configuration-card/configuration-card.component';
import { HeaderComponent } from '../../components/header/header.component';
import { IconComponent } from '../../components/icon/icon.component';
import { ImportConfigButtonComponent } from '../../components/import-config-button/import-config-button.component';
import { SearchBarComponent } from '../../components/search-bar/search-bar.component';
import { ConfigService } from '../../services/config.service';
import {
  ConfigDocument,
  ModifyConfigRequest,
} from '../../services/rpc.service';
import { TimeService } from '../../services/time.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-configs',
  imports: [
    IconComponent,
    ThemeSwitcherComponent,
    ConfigFormComponent,
    HeaderComponent,
    ConfigurationCardComponent,
    SearchBarComponent,
    ImportConfigButtonComponent,
    ButtonComponent,
  ],
  templateUrl: './configs.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigurationsComponent implements OnInit {
  /** Service injection */
  private readonly configService = inject(ConfigService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly timeService = inject(TimeService);
  private readonly toastService = inject(ToastService);

  /** Reactive signals for state management */
  readonly configs = signal<ConfigDocument[]>([]);
  readonly showDeleteModal = signal<boolean>(false);
  readonly configToDelete = signal<ConfigDocument | null>(null);

  /** Current configuration being edited */
  readonly currentConfig = signal<ConfigDocument | null>(null);

  /** Signal to track if we're showing the form (for create or edit) */
  readonly showForm = signal<boolean>(false);

  /** Signal for the current search query */
  readonly searchQuery = signal<string>('');

  /** Computed signal that filters configs based on search query */
  readonly filteredConfigs = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.configs();

    return this.configs().filter((config) => {
      // Search in config name
      if (config.name.toLowerCase().includes(query)) {
        return true;
      }

      return config.config.requests.some((req) =>
        req.url.toLowerCase().includes(query),
      );
    });
  });

  /** Computed signal to check if there are no configs to display */
  readonly hasNoConfigs = computed(() => {
    return this.configs().length === 0;
  });

  ngOnInit(): void {
    this.initializeFromResolvedData();
  }

  /**
   * Initializes the component using data pre-resolved by the router.
   */
  private initializeFromResolvedData(): void {
    const configs = this.route.snapshot.data['configs'] as ConfigDocument[];
    this.configs.set(configs);
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
  startEdit(config: ConfigDocument): void {
    this.currentConfig.set(config);
    this.showForm.set(true);
  }

  /**
   * Starts duplicating an existing configuration.
   */
  startDuplicate(config: ConfigDocument): void {
    // Generate new name by appending " - Copy" to original name
    const newName = `${config.name} - Copy`;

    // Create duplicate config without ID (so it's treated as new)
    const duplicatedConfig: ConfigDocument = {
      ...config,
      id: '', // Empty ID that will be generated on save
      name: newName,
      epochCreatedAt: Date.now(),
      epochUpdatedAt: Date.now(),
    };

    this.currentConfig.set(duplicatedConfig);
    this.showForm.set(true);
  }

  /**
   * Shows delete confirmation modal.
   */
  showDeleteConfirm(config: ConfigDocument): void {
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
  async deleteConfig(): Promise<void> {
    const config = this.configToDelete();
    if (!config) return;

    await this.configService.deleteConfig(config.id);
    this.showDeleteModal.set(false);
    this.configToDelete.set(null);

    // Update configs directly instead of reloading
    this.configs.update((configs) => configs.filter((c) => c.id !== config.id));
  }

  /**
   * Handles configuration saved event from config-form component.
   */
  async onConfigSaved(event: ModifyConfigRequest): Promise<void> {
    const savedConfig = await this.configService.saveConfig(event);

    // Update configs directly instead of reloading
    this.configs.update((configs) => {
      const existingIndex = configs.findIndex((c) => c.id === savedConfig.id);
      if (existingIndex >= 0) {
        // Update existing config
        const updatedConfigs = [...configs];
        updatedConfigs[existingIndex] = savedConfig;
        return updatedConfigs;
      } else {
        // Add new config
        return [...configs, savedConfig];
      }
    });

    this.cancelEdit();
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
  navigateToDashboard(event?: ConfigDocument): void {
    if (event) this.router.navigate(['/dashboard', event.id]);
    else this.router.navigate(['/']);
  }

  /**
   * Updates the search query when it changes from the search bar.
   */
  onSearchQueryChange(query: string): void {
    this.searchQuery.set(query);
  }

  /**
   * Handles configuration selection and navigates to dashboard.
   */
  onConfigSelect(config: ConfigDocument): void {
    this.router.navigate(['/dashboard', config.id]);
  }

  /**
   * Handles successful config import
   */
  onConfigImported(importedConfig: ModifyConfigRequest): void {
    // Set the imported config to trigger form population
    this.currentConfig.set({
      id: '',
      epochCreatedAt: Date.now(),
      epochUpdatedAt: Date.now(),
      name: importedConfig.name,
      config: importedConfig.config,
    } as ConfigDocument);

    this.showForm.set(true);
  }

  /**
   * Handles import errors with toast notification
   */
  onImportError(error: string): void {
    this.toastService.show(error, 'error');
  }

  /**
   * Dismisses the toast notification
   */
  dismissToast(): void {
    this.toastService.dismiss();
  }
}
