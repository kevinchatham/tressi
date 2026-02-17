import { CodeEditor } from '@acrodata/code-editor';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-json-textarea',
  templateUrl: './json-textarea.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CodeEditor],
})
export class JsonTextareaComponent<T> implements FormValueControl<T> {
  value = model<T>(null as T);
  rows = model<number>(3);
  placeholder = model<string>('');
  disabled = model<boolean>(false);
  valueChange = output<T>();

  error = signal<string | null>(null);

  private readonly themeService = inject(ThemeService);

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

  languages = languages;

  daisyThemeBase = computed(() =>
    EditorView.theme(
      {
        '&.cm-editor': {
          backgroundColor: this.themeService.base300(),
          color: this.themeService.baseContent(),
          height: 'auto',
          borderRadius: '8px',
          padding: '8px',
        },
        '.cm-content': {},
        '.cm-gutters': {
          backgroundColor: this.themeService.base300(),
          color: this.themeService.neutral(),
          border: 'none',
        },
      },
      { dark: true },
    ),
  );

  daisyHighlightStyle = computed(() =>
    HighlightStyle.define([
      { tag: tags.string, color: this.themeService.secondary() },
      { tag: tags.number, color: this.themeService.success() },
      { tag: tags.keyword, color: this.themeService.primary() },
      { tag: tags.operator, color: this.themeService.baseContent() },
      { tag: tags.brace, color: this.themeService.warning() },
      {
        tag: tags.null,
        color: this.themeService.primary(),
        fontStyle: 'italic',
      },
      { tag: tags.bool, color: this.themeService.primary() },
      { tag: tags.propertyName, color: this.themeService.info() },
      { tag: tags.comment, color: this.themeService.neutral() + 'aa' }, // Add transparency
    ]),
  );

  daisySyntaxHighlighting = computed(() =>
    syntaxHighlighting(this.daisyHighlightStyle()),
  );

  daisyTheme = computed(() => [
    this.daisyThemeBase(),
    this.daisySyntaxHighlighting(),
    EditorView.lineWrapping,
  ]);

  handleValueChange(newValue: string): void {
    // Don't process changes when disabled
    if (this.disabled()) {
      return;
    }

    if (!newValue.trim()) {
      this.value.set(null as T);
      this.error.set(null);
      this.valueChange.emit(null as T);
      return;
    }

    try {
      const parsed = JSON.parse(newValue);
      this.value.set(parsed as T);
      this.error.set(null);
      this.valueChange.emit(parsed as T);
    } catch (e) {
      this.error.set(
        `Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`,
      );
    }
  }
}
