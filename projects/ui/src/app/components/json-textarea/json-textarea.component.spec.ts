import { CodeEditor } from '@acrodata/code-editor';
import { Component, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeService } from '../../services/theme.service';
import { JsonTextareaComponent } from './json-textarea.component';

// Mock CodeEditor component to avoid loading heavy dependencies
@Component({
  selector: 'code-editor',
  template: '',
  standalone: true,
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
}

describe('JsonTextareaComponent', () => {
  let component: JsonTextareaComponent<unknown>;
  let fixture: ComponentFixture<JsonTextareaComponent<unknown>>;
  let themeServiceMock: Partial<ThemeService>;

  beforeEach(async () => {
    themeServiceMock = {
      isDark: signal(false),
      base100: signal('#ffffff'),
      neutralContent: signal('#000000'),
      primary: signal('#0000ff'),
      secondary: signal('#00ff00'),
      success: signal('#00ff00'),
      warning: signal('#ffff00'),
      info: signal('#00ffff'),
      neutral: signal('#888888'),
      baseContent: signal('#000000'),
    };

    await TestBed.configureTestingModule({
      imports: [JsonTextareaComponent],
      providers: [{ provide: ThemeService, useValue: themeServiceMock }],
    })
      .overrideComponent(JsonTextareaComponent, {
        remove: { imports: [CodeEditor] },
        add: { imports: [MockCodeEditor] },
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
      const val = { foo: 'bar', baz: 123 };
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
    it('should update value and emit change on valid JSON', () => {
      const newValue = '{"a": 1, "b": "test"}';
      const expectedParsed = { a: 1, b: 'test' };
      const valueSpy = vi.fn();
      component.valueChange.subscribe(valueSpy);

      component.handleValueChange(newValue);

      expect(component.value()).toEqual(expectedParsed);
      expect(component.error()).toBeNull();
      expect(valueSpy).toHaveBeenCalledWith(expectedParsed);
    });

    it('should set error on invalid JSON', () => {
      const newValue = '{ invalid json }';
      const valueSpy = vi.fn();
      component.valueChange.subscribe(valueSpy);

      component.handleValueChange(newValue);

      expect(component.error()).toContain('Invalid JSON');
      expect(valueSpy).not.toHaveBeenCalled();
    });

    it('should handle empty or whitespace-only input', () => {
      const valueSpy = vi.fn();
      component.valueChange.subscribe(valueSpy);

      component.handleValueChange('   ');

      expect(component.value()).toBeNull();
      expect(component.error()).toBeNull();
      expect(valueSpy).toHaveBeenCalledWith(null);
    });

    it('should not process changes when disabled', () => {
      component.disabled.set(true);
      const initialValue = { initial: true };
      component.value.set(initialValue);
      const valueSpy = vi.fn();
      component.valueChange.subscribe(valueSpy);

      component.handleValueChange('{"new": true}');

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
});
