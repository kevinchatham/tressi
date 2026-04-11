import { CodeEditor } from '@acrodata/code-editor';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { ThemeService } from '../../services/theme.service';
import { ButtonComponent } from '../button/button.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CodeEditor, ButtonComponent],
  selector: 'app-json-textarea',
  templateUrl: './json-textarea.component.html',
})
export class JsonTextareaComponent<T> implements FormValueControl<T> {
  value = model<T>({} as T);
  rows = model<number>(3);
  placeholder = model<string>('');
  disabled = model<boolean>(false);
  valueChange = output<T>();

  copyButton = model<'show' | 'hide' | 'auto'>('auto');
  copied = signal<boolean>(false);

  showCopyButton = computed(() => {
    const setting = this.copyButton();
    if (setting === 'show') return true;
    if (setting === 'hide') return false;
    return this.disabled();
  });

  error = signal<string | null>(null);
  private _lastValue = '';

  private readonly _themeService = inject(ThemeService);

  constructor() {
    effect(() => {
      const val = this.value();
      if (val !== null && val !== undefined) {
        this._lastValue = JSON.stringify(val, null, 2);
      } else {
        this._lastValue = '';
      }
    });
  }

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
        '.cm-content': {},
        '.cm-cursor': {
          borderLeftColor: this._themeService.primary(),
          borderLeftWidth: '2px',
        },
        '.cm-gutters': {
          backgroundColor: this._themeService.base100(),
          border: 'none',
          color: this._themeService.neutralContent(),
        },
        '.cm-selectionBackground': {
          backgroundColor: 'transparent',
        },
        '&.cm-editor': {
          backgroundColor: this._themeService.base100(),
          borderRadius: '8px',
          color: this._themeService.neutralContent(),
          height: 'auto',
          padding: '8px',
        },
        '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
          backgroundColor: this._themeService.primary(),
          opacity: 0.1,
        },
      },
      { dark: this._themeService.isDark() },
    ),
  );

  daisyHighlightStyle = computed(() =>
    HighlightStyle.define([
      { color: this._themeService.secondary(), tag: tags.string },
      { color: this._themeService.success(), tag: tags.number },
      { color: this._themeService.primary(), tag: tags.keyword },
      { color: this._themeService.baseContent(), tag: tags.operator },
      { color: this._themeService.warning(), tag: tags.brace },
      {
        color: this._themeService.primary(),
        fontStyle: 'italic',
        tag: tags.null,
      },
      { color: this._themeService.primary(), tag: tags.bool },
      { color: this._themeService.info(), tag: tags.propertyName },
      { color: `${this._themeService.neutral()}aa`, tag: tags.comment },
    ]),
  );

  daisySyntaxHighlighting = computed(() => syntaxHighlighting(this.daisyHighlightStyle()));

  daisyTheme = computed(() => [
    this.daisyThemeBase(),
    this.daisySyntaxHighlighting(),
    EditorView.lineWrapping,
  ]);

  handleValueChange(newValue: string): void {
    if (this.disabled()) {
      return;
    }

    this._lastValue = newValue;

    // We only validate the JSON here, but we don't update the `value` signal
    // until the editor loses focus. This prevents the cursor from jumping.
    if (!newValue.trim()) {
      this.error.set(null);
      this.value.set({} as T);
      this.valueChange.emit({} as T);
      return;
    }

    try {
      JSON.parse(newValue);
      this.error.set(null);
    } catch (e) {
      this.error.set(`Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  handleBlur(): void {
    if (this.disabled() || this.error()) {
      return;
    }

    const newValue = this._lastValue;

    if (!newValue.trim()) {
      const emptyObj = {} as T;
      this.value.set(emptyObj);
      this.valueChange.emit(emptyObj);
      return;
    }

    try {
      const parsed = JSON.parse(newValue);
      this.value.set(parsed as T);
      this.valueChange.emit(parsed as T);
    } catch {
      // Should not happen if we validated in handleValueChange
    }
  }

  async copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.displayValue());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Silently fail - button is non-essential
    }
  }
}
