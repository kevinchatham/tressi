import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { FormatMemoryDirective } from './format-memory.directive';

@Component({
  imports: [FormatMemoryDirective],
  standalone: true,
  template: `<div [appFormatMemory]="mb()"></div>`,
})
class TestHostComponent {
  mb = signal<number | undefined | null>(undefined);
}

describe('FormatMemoryDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, FormatMemoryDirective],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    element = fixture.nativeElement.querySelector('div')!;
    fixture.detectChanges();
  });

  it('should display "0 MB" for undefined, null, or 0', async () => {
    // Test undefined (initial state)
    expect(element.textContent).toBe('0 MB');

    // Test null
    component.mb.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.textContent).toBe('0 MB');

    // Test 0
    component.mb.set(0);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.textContent).toBe('0 MB');
  });

  it('should format memory correctly (MB, GB)', async () => {
    const testCases = [
      { expected: '512 MB', input: 512 },
      { expected: '1023 MB', input: 1023 },
      { expected: '1.00 GB', input: 1024 },
      { expected: '1.46 GB', input: 1500 },
      { expected: '2.00 GB', input: 2048 },
    ];

    for (const { input, expected } of testCases) {
      component.mb.set(input);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(element.textContent).toBe(expected);
    }
  });

  it('should handle negative values correctly', async () => {
    component.mb.set(-512);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.textContent).toBe('-512 MB');

    component.mb.set(-1024);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.textContent).toBe('-1.00 GB');
  });
});
