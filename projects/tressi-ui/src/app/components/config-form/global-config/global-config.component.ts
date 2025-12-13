import { Component, input, output } from '@angular/core';
import { Field } from '@angular/forms/signals';

import { ModifyConfigRequest } from '../../../services/rpc.service';
import { IconComponent } from '../../icon/icon.component';
import { ModifyConfigRequestFormType } from '../config-form.component';

@Component({
  selector: 'app-global-config',
  imports: [Field, IconComponent],
  templateUrl: './global-config.component.html',
})
export class GlobalConfigComponent {
  /** Form instance from parent */
  readonly form = input.required<ModifyConfigRequestFormType>();

  /** Config model from parent */
  readonly model = input.required<ModifyConfigRequest>();

  /** Event to add an exit status code */
  readonly addExitStatusCode = output<void>();

  /** Event to remove an exit status code */
  readonly removeExitStatusCode = output<number>();
}
