import { Component, input, output } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { TressiEarlyExitConfig } from '@tressi/shared/common';
import type { EarlyExitConfigRequestFormType } from '@tressi/shared/ui';

import { ButtonComponent } from '../../button/button.component';

@Component({
  imports: [ButtonComponent, FormField],
  selector: 'app-early-exit-config',
  templateUrl: './early-exit-config.component.html',
})
export class EarlyExitConfigComponent {
  /** Form instance from parent */
  readonly form = input.required<EarlyExitConfigRequestFormType>();

  /** Current early exit configuration model */
  readonly model = input.required<TressiEarlyExitConfig>();

  /** Event to add a new exit status code */
  readonly addExitStatusCode = output<void>();

  /** Event to remove an exit status code at specific index */
  readonly removeExitStatusCode = output<number>();

  /** Check if early exit is enabled */
  isEnabled(): boolean {
    return this.model()?.enabled ?? false;
  }

  /** Get the exit status codes array */
  getExitStatusCodes(): number[] {
    return this.model()?.exitStatusCodes ?? [];
  }
}
