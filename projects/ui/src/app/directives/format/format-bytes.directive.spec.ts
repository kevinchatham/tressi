import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { FormatBytesDirective } from './format-bytes.directive';

@Component({
  imports: [FormatBytesDirective],
  standalone: true,
  template: `<div [appFormatBytes]="bytes()"></div>`,
})
class TestHostComponent {
  bytes = signal<number | undefined | null>(undefined);
}

describe('FormatBytesDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, FormatBytesDirective],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    element = fixture.nativeElement.querySelector('div');
    fixture.detectChanges();
  });

  it('should display "0 B" for undefined, null, or 0', async () => {
    // Test undefined (initial state)
    expect(element.textContent).toBe('0 B');

    // Test null
    component.bytes.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.textContent).toBe('0 B');

    // Test 0
    component.bytes.set(0);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.textContent).toBe('0 B');
  });

  it('should format bytes correctly (B, KB, MB, GB)', async () => {
    const testCases = [
      { expected: '512 B', input: 512 },
      { expected: '1.0 KB', input: 1024 },
      { expected: '1.5 KB', input: 1536 },
      { expected: '1.0 MB', input: 1048576 },
      { expected: '1.00 GB', input: 1073741824 },
    ];

    for (const { input, expected } of testCases) {
      component.bytes.set(input);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(element.textContent).toBe(expected);
    }
  });

  it('should handle negative values correctly', async () => {
    component.bytes.set(-2048);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.textContent).toBe('-2.0 KB');
  });
});
