import { Component, computed, input, output, signal } from '@angular/core';
import { form, validate } from '@angular/forms/signals';
import {
  TressiConfig,
  TressiRequestConfig,
  TressiRequestConfigSchema,
  validateConfig,
} from 'tressi-common/config';

// Type for the form structure matching TressiConfig
export type TressiConfigForm = ReturnType<typeof form<TressiConfig>>;

import { IconComponent } from '../icon/icon.component';
import { BasicConfigComponent } from './basic-config/basic-config.component';
import { GlobalHeadersComponent } from './global-headers/global-headers.component';
import { RequestsConfigComponent } from './requests-config/requests-config.component';
import { WorkerEarlyExitComponent } from './worker-early-exit/worker-early-exit.component';

@Component({
  selector: 'app-config-form',
  imports: [
    IconComponent,
    BasicConfigComponent,
    GlobalHeadersComponent,
    RequestsConfigComponent,
    WorkerEarlyExitComponent,
  ],
  templateUrl: './config-form.component.html',
})
export class ConfigFormComponent {
  /** Input configuration to edit */
  readonly config = input<TressiConfig | null>(null);

  /** Output event when configuration is saved */
  readonly configSaved = output<TressiConfig>();

  /** Loading state */
  readonly isLoading = signal(false);

  /** Form model with complete TressiConfig structure */
  readonly configModel = signal<TressiConfig>(
    this.config() ?? this.createEmptyConfig(),
  );

  /** Angular signals form with validation */
  readonly configForm = form(this.configModel, (schemaPath) => {
    validate(schemaPath, ({ value }) => {
      const isValid = validateConfig(value);
      if ('error' in isValid) {
        return {
          kind: 'error',
          message: isValid.error.message,
        };
      }
      return null;
    });
  });

  /** Active tab state */
  readonly activeTab = signal<'basic' | 'headers' | 'requests' | 'worker-exit'>(
    'basic',
  );

  /** Computed signal for form validity */
  readonly isFormValid = computed(() => {
    return this.configForm.options().valid();
  });

  /** Handle form submission */
  onSubmit(event: Event): void {
    event.preventDefault();
    this.isLoading.set(true);
    this.configSaved.emit(this.configModel());
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

    this.configModel.update((config) => ({
      ...config,
      requests: [...config.requests, newRequest],
    }));
  }

  /** Remove a request from the requests array */
  removeRequest(index: number): void {
    this.configModel.update((config) => ({
      ...config,
      requests: config.requests.filter((_, i) => i !== index),
    }));
  }

  /** Add a new per-endpoint threshold */
  addPerEndpointThreshold(): void {
    this.configModel.update((config) => ({
      ...config,
      options: {
        ...config.options,
        workerEarlyExit: {
          ...config.options.workerEarlyExit,
          perEndpointThresholds: [
            ...config.options.workerEarlyExit.perEndpointThresholds,
            { url: '', errorRateThreshold: 0.1 },
          ],
        },
      },
    }));
  }

  /** Remove a per-endpoint threshold */
  removePerEndpointThreshold(index: number): void {
    this.configModel.update((config) => ({
      ...config,
      options: {
        ...config.options,
        workerEarlyExit: {
          ...config.options.workerEarlyExit,
          perEndpointThresholds:
            config.options.workerEarlyExit.perEndpointThresholds.filter(
              (_, i) => i !== index,
            ),
        },
      },
    }));
  }

  /** Add a worker exit status code */
  addWorkerExitStatusCode(): void {
    this.configModel.update((config) => ({
      ...config,
      options: {
        ...config.options,
        workerEarlyExit: {
          ...config.options.workerEarlyExit,
          workerExitStatusCodes: [
            ...config.options.workerEarlyExit.workerExitStatusCodes,
            500,
          ],
        },
      },
    }));
  }

  /** Remove a worker exit status code */
  removeWorkerExitStatusCode(index: number): void {
    this.configModel.update((config) => ({
      ...config,
      options: {
        ...config.options,
        workerEarlyExit: {
          ...config.options.workerEarlyExit,
          workerExitStatusCodes:
            config.options.workerEarlyExit.workerExitStatusCodes.filter(
              (_, i) => i !== index,
            ),
        },
      },
    }));
  }

  /** Create an empty configuration structure */
  private createEmptyConfig(): TressiConfig {
    return {
      $schema:
        'https://raw.githubusercontent.com/kevinmichaelchen/tressi/main/schemas/tressi.schema.v0.0.13.json',
      requests: [],
      options: {
        durationSec: 10,
        rampUpTimeSec: 0,
        exportPath: './tressi-report',
        silent: false,
        headers: { 'User-Agent': 'Tressi' },
        threads: 1,
        workerMemoryLimit: 128,
        workerEarlyExit: {
          enabled: true,
          globalErrorRateThreshold: 0.1,
          globalErrorCountThreshold: 100,
          perEndpointThresholds: [],
          workerExitStatusCodes: [500, 502, 503, 504],
          monitoringWindowMs: 5000,
          stopMode: 'global',
        },
      },
    };
  }
}
