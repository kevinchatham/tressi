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

  it('should format numbers correctly', async () => {
    const testCases = [
      { expected: '0', input: 0 },
      { expected: '1', input: 1 },
      { expected: '10', input: 10 },
      { expected: '100', input: 100 },
      { expected: '999', input: 999 },
      { expected: '1k', input: 1000 },
      { expected: '1.1k', input: 1100 },
      { expected: '10k', input: 10000 },
      { expected: '10k', input: 10100 },
      { expected: '100k', input: 100000 },
      { expected: '1m', input: 999999 },
      { expected: '1m', input: 1000000 },
    ];

    for (const { input, expected } of testCases) {
      component.value.set(input);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(element.textContent).toBe(expected);
    }
  });
});
