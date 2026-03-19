import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { FormatNumberDirective } from './format-number.directive';

@Component({
  imports: [FormatNumberDirective],
  standalone: true,
  template: `<div [appFormatNumber]="value()"></div>`,
})
class TestHostComponent {
  value = signal<number | undefined | null>(undefined);
}

describe('FormatNumberDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, FormatNumberDirective],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    element = fixture.nativeElement.querySelector('div')!;
    fixture.detectChanges();
  });

  it('should display "0" for undefined or null', async () => {
    // Test undefined (initial state)
    expect(element.textContent).toBe('0');

    // Test null
    component.value.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.textContent).toBe('0');
  });

  it('should format numbers correctly using humanNumber', async () => {
    const testCases = [
      { expected: '0', input: 0 },
      { expected: '999', input: 999 },
      { expected: '1k', input: 1000 },
      { expected: '1.5k', input: 1500 },
      { expected: '1m', input: 1000000 },
    ];

    for (const { input, expected } of testCases) {
      component.value.set(input);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(element.textContent).toBe(expected);
    }
  });

  it('should handle negative values correctly', async () => {
    component.value.set(-1000);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.textContent).toBe('-1k');
  });
});
