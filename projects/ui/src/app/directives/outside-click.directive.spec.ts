import { Component } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OutsideClickDirective } from './outside-click.directive';

@Component({
  imports: [OutsideClickDirective],
  standalone: true,
  template: `<div appOutsideClick (outsideClick)="onOutsideClick()"></div>`,
})
class TestHostComponent {
  onOutsideClick = vi.fn();
}

describe('OutsideClickDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, OutsideClickDirective],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    element = fixture.nativeElement.querySelector('div')!;
    fixture.detectChanges();
  });

  it('should create element with directive applied', () => {
    expect(element).toBeTruthy();
    expect(component.onOutsideClick).not.toHaveBeenCalled();
  });

  it('should not emit when clicking inside the host element', () => {
    // Click inside
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(component.onOutsideClick).not.toHaveBeenCalled();
  });

  it('should emit when clicking outside the host element', () => {
    // Click on document body (outside)
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(component.onOutsideClick).toHaveBeenCalledTimes(1);
  });

  it('should stop emitting after component destruction', async () => {
    // Click outside once
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(component.onOutsideClick).toHaveBeenCalledTimes(1);

    // Destroy the fixture
    fixture.destroy();

    // Click outside again
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(component.onOutsideClick).toHaveBeenCalledTimes(1); // No additional calls
  });
});
