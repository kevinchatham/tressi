import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { FormatDateDirective } from './format-date.directive';

@Component({
  imports: [FormatDateDirective],
  standalone: true,
  template: `<div [appFormatDate]="date()"></div>`,
})
class TestHostComponent {
  date = signal<number | string | Date | undefined | null>(undefined);
}

describe('FormatDateDirective unit tests', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, FormatDateDirective],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    element = fixture.nativeElement.querySelector('div')!;
    fixture.detectChanges();
  });

  it('should display em dash for undefined', () => {
    expect(element.textContent).toBe('—');
  });

  it('should display em dash for null', () => {
    fixture.componentInstance.date.set(null);
    fixture.detectChanges();
    expect(element.textContent).toBe('—');
  });

  it('should display em dash for invalid string', () => {
    fixture.componentInstance.date.set('not a date');
    fixture.detectChanges();
    expect(element.textContent).toBe('—');
  });

  it('should format ISO string correctly', () => {
    const iso = '2023-01-01T00:00:00Z';
    fixture.componentInstance.date.set(iso);
    fixture.detectChanges();
    const expected = new Date(iso).toLocaleString();
    expect(element.textContent).toBe(expected);
  });

  it('should format Date object correctly', () => {
    const dateObj = new Date(2023, 0, 1, 0, 0, 0, 0);
    fixture.componentInstance.date.set(dateObj);
    fixture.detectChanges();
    const expected = dateObj.toLocaleString();
    expect(element.textContent).toBe(expected);
  });

  it('should format timestamp correctly', () => {
    const timestamp = 1672531200000; // 2023-01-01T00:00:00Z
    fixture.componentInstance.date.set(timestamp);
    fixture.detectChanges();
    const expected = new Date(timestamp).toLocaleString();
    expect(element.textContent).toBe(expected);
  });
});
