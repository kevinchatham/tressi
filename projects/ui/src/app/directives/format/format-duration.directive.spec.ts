import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { FormatDurationDirective } from './format-duration.directive';

@Component({
  standalone: true,
  imports: [FormatDurationDirective],
  template: `<div [appFormatDuration]="value"></div>`,
})
class TestHostComponent {
  value: number | undefined = undefined;
}

describe('FormatDurationDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, FormatDurationDirective],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    element = fixture.nativeElement.querySelector('div');
    fixture.detectChanges();
  });

  it('should create element with directive applied', () => {
    expect(element).toBeTruthy();
  });
});
