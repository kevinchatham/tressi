import { Component } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { PreventNumberScrollDirective } from './prevent-number-scroll.directive';

@Component({
  imports: [PreventNumberScrollDirective],
  standalone: true,
  template: `<input type="number" appPreventNumberScroll />`,
})
class TestHostComponent {}

describe('PreventNumberScrollDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let inputElement: HTMLInputElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    inputElement = fixture.nativeElement.querySelector('input')!;
  });

  it('should be created', () => {
    expect(inputElement).toBeTruthy();
  });

  it('should prevent default on wheel event', () => {
    const wheelEvent = new WheelEvent('wheel', { bubbles: true });
    const preventDefaultSpy = vi.spyOn(wheelEvent, 'preventDefault');

    inputElement.dispatchEvent(wheelEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});
