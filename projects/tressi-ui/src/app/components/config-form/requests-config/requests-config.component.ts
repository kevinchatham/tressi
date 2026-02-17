import {
  AfterViewInit,
  Component,
  ElementRef,
  input,
  OnChanges,
  OnInit,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { Field } from '@angular/forms/signals';
import { httpMethodDefaults } from '@tressi-cli/common/config/schemas';

import { ModifyConfigRequest } from '../../../services/rpc.service';
import { ButtonComponent } from '../../button/button.component';
import { CollapsibleCardComponent } from '../../collapsible-card/collapsible-card.component';
import { IconComponent } from '../../icon/icon.component';
import { JsonTextareaComponent } from '../../json-textarea/json-textarea.component';
import { ModifyConfigRequestFormType } from '../config-form.component';
import { EarlyExitConfigComponent } from '../early-exit-config/early-exit-config.component';

@Component({
  selector: 'app-requests-config',
  imports: [
    Field,
    IconComponent,
    JsonTextareaComponent,
    EarlyExitConfigComponent,
    ButtonComponent,
    CollapsibleCardComponent,
  ],
  templateUrl: './requests-config.component.html',
})
export class RequestsConfigComponent
  implements AfterViewInit, OnInit, OnChanges
{
  /** Form instance from parent */
  readonly form = input.required<ModifyConfigRequestFormType>();

  /** Config model from parent */
  readonly model = input.required<ModifyConfigRequest>();

  /** Event to add a new request */
  readonly addRequest = output<void>();

  /** Event to remove a request */
  readonly removeRequest = output<number>();

  readonly jsonTextareaChange = output<void>();

  /** Event to add an exit status code to a specific request */
  readonly addRequestExitStatusCode = output<number>();

  /** Event to remove an exit status code from a specific request */
  readonly removeRequestExitStatusCode = output<{
    requestIndex: number;
    codeIndex: number;
  }>();

  /** Track expanded/collapsed state for each request */
  expandedRequests = new Set<number>();

  /** Signal to track the current request count */
  private readonly _requestCount = signal(0);

  /** Query for URL input elements */
  private readonly _urlInputs =
    viewChildren<ElementRef<HTMLInputElement>>('urlInput');

  ngAfterViewInit(): void {
    // Focus the first URL input on initialization
    this._focusLastUrlInput();
  }

  ngOnInit(): void {
    // Initialize request count
    this._requestCount.set(this.model().config.requests?.length || 0);
  }

  ngOnChanges(): void {
    const currentCount = this.model().config.requests?.length || 0;
    const previousCount = this._requestCount();

    // If a new request was added, handle expansion logic
    if (currentCount > previousCount) {
      // Collapse all existing requests
      for (let i = 0; i < currentCount - 1; i++) {
        this.expandedRequests.add(i);
      }

      // Ensure the new request is expanded
      this.expandedRequests.delete(currentCount - 1);

      // Update the count
      this._requestCount.set(currentCount);

      // Focus the new URL input after the view updates
      setTimeout(() => this._focusLastUrlInput(), 0);
    } else if (currentCount < previousCount) {
      // Handle request removal
      this._requestCount.set(currentCount);
    }
  }

  /** Toggle request section expansion */
  toggleRequest(index: number): void {
    if (this.expandedRequests.has(index)) {
      this.expandedRequests.delete(index);
    } else {
      this.expandedRequests.add(index);
    }
  }

  /** Check if request is expanded */
  isRequestExpanded(index: number): boolean {
    const currentRequestCount = this.model().config.requests?.length || 0;

    // If this is the newest request, always expand it
    if (
      index === currentRequestCount - 1 &&
      this.expandedRequests.has(index) === false
    ) {
      return true;
    }

    // Default behavior: expanded unless explicitly collapsed
    return !this.expandedRequests.has(index);
  }

  onJsonTextareaValueChange(): void {
    this.jsonTextareaChange.emit();
  }

  /** Available HTTP methods from schema */
  readonly httpMethods = httpMethodDefaults;

  /** Check if the HTTP method supports a request body */
  supportsRequestBody(method: string): boolean {
    const bodyMethods = ['POST', 'PUT', 'PATCH'];
    return bodyMethods.includes(method.toUpperCase());
  }

  /** Focus the last URL input element */
  private _focusLastUrlInput(): void {
    const inputs = this._urlInputs();
    if (inputs && inputs.length > 0) {
      const lastInput = inputs[inputs.length - 1];
      lastInput.nativeElement.focus();
    }
  }
}
