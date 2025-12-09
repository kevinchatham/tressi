import { Component, input, output } from '@angular/core';
import { Field } from '@angular/forms/signals';

import { ModifyConfigRequest } from '../../../services/rpc.service';
import { IconComponent } from '../../icon/icon.component';
import { ModifyConfigRequestFormType } from '../config-form.component';

@Component({
  selector: 'app-worker-early-exit',
  imports: [Field, IconComponent],
  templateUrl: './worker-early-exit.component.html',
})
export class WorkerEarlyExitComponent {
  /** Form instance from parent */
  readonly form = input.required<ModifyConfigRequestFormType>();

  /** Config model from parent */
  readonly model = input.required<ModifyConfigRequest>();

  /** Event to add a new per-endpoint threshold */
  readonly addPerEndpointThreshold = output<void>();

  /** Event to remove a per-endpoint threshold */
  readonly removePerEndpointThreshold = output<number>();

  /** Event to add a worker exit status code */
  readonly addWorkerExitStatusCode = output<void>();

  /** Event to remove a worker exit status code */
  readonly removeWorkerExitStatusCode = output<number>();
}
