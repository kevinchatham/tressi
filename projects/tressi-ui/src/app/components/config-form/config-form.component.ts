import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Field, form, required, validate } from '@angular/forms/signals';
import {
  defaultTressiConfig,
  TressiRequestConfig,
  TressiRequestConfigSchema,
  validateConfig,
} from 'tressi-common/config';

import { NameService } from '../../services/name.service';
import { ModifyConfigRequest } from '../../services/rpc.service';
import { IconComponent } from '../icon/icon.component';
import { BasicConfigComponent } from './basic-config/basic-config.component';
import { GlobalHeadersComponent } from './global-headers/global-headers.component';
import { RequestsConfigComponent } from './requests-config/requests-config.component';
import { WorkerEarlyExitComponent } from './worker-early-exit/worker-early-exit.component';

export type ModifyConfigRequestFormType = ReturnType<
  typeof form<ModifyConfigRequest>
>;

@Component({
  selector: 'app-config-form',
  imports: [
    IconComponent,
    BasicConfigComponent,
    GlobalHeadersComponent,
    RequestsConfigComponent,
    WorkerEarlyExitComponent,
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
  readonly configFormModel = signal<ModifyConfigRequest>(
    this.configInput() ?? this.createEmptyConfig(),
  );

  /** Angular signals form with validation */
  readonly configForm = form(this.configFormModel, (schemaPath) => {
    required(schemaPath.name);
    validate(schemaPath, ({ value }) => {
      const isValid = validateConfig(value());
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
  readonly activeTab = signal<'basic' | 'headers' | 'requests' | 'worker-exit'>(
    'basic',
  );

  /** Computed signal for form validity */
  readonly isFormValid = computed(() => {
    return this.configForm().valid();
  });

  /** Handle form submission */
  onSubmit(event: Event): void {
    event.preventDefault();
    this.isLoading.set(true);
    this.configOutput.emit(this.configFormModel());
    this.isLoading.set(false);
  }

  /** Set active tab */
  setActiveTab(tab: 'basic' | 'headers' | 'requests' | 'worker-exit'): void {
    this.activeTab.set(tab);
  }

  /** Add a new request to the requests array */
  addRequest(): void {
    const newRequestInput: TressiRequestConfig = {
      url: 'http://localhost:8080',
      method: 'GET',
      rps: 1,
    };

    const newRequest = TressiRequestConfigSchema.parse(newRequestInput);

    this.configFormModel.update((model) => ({
      ...model,
      requests: [...(model.config.requests ?? []), newRequest],
    }));
  }

  /** Remove a request from the requests array */
  removeRequest(index: number): void {
    this.configFormModel.update((model) => ({
      ...model,
      requests: model.config.requests?.filter((_, i) => i !== index) ?? [],
    }));
  }

  /** Add a new per-endpoint threshold */
  addPerEndpointThreshold(): void {
    this.configFormModel.update((model) => ({
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
    this.configFormModel.update((model) => ({
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
    this.configFormModel.update((model) => ({
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
    this.configFormModel.update((model) => ({
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
      config: defaultTressiConfig,
    };
    return defaultConfig;
  }
}
