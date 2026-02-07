import { Component, input, output } from '@angular/core';
import { Field, form } from '@angular/forms/signals';
import { TressiEarlyExitConfig } from '@tressi-cli/common/config/types';

import { ButtonComponent } from '../../button/button.component';

export type EarlyExitConfigRequestFormType = ReturnType<
  typeof form<TressiEarlyExitConfig>
>;

@Component({
  selector: 'app-early-exit-config',
  imports: [Field, ButtonComponent],
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
