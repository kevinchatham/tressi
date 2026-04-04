import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { FormatRpsDirective } from './format-rps.directive';

@Component({
  imports: [FormatRpsDirective],
  standalone: true,
  template: `<div [appFormatRps]="rps()"></div>`,
})
class TestHostComponent {
  rps = signal<number | undefined | null>(undefined);
}

describe('FormatRpsDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, FormatRpsDirective],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    element = fixture.nativeElement.querySelector('div')!;
    fixture.detectChanges();
  });

  it('should display "0/s" for falsy values (undefined, null, 0)', async () => {
    // Test undefined (initial state)
    expect(element.textContent).toBe('0/s');

    // Test null
    component.rps.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.textContent).toBe('0/s');

    // Test 0
    component.rps.set(0);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.textContent).toBe('0/s');
  });

  it('should format RPS correctly with locale string', async () => {
    const testCases = [
      { expected: '1/s', input: 1 },
      { expected: '999/s', input: 999 },
      { expected: '1,000/s', input: 1000 },
      { expected: '1,234,567/s', input: 1234567 },
    ];

    for (const { input, expected } of testCases) {
      component.rps.set(input);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(element.textContent).toBe(expected);
    }
  });

  it('should display decimal values with 1 decimal places when less than 1', async () => {
    const testCases = [
      { expected: '0.1/s', input: 0.1 },
      { expected: '0.2/s', input: 0.25 },
      { expected: '0.9/s', input: 0.99 },
    ];

    for (const { input, expected } of testCases) {
      component.rps.set(input);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(element.textContent).toBe(expected);
    }
  });

  it('should handle negative values correctly', async () => {
    component.rps.set(-1000);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.textContent).toBe('-1,000/s');
  });
});
