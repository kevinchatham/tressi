import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { FormatPercentageDirective } from './format-percentage.directive';

@Component({
  imports: [FormatPercentageDirective],
  standalone: true,
  template: `<div [appFormatPercentage]="value()"></div>`,
})
class TestHostComponent {
  value = signal<number | undefined | null>(undefined);
}

describe('FormatPercentageDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, FormatPercentageDirective],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    element = fixture.nativeElement.querySelector('div')!;
    fixture.detectChanges();
  });

  it('should display "0%" for undefined, null, or 0', async () => {
    // Test undefined (initial state)
    expect(element.textContent).toBe('0%');

    // Test null
    component.value.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.textContent).toBe('0%');

    // Test 0
    component.value.set(0);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.textContent).toBe('0%');
  });

  it('should format percentages correctly', async () => {
    const testCases = [
      { expected: '0.5%', input: 0.005 },
      { expected: '1.0%', input: 0.01 },
      { expected: '12.3%', input: 0.123 },
      { expected: '100%', input: 1 },
    ];

    for (const { input, expected } of testCases) {
      component.value.set(input);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(element.textContent).toBe(expected);
    }
  });

  it('should handle negative values correctly', async () => {
    component.value.set(-0.5);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.textContent).toBe('-50%');
  });
});
