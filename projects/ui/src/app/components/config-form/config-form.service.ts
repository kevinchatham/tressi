import { computed, inject, signal } from '@angular/core';
import {
  applyEach,
  form,
  required,
  type SchemaPathTree,
  validateStandardSchema,
} from '@angular/forms/signals';
import {
  defaultTressiConfig,
  requestDefaults,
  type SaveConfigRequest,
  TressiConfigSchema,
  type TressiRequestConfig,
} from '@tressi/shared/common';

import { NameService } from '../../services/name.service';

function RequestSchema(request: SchemaPathTree<TressiRequestConfig>): void {
  required(request.url, { message: 'URL is required' });
}

export class ConfigFormService {
  private readonly _nameService = inject(NameService);

  readonly model = signal<SaveConfigRequest>(this._createEmptyConfig());

  readonly form = form(this.model, (schemaPath) => {
    required(schemaPath.name);

    if (schemaPath.config.requests) {
      applyEach(schemaPath.config.requests, RequestSchema);
    }

    if (schemaPath.config) {
      validateStandardSchema(schemaPath.config, TressiConfigSchema);
    }
  });

  readonly isFormValid = computed(() => {
    return this.form().valid();
  });

  readonly activeTab = signal<'general' | 'requests'>('general');

  loadConfig(config: SaveConfigRequest | null): void {
    if (config !== null) {
      this.model.set(config);
    } else {
      this.model.set(this._createEmptyConfig());
    }
  }

  reset(): void {
    this.model.set(this._createEmptyConfig());
    this.form().reset();
    this.activeTab.set('general');
  }

  submit(): SaveConfigRequest {
    return this.model();
  }

  setActiveTab(tab: 'general' | 'requests'): void {
    this.activeTab.set(tab);
  }

  onJsonTextAreaChange(): void {
    this.model.update((current) => ({ ...current }));
  }

  addRequest(): void {
    this.model.update((model) => ({
      ...model,
      config: {
        ...model.config,
        requests: [...(model.config.requests ?? []), { ...requestDefaults }],
      },
    }));
  }

  removeRequest(index: number): void {
    this.model.update((model) => ({
      ...model,
      config: {
        ...model.config,
        requests: model.config.requests?.filter((_, i) => i !== index) ?? [],
      },
    }));
  }

  addGlobalExitStatusCode(): void {
    this.model.update((model) => ({
      ...model,
      config: {
        ...model.config,
        options: {
          ...model.config.options,
          workerEarlyExit: {
            ...model.config.options?.workerEarlyExit,
            exitStatusCodes: [
              ...(model.config.options?.workerEarlyExit?.exitStatusCodes ?? []),
              500,
            ],
          },
        },
      },
    }));
  }

  removeGlobalExitStatusCode(index: number): void {
    this.model.update((model) => ({
      ...model,
      config: {
        ...model.config,
        options: {
          ...model.config.options,
          workerEarlyExit: {
            ...model.config.options?.workerEarlyExit,
            exitStatusCodes:
              model.config.options?.workerEarlyExit?.exitStatusCodes?.filter(
                (_, i) => i !== index,
              ) ?? [],
          },
        },
      },
    }));
  }

  addRequestExitStatusCode(requestIndex: number): void {
    this.model.update((model) => {
      const updatedRequests = [...(model.config.requests ?? [])];
      if (updatedRequests[requestIndex]?.earlyExit) {
        const currentCodes = updatedRequests[requestIndex].earlyExit!.exitStatusCodes ?? [];
        updatedRequests[requestIndex] = {
          ...updatedRequests[requestIndex],
          earlyExit: {
            ...updatedRequests[requestIndex].earlyExit,
            exitStatusCodes: [...currentCodes, 500],
          },
        };
      }
      return {
        ...model,
        config: {
          ...model.config,
          requests: updatedRequests,
        },
      };
    });
  }

  removeRequestExitStatusCode(requestIndex: number, codeIndex: number): void {
    this.model.update((model) => {
      const updatedRequests = [...(model.config.requests ?? [])];
      if (updatedRequests[requestIndex]?.earlyExit?.exitStatusCodes) {
        const currentCodes = updatedRequests[requestIndex].earlyExit.exitStatusCodes;
        updatedRequests[requestIndex] = {
          ...updatedRequests[requestIndex],
          earlyExit: {
            ...updatedRequests[requestIndex].earlyExit,
            exitStatusCodes: currentCodes.filter((_, i) => i !== codeIndex),
          },
        };
      }
      return {
        ...model,
        config: {
          ...model.config,
          requests: updatedRequests,
        },
      };
    });
  }

  private _createEmptyConfig(): SaveConfigRequest {
    const config = defaultTressiConfig;
    config.requests = [{ ...requestDefaults }];

    const defaultConfig: SaveConfigRequest = {
      config,
      name: this._nameService.generate(),
    };
    return defaultConfig;
  }
}
