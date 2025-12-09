import { Component, input, output } from '@angular/core';
import { Field } from '@angular/forms/signals';

import { IconComponent } from '../../icon/icon.component';
import { ModifyConfigRequestFormType } from '../config-form.component';

@Component({
  selector: 'app-request-item',
  imports: [Field, IconComponent],
  templateUrl: './request-item.component.html',
})
export class RequestItemComponent {
  /** Form instance from parent */
  readonly configForm = input.required<ModifyConfigRequestFormType>();

  /** Index of this request in the array */
  readonly requestIndex = input.required<number>();

  /** Event to remove this request */
  readonly removeRequest = output<void>();
}
