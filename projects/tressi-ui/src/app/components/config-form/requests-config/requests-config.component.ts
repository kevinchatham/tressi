import { Component, input, output } from '@angular/core';
import { TressiConfig } from 'tressi-common/config';

import { IconComponent } from '../../icon/icon.component';
import { TressiConfigForm } from '../config-form.component';
import { RequestItemComponent } from '../request-item/request-item.component';

@Component({
  selector: 'app-requests-config',
  standalone: true,
  imports: [IconComponent, RequestItemComponent],
  templateUrl: './requests-config.component.html',
})
export class RequestsConfigComponent {
  /** Form instance from parent */
  readonly configForm = input.required<TressiConfigForm>();

  /** Config model from parent */
  readonly configModel = input.required<TressiConfig>();

  /** Event to add a new request */
  readonly addRequest = output<void>();

  /** Event to remove a request */
  readonly removeRequest = output<number>();
}
