import {
  ChangeDetectionStrategy,
  Component,
  computed,
  model,
  signal,
} from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

@Component({
  selector: 'app-json-textarea',
  templateUrl: './json-textarea.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JsonTextareaComponent<T> implements FormValueControl<T> {
  value = model<T>(null as T);
  rows = model<number>(3);
  placeholder = model<string>('');

  error = signal<string | null>(null);

  displayValue = computed(() => {
    const val = this.value();
    if (val === null || val === undefined) {
      return '';
    }
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  });

  handleInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    const input = target.value;

    if (!input.trim()) {
      this.value.set(null as T);
      this.error.set(null);
      return;
    }

    try {
      const parsed = JSON.parse(input);
      this.value.set(parsed as T);
      this.error.set(null);
    } catch (e) {
      this.error.set(
        `Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`,
      );
      // Keep the invalid input in the textarea but don't update the model
    }
  }
}
