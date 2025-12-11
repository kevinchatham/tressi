import {
  AfterViewInit,
  Component,
  ElementRef,
  input,
  output,
  viewChildren,
} from '@angular/core';
import { Field } from '@angular/forms/signals';

import { ModifyConfigRequest } from '../../../services/rpc.service';
import { IconComponent } from '../../icon/icon.component';
import { JsonTextareaComponent } from '../../json-textarea/json-textarea.component';
import { ModifyConfigRequestFormType } from '../config-form.component';

@Component({
  selector: 'app-basic-config',
  imports: [Field, IconComponent, JsonTextareaComponent],
  templateUrl: './basic-config.component.html',
})
export class BasicConfigComponent implements AfterViewInit {
  /** Form instance from parent */
  readonly form = input.required<ModifyConfigRequestFormType>();

  /** Config model from parent */
  readonly model = input.required<ModifyConfigRequest>();

  /** Event to add a new request */
  readonly addRequest = output<void>();

  /** Event to remove a request */
  readonly removeRequest = output<number>();

  /** Track expanded/collapsed state for each request */
  expandedRequests = new Set<number>();

  /** Track the last request count to detect new requests */
  private lastRequestCount = 0;

  /** Query for URL input elements */
  private urlInputs = viewChildren<ElementRef<HTMLInputElement>>('urlInput');

  ngAfterViewInit(): void {
    // Focus the first URL input on initialization
    this.focusLastUrlInput();
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

    // If a new request was added, collapse all others and expand the new one
    if (currentRequestCount > this.lastRequestCount) {
      this.lastRequestCount = currentRequestCount;

      // Collapse all existing requests
      for (let i = 0; i < currentRequestCount - 1; i++) {
        this.expandedRequests.add(i);
      }

      // Ensure the new request is expanded
      this.expandedRequests.delete(currentRequestCount - 1);

      // Focus the new URL input after the view updates
      setTimeout(() => this.focusLastUrlInput(), 0);

      return index === currentRequestCount - 1;
    }

    // Default behavior: expanded unless explicitly collapsed
    return !this.expandedRequests.has(index);
  }

  /** Focus the last URL input element */
  private focusLastUrlInput(): void {
    const inputs = this.urlInputs();
    if (inputs && inputs.length > 0) {
      const lastInput = inputs[inputs.length - 1];
      lastInput.nativeElement.focus();
    }
  }
}
