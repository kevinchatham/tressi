import { CodeEditor } from '@acrodata/code-editor';
import { Component, input, output, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeService } from '../../services/theme.service';
import { JsonTextareaComponent } from './json-textarea.component';

// Mock CodeEditor component to avoid loading heavy dependencies
@Component({
  selector: 'code-editor',
  standalone: true,
  template: '',
})
class MockCodeEditor {
  value = input('');
  language = input('');
  theme = input([]);
  lineWrapping = input(false);
  languages = input([]);
  placeholder = input('');
  setup = input('');
  disabled = input(false);
  change = output<string>();
  blur = output<void>();
}

describe('JsonTextareaComponent', () => {
  let component: JsonTextareaComponent<unknown>;
  let fixture: ComponentFixture<JsonTextareaComponent<unknown>>;
  let themeServiceMock: Partial<ThemeService>;

  beforeEach(async () => {
    themeServiceMock = {
      base100: signal('#ffffff'),
      baseContent: signal('#000000'),
      info: signal('#00ffff'),
      isDark: signal(false),
      neutral: signal('#888888'),
      neutralContent: signal('#000000'),
      primary: signal('#0000ff'),
      secondary: signal('#00ff00'),
      success: signal('#00ff00'),
      warning: signal('#ffff00'),
    };

    await TestBed.configureTestingModule({
      imports: [JsonTextareaComponent],
      providers: [{ provide: ThemeService, useValue: themeServiceMock }],
    })
      .overrideComponent(JsonTextareaComponent, {
        add: { imports: [MockCodeEditor] },
        remove: { imports: [CodeEditor] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(JsonTextareaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('displayValue', () => {
    it('should return empty string when value is null', () => {
      component.value.set(null);
      expect(component.displayValue()).toBe('');
    });

    it('should return empty string when value is undefined', () => {
      component.value.set(undefined);
      expect(component.displayValue()).toBe('');
    });

    it('should return stringified JSON when value is an object', () => {
      const val = { baz: 123, foo: 'bar' };
      component.value.set(val);
      expect(component.displayValue()).toBe(JSON.stringify(val, null, 2));
    });

    it('should return string representation if JSON.stringify fails', () => {
      // Create a circular reference to make stringify fail
      const circular: Record<string, unknown> = { a: 1 };
      circular['self'] = circular;
      component.value.set(circular);
      expect(component.displayValue()).toBe('[object Object]');
    });
  });

  describe('handleValueChange', () => {
    it('should set error on invalid JSON but not update value', () => {
      const newValue = '{ invalid json }';
      const valueSpy = vi.fn();
      component.valueChange.subscribe(valueSpy);

      component.handleValueChange(newValue);

      expect(component.error()).toContain('Invalid JSON');
      expect(component.value()).toStrictEqual({});
      expect(valueSpy).not.toHaveBeenCalled();
    });

    it('should clear error on valid JSON but not update value', () => {
      component.error.set('Some error');
      const newValue = '{"a": 1}';
      const valueSpy = vi.fn();
      component.valueChange.subscribe(valueSpy);

      component.handleValueChange(newValue);

      expect(component.error()).toBeNull();
      expect(component.value()).toStrictEqual({});
      expect(valueSpy).not.toHaveBeenCalled();
    });

    it('should handle empty or whitespace-only input by clearing error', () => {
      component.error.set('Some error');
      const valueSpy = vi.fn();
      component.valueChange.subscribe(valueSpy);

      component.handleValueChange('   ');

      expect(component.error()).toBeNull();
      expect(component.value()).toStrictEqual({});
      expect(valueSpy).toHaveBeenCalled();
    });
  });

  describe('handleBlur', () => {
    it('should update value and emit change on valid JSON', () => {
      const newValue = '{"a": 1, "b": "test"}';
      const expectedParsed = { a: 1, b: 'test' };
      const valueSpy = vi.fn();
      component.valueChange.subscribe(valueSpy);

      component.handleValueChange(newValue);
      component.handleBlur();

      expect(component.value()).toEqual(expectedParsed);
      expect(valueSpy).toHaveBeenCalledWith(expectedParsed);
    });

    it('should handle empty or whitespace-only input', () => {
      const valueSpy = vi.fn();
      component.valueChange.subscribe(valueSpy);

      component.handleValueChange('   ');
      component.handleBlur();

      expect(component.value()).toStrictEqual({});
      expect(valueSpy).toHaveBeenCalledWith({});
    });

    it('should not update value if there is a validation error', () => {
      const initialValue = { initial: true };
      component.value.set(initialValue);
      const valueSpy = vi.fn();
      component.valueChange.subscribe(valueSpy);

      component.handleValueChange('{ invalid }');
      expect(component.error()).not.toBeNull();

      component.handleBlur();

      expect(component.value()).toEqual(initialValue);
      expect(valueSpy).not.toHaveBeenCalled();
    });

    it('should not process changes when disabled', () => {
      component.disabled.set(true);
      const initialValue = { initial: true };
      component.value.set(initialValue);
      const valueSpy = vi.fn();
      component.valueChange.subscribe(valueSpy);

      // Even if we call handleValueChange, it should return early if disabled
      component.handleValueChange('{"new": true}');
      component.handleBlur();

      expect(component.value()).toEqual(initialValue);
      expect(valueSpy).not.toHaveBeenCalled();
    });
  });

  describe('theme integration', () => {
    it('should compute daisyTheme based on theme service', () => {
      const theme = component.daisyTheme();
      expect(theme).toBeDefined();
      expect(Array.isArray(theme)).toBe(true);
      expect(theme.length).toBeGreaterThan(0);
    });
  });

  describe('showCopyButton', () => {
    it('should show button when copyButton is set to show', () => {
      component.copyButton.set('show');
      expect(component.showCopyButton()).toBe(true);
    });

    it('should hide button when copyButton is set to hide', () => {
      component.copyButton.set('hide');
      expect(component.showCopyButton()).toBe(false);
    });

    it('should show button when disabled (auto mode)', () => {
      component.copyButton.set('auto');
      component.disabled.set(true);
      expect(component.showCopyButton()).toBe(true);
    });

    it('should hide button when not disabled (auto mode)', () => {
      component.copyButton.set('auto');
      component.disabled.set(false);
      expect(component.showCopyButton()).toBe(false);
    });
  });

  describe('copyToClipboard', () => {
    beforeEach(() => {
      vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    });

    it('should copy displayValue to clipboard', async () => {
      const testValue = { foo: 'bar' };
      component.value.set(testValue);

      await component.copyToClipboard();

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        JSON.stringify(testValue, null, 2),
      );
    });

    it('should set copied signal to true on success', async () => {
      component.value.set({ test: true });

      await component.copyToClipboard();

      expect(component.copied()).toBe(true);
    });

    it('should reset copied signal after 2 seconds', async () => {
      vi.useFakeTimers();
      component.value.set({ test: true });

      await component.copyToClipboard();
      expect(component.copied()).toBe(true);

      vi.advanceTimersByTime(2000);
      expect(component.copied()).toBe(false);

      vi.useRealTimers();
    });

    it('should silently fail if clipboard write fails', async () => {
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('fail'));
      component.value.set({ test: true });

      await component.copyToClipboard();

      expect(component.copied()).toBe(false);
    });
  });
});
