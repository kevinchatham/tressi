import { Component, input } from '@angular/core';
import { TressiConfig } from 'tressi-common/config';

import { IconComponent } from '../../icon/icon.component';
import { TressiConfigForm } from '../config-form.component';

@Component({
  selector: 'app-global-headers',
  imports: [IconComponent],
  templateUrl: './global-headers.component.html',
})
export class GlobalHeadersComponent {
  /** Form instance from parent */
  readonly configForm = input.required<TressiConfigForm>();

  /** Config model from parent */
  readonly configModel = input.required<TressiConfig>();
}
