import { Component, inject, input } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { TressiEarlyExitConfig } from '@tressi/shared/common';
import type { EarlyExitConfigRequestFormType } from '@tressi/shared/ui';
import { PreventNumberScrollDirective } from '../../../directives/prevent-number-scroll.directive';
import { ButtonComponent } from '../../button/button.component';
import { ConfigFormService } from '../config-form.service';

@Component({
  imports: [ButtonComponent, FormField, PreventNumberScrollDirective],
  selector: 'app-early-exit-config',
  templateUrl: './early-exit-config.component.html',
})
export class EarlyExitConfigComponent {
  private readonly _service = inject(ConfigFormService);

  readonly form = input.required<EarlyExitConfigRequestFormType>();

  readonly model = input.required<TressiEarlyExitConfig>();

  readonly requestIndex = input<number | undefined>(undefined);

  isEnabled(): boolean {
    return this.model()?.enabled ?? false;
  }

  getExitStatusCodes(): number[] {
    return this.model()?.exitStatusCodes ?? [];
  }

  addExitStatusCode(): void {
    const idx = this.requestIndex();
    if (idx !== undefined) {
      this._service.addRequestExitStatusCode(idx);
    } else {
      this._service.addGlobalExitStatusCode();
    }
  }

  removeExitStatusCode(codeIndex: number): void {
    const idx = this.requestIndex();
    if (idx !== undefined) {
      this._service.removeRequestExitStatusCode(idx, codeIndex);
    } else {
      this._service.removeGlobalExitStatusCode(codeIndex);
    }
  }
}
