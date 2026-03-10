import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { FormatLatencyDirective } from './format-latency.directive';

@Component({
  standalone: true,
  imports: [FormatLatencyDirective],
  template: `<div [appFormatLatency]="value"></div>`,
})
class TestHostComponent {
  value: number | undefined = undefined;
}

describe('FormatLatencyDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, FormatLatencyDirective],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    element = fixture.nativeElement.querySelector('div');
    fixture.detectChanges();
  });

  it('should create element with directive applied', () => {
    expect(element).toBeTruthy();
  });
});
