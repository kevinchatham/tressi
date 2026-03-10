import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormatNetworkThroughputDirective } from './format-network.directive';

@Component({
  standalone: true,
  imports: [FormatNetworkThroughputDirective],
  template: `<div [appFormatNetwork]="bytesPerSec()"></div>`,
})
class TestHostComponent {
  bytesPerSec = signal<number | undefined | null>(undefined);
}

describe('FormatNetworkThroughputDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, FormatNetworkThroughputDirective],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    element = fixture.nativeElement.querySelector('div')!;
    fixture.detectChanges();
  });

  it('should display "0 B/s" for undefined, null, or 0', async () => {
    // Test undefined (initial state)
    expect(element.textContent).toBe('0 B/s');

    // Test null
    component.bytesPerSec.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.textContent).toBe('0 B/s');

    // Test 0
    component.bytesPerSec.set(0);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.textContent).toBe('0 B/s');
  });

  it('should format network throughput correctly (B/s, KB/s, MB/s, GB/s)', async () => {
    const testCases = [
      { input: 512, expected: '512 B/s' },
      { input: 1024, expected: '1.0 KB/s' },
      { input: 1536, expected: '1.5 KB/s' },
      { input: 1048576, expected: '1.0 MB/s' },
      { input: 1073741824, expected: '1.00 GB/s' },
    ];

    for (const { input, expected } of testCases) {
      component.bytesPerSec.set(input);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(element.textContent).toBe(expected);
    }
  });

  it('should handle negative values correctly', async () => {
    component.bytesPerSec.set(-2048);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.textContent).toBe('-2.0 KB/s');
  });
});
