import { Component, input, output } from '@angular/core';

import { ModifyConfigRequest } from '../../../services/rpc.service';
import { IconComponent } from '../../icon/icon.component';
import { ModifyConfigRequestFormType } from '../config-form.component';
import { RequestItemComponent } from '../request-item/request-item.component';

@Component({
  selector: 'app-requests-config',
  imports: [IconComponent, RequestItemComponent],
  templateUrl: './requests-config.component.html',
})
export class RequestsConfigComponent {
  /** Form instance from parent */
  readonly configForm = input.required<ModifyConfigRequestFormType>();

  /** Config model from parent */
  readonly configModel = input.required<ModifyConfigRequest>();

  /** Event to add a new request */
  readonly addRequest = output<void>();

  /** Event to remove a request */
  readonly removeRequest = output<number>();
}
