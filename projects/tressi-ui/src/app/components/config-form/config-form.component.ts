import {
  Component,
  computed,
  effect,
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
import { validateConfig } from '@tressi-cli/common/config';
import { defaultTressiConfig } from '@tressi-cli/common/config/defaults';
import { requestDefaults } from '@tressi-cli/common/config/schemas';
import { TressiRequestConfig } from '@tressi-cli/common/config/types';

import { NameService } from '../../services/name.service';
import {
  ConfigDocument,
  ModifyConfigRequest,
} from '../../services/rpc.service';
import { ButtonComponent } from '../button/button.component';
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
    ButtonComponent,
  ],
  templateUrl: './config-form.component.html',
})
export class ConfigFormComponent {
  private readonly nameService = inject(NameService);

  /** Input configuration to edit */
  readonly input = input<ConfigDocument | null>(null);

  /** Output event when configuration is saved */
  readonly output = output<ModifyConfigRequest>();

  /** Output event when closed */
  readonly closed = output<void>();

  /** Form model with complete TressiConfig structure */
  readonly model = signal<ModifyConfigRequest>(this.createEmptyConfig());

  constructor() {
    effect(() => {
      const input = this.input();
      if (input !== null) {
        this.model.set(input);
      } else {
        this.model.set(this.createEmptyConfig());
      }
    });
  }

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
      const hasRequests = (value().config.requests?.length || 0) > 0;
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

  readonly formErrors = computed<string[]>(() => {
    return this.form()
      .errors()
      .flatMap((e) => e.message)
      .filter((e): e is string => !!e)
      .flatMap((e) => JSON.parse(e))
      .map((e) => e.message)
      .filter((e: string) => !e.includes('URL'));
  });

  onJsonTextAreaChange(): void {
    this.model.update((current) => ({ ...current }));
  }

  /** Handle form submission */
  onSubmit(event: Event): void {
    event.preventDefault();
    this.output.emit(this.model());
  }

  onCancel(event: Event): void {
    event.preventDefault();
    this.model.set(this.createEmptyConfig());
    this.form().reset();
    this.closed.emit();
  }

  /** Set active tab */
  setActiveTab(tab: 'basic' | 'global' | 'advanced'): void {
    this.activeTab.set(tab);
  }

  /** Add a new request to the requests array */
  addRequest(): void {
    this.model.update((model) => ({
      ...model,
      config: {
        ...model.config,
        requests: [...(model.config.requests ?? []), { ...requestDefaults }],
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

  /** Add a global exit status code */
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

  /** Remove a global exit status code */
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

  /** Add early exit configuration to a specific request */
  addRequestEarlyExitConfig(index: number): void {
    this.model.update((model) => {
      const updatedRequests = [...(model.config.requests ?? [])];
      if (updatedRequests[index]) {
        updatedRequests[index] = {
          ...updatedRequests[index],
          earlyExit: {
            ...updatedRequests[index].earlyExit,
            enabled: true,
            exitStatusCodes: [500, 502, 503, 504],
            monitoringWindowMs: 5000,
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

  /** Remove early exit configuration from a specific request */
  removeRequestEarlyExitConfig(index: number): void {
    this.model.update((model) => {
      const updatedRequests = [...(model.config.requests ?? [])];
      if (updatedRequests[index]) {
        const request = updatedRequests[index];
        const { ...requestWithoutEarlyExit } = request;
        updatedRequests[index] = requestWithoutEarlyExit;
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

  /** Update early exit configuration for a specific request */
  updateRequestEarlyExitConfig(
    index: number,
    config: Partial<{
      enabled: boolean;
      errorRateThreshold?: number;
      errorCountThreshold?: number;
      exitStatusCodes: number[];
      monitoringWindowMs: number;
    }>,
  ): void {
    this.model.update((model) => {
      const updatedRequests = [...(model.config.requests ?? [])];
      if (updatedRequests[index]) {
        const currentEarlyExit = updatedRequests[index].earlyExit ?? {
          enabled: false,
          exitStatusCodes: [500, 502, 503, 504],
          monitoringWindowMs: 5000,
        };

        updatedRequests[index] = {
          ...updatedRequests[index],
          earlyExit: {
            ...currentEarlyExit,
            ...config,
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

  /** Add a status code to request-level early exit */
  addRequestExitStatusCode(requestIndex: number): void {
    this.model.update((model) => {
      const updatedRequests = [...(model.config.requests ?? [])];
      if (updatedRequests[requestIndex]?.earlyExit) {
        const currentCodes =
          updatedRequests[requestIndex].earlyExit!.exitStatusCodes ?? [];
        updatedRequests[requestIndex] = {
          ...updatedRequests[requestIndex],
          earlyExit: {
            ...updatedRequests[requestIndex].earlyExit!,
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

  /** Remove a status code from request-level early exit */
  removeRequestExitStatusCode(requestIndex: number, codeIndex: number): void {
    this.model.update((model) => {
      const updatedRequests = [...(model.config.requests ?? [])];
      if (updatedRequests[requestIndex]?.earlyExit?.exitStatusCodes) {
        const currentCodes =
          updatedRequests[requestIndex].earlyExit!.exitStatusCodes!;
        updatedRequests[requestIndex] = {
          ...updatedRequests[requestIndex],
          earlyExit: {
            ...updatedRequests[requestIndex].earlyExit!,
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

  /** Create an empty configuration structure */
  private createEmptyConfig(): ModifyConfigRequest {
    const config = JSON.parse(JSON.stringify(defaultTressiConfig));
    config.requests = [{ ...requestDefaults }];

    const defaultConfig: ModifyConfigRequest = {
      name: this.nameService.generate(),
      config,
    };
    return defaultConfig;
  }
}
