import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { ConfigDocument, SaveConfigRequest } from '@tressi/shared/common';
import { AppRoutes } from '@tressi/shared/ui';
import { ButtonComponent } from 'src/app/components/button/button.component';
import { ThemeSwitcherComponent } from 'src/app/components/theme-switcher/theme-switcher.component';

import { ConfigCardComponent } from '../../components/config-card/config-card.component';
import { ConfigFormComponent } from '../../components/config-form/config-form.component';
import { DeleteConfirmationModalComponent } from '../../components/delete-confirmation-modal/delete-confirmation-modal.component';
import { HeaderComponent } from '../../components/header/header.component';
import { ImportConfigButtonComponent } from '../../components/import-config-button/import-config-button.component';
import { SearchBarComponent } from '../../components/search-bar/search-bar.component';
import { ConfigService } from '../../services/config.service';
import { AppRouterService } from '../../services/router.service';
import { TimeService } from '../../services/time.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-configs',
  imports: [
    ThemeSwitcherComponent,
    ConfigFormComponent,
    HeaderComponent,
    ConfigCardComponent,
    SearchBarComponent,
    DeleteConfirmationModalComponent,
    ImportConfigButtonComponent,
    ButtonComponent,
  ],
  templateUrl: './configs.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigsComponent implements OnInit {
  /** Service injection */
  private readonly _configService = inject(ConfigService);
  private readonly _router = inject(Router);
  private readonly _toastService = inject(ToastService);

  readonly appRouter = inject(AppRouterService);
  readonly timeService = inject(TimeService);

  /** Reactive signals for state management */
  readonly configsInput = input.required<ConfigDocument[]>({
    alias: 'configs',
  });
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

  constructor() {
    // Sync the input to our local writable signal
    effect(() => {
      const initialConfigs = this.configsInput();
      untracked(() => this.configs.set(initialConfigs));
    });
  }

  ngOnInit(): void {
    // Check if the current route is the 'create' route
    const isCreateRoute = this._router.url.includes('/create');

    if (isCreateRoute) {
      this.startCreate();
    }
  }

  /**
   * Starts creating a new configuration.
   */
  startCreate(): void {
    this.currentConfig.set(null);
    this.showForm.set(true);
    this.appRouter.updateUrl(AppRoutes.CONFIGS_CREATE);
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

    await this._configService.deleteConfig(config.id);
    this.showDeleteModal.set(false);
    this.configToDelete.set(null);

    // Update configs directly instead of reloading
    this.configs.update((configs) => configs.filter((c) => c.id !== config.id));
  }

  /**
   * Handles configuration saved event from config-form component.
   */
  async onConfigSaved(event: SaveConfigRequest): Promise<void> {
    const savedConfig = await this._configService.saveConfig(event);

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
    this.appRouter.updateUrl(AppRoutes.CONFIGS);
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
   * Updates the search query when it changes from the search bar.
   */
  onSearchQueryChange(query: string): void {
    this.searchQuery.set(query);
  }

  /**
   * Handles successful config import
   */
  onConfigImported(importedConfig: SaveConfigRequest): void {
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
    this._toastService.show(error, 'error');
  }

  /**
   * Dismisses the toast notification
   */
  dismissToast(): void {
    this._toastService.dismiss();
  }
}
