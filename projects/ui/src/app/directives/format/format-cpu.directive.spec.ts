import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { FormatCpuUsageDirective } from './format-cpu.directive';

@Component({
  standalone: true,
  imports: [FormatCpuUsageDirective],
  template: `<div [appFormatCpu]="cpu()"></div>`,
})
class TestHostComponent {
  cpu = signal<number | undefined | null>(undefined);
}

describe('FormatCpuUsageDirective unit tests', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, FormatCpuUsageDirective],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    element = fixture.nativeElement.querySelector('div')!;
    fixture.detectChanges();
  });

  it('should display 0.0% for undefined', () => {
    expect(element.textContent).toBe('0.0%');
  });

  it('should display 0.0% for null', () => {
    fixture.componentInstance.cpu.set(null);
    fixture.detectChanges();
    expect(element.textContent).toBe('0.0%');
  });

  it('should format 12.345 as 12.3%', () => {
    fixture.componentInstance.cpu.set(12.345);
    fixture.detectChanges();
    expect(element.textContent).toBe('12.3%');
  });

  it('should format negative value correctly', () => {
    fixture.componentInstance.cpu.set(-5);
    fixture.detectChanges();
    expect(element.textContent).toBe('-5.0%');
  });
});
