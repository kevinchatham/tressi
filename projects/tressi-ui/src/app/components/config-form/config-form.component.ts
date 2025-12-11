import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  applyEach,
  Field,
  form,
  required,
  SchemaPathTree,
  validate,
} from '@angular/forms/signals';
import {
  defaultTressiConfig,
  TressiRequestConfig,
  validateConfig,
} from 'tressi-common/config';

import { NameService } from '../../services/name.service';
import { ModifyConfigRequest } from '../../services/rpc.service';
import { IconComponent } from '../icon/icon.component';
import { AdvancedConfigComponent } from './advanced-config/advanced-config.component';
import { BasicConfigComponent } from './basic-config/basic-config.component';
import { GlobalConfigComponent } from './global-config/global-config.component';

// Schema function for validating individual request configuration
function RequestSchema(request: SchemaPathTree<TressiRequestConfig>): void {
  required(request.url, { message: 'URL is required' });
}

export type ModifyConfigRequestFormType = ReturnType<
  typeof form<ModifyConfigRequest>
>;

@Component({
  selector: 'app-config-form',
  imports: [
    IconComponent,
    AdvancedConfigComponent,
    BasicConfigComponent,
    GlobalConfigComponent,
    Field,
  ],
  templateUrl: './config-form.component.html',
})
export class ConfigFormComponent {
  private readonly nameService = inject(NameService);

  /** Input configuration to edit */
  readonly configInput = input<ModifyConfigRequest | null>(null);

  /** Output event when configuration is saved */
  readonly configOutput = output<ModifyConfigRequest>();

  /** Output event when closed */
  readonly closed = output<void>();

  /** Loading state */
  readonly isLoading = signal(false);

  /** Form model with complete TressiConfig structure */
  readonly model = signal<ModifyConfigRequest>(
    this.configInput() ?? this.createEmptyConfig(),
  );

  /** Angular signals form with validation */
  readonly form = form(this.model, (schemaPath) => {
    required(schemaPath.name);

    // Apply validation to each request in the array
    if (schemaPath.config.requests) {
      applyEach(schemaPath.config.requests, RequestSchema);
    }

    validate(schemaPath, ({ value }) => {
      const isValid = validateConfig(value().config);

      if ('error' in isValid)
        return {
          kind: 'error',
          message: isValid.error.message,
        };
      return null;
    });
    validate(schemaPath, ({ value }) => {
      const hasRequests = value().config.requests?.length || 0 > 0;
      if (!hasRequests)
        return {
          kind: 'error',
          message: 'You should have at least one request',
        };
      return null;
    });
  });

  /** Active tab state */
  readonly activeTab = signal<'basic' | 'global' | 'advanced'>('basic');

  /** Computed signal for form validity */
  readonly isFormValid = computed(() => {
    return this.form().valid();
  });
  /** Handle form submission */
  onSubmit(event: Event): void {
    event.preventDefault();

    if (this.isFormValid()) {
      this.isLoading.set(true);
      this.configOutput.emit(this.model());
      this.isLoading.set(false);
    }
  }

  /** Set active tab */
  setActiveTab(tab: 'basic' | 'global' | 'advanced'): void {
    this.activeTab.set(tab);
  }

  /** Add a new request to the requests array */
  addRequest(): void {
    const newRequest: TressiRequestConfig = {
      url: '',
      method: 'GET',
      rps: 1,
    };

    this.model.update((model) => ({
      ...model,
      config: {
        ...model.config,
        requests: [...(model.config.requests ?? []), newRequest],
      },
    }));
  }

  /** Remove a request from the requests array */
  removeRequest(index: number): void {
    this.model.update((model) => ({
      ...model,
      config: {
        ...model.config,
        requests: model.config.requests?.filter((_, i) => i !== index) ?? [],
      },
    }));
  }

  /** Add a new per-endpoint threshold */
  addPerEndpointThreshold(): void {
    this.model.update((model) => ({
      ...model,
      options: {
        ...model.config.options,
        workerEarlyExit: {
          ...model.config.options?.workerEarlyExit,
          perEndpointThresholds: [
            ...(model.config.options?.workerEarlyExit?.perEndpointThresholds ??
              []),
            { url: '', errorRateThreshold: 0.1 },
          ],
        },
      },
    }));
  }

  /** Remove a per-endpoint threshold */
  removePerEndpointThreshold(index: number): void {
    this.model.update((model) => ({
      ...model,
      options: {
        ...model.config.options,
        workerEarlyExit: {
          ...model.config.options?.workerEarlyExit,
          perEndpointThresholds:
            model.config.options?.workerEarlyExit?.perEndpointThresholds?.filter(
              (_, i) => i !== index,
            ) ?? [],
        },
      },
    }));
  }

  /** Add a worker exit status code */
  addWorkerExitStatusCode(): void {
    this.model.update((model) => ({
      ...model,
      options: {
        ...model.config.options,
        workerEarlyExit: {
          ...model.config.options?.workerEarlyExit,
          workerExitStatusCodes: [
            ...(model.config.options?.workerEarlyExit?.workerExitStatusCodes ??
              []),
            500,
          ],
        },
      },
    }));
  }

  /** Remove a worker exit status code */
  removeWorkerExitStatusCode(index: number): void {
    this.model.update((model) => ({
      ...model,
      options: {
        ...model.config.options,
        workerEarlyExit: {
          ...model.config.options?.workerEarlyExit,
          workerExitStatusCodes:
            model.config.options?.workerEarlyExit?.workerExitStatusCodes?.filter(
              (_, i) => i !== index,
            ) ?? [],
        },
      },
    }));
  }

  /** Create an empty configuration structure */
  private createEmptyConfig(): ModifyConfigRequest {
    const defaultConfig: ModifyConfigRequest = {
      name: this.nameService.generate(),
      config: {
        ...defaultTressiConfig,
        requests: [
          {
            url: '',
            method: 'GET',
            rps: 1,
          },
        ],
      },
    };
    return defaultConfig;
  }
}
