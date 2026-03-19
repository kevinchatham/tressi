import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ButtonComponent } from './button.component';

describe('ButtonComponent', () => {
  let component: ButtonComponent;
  let fixture: ComponentFixture<ButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the title when provided', () => {
    fixture.componentRef.setInput('title', 'Click Me');
    fixture.detectChanges();

    const span = fixture.nativeElement.querySelector('span');
    expect(span.textContent).toContain('Click Me');
  });

  it('should use tooltip as button title and aria-label if provided', () => {
    fixture.componentRef.setInput('tooltip', 'Helpful Tooltip');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button');
    expect(button.getAttribute('title')).toBe('Helpful Tooltip');
    expect(button.getAttribute('aria-label')).toBe('Helpful Tooltip');
  });

  it('should use title as button title and aria-label if tooltip is not provided', () => {
    fixture.componentRef.setInput('title', 'Button Title');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button');
    expect(button.getAttribute('title')).toBe('Button Title');
    expect(button.getAttribute('aria-label')).toBe('Button Title');
  });

  it('should disable the button when disabled input is true', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button');
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    // Host binding check
    expect(fixture.nativeElement.style.pointerEvents).toBe('none');
  });

  it('should apply correct classes based on color input', () => {
    fixture.componentRef.setInput('color', 'primary');
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');
    expect(button.classList.contains('btn-primary')).toBe(true);

    fixture.componentRef.setInput('color', 'secondary');
    fixture.detectChanges();
    expect(button.classList.contains('btn-secondary')).toBe(true);

    fixture.componentRef.setInput('color', 'rainbow');
    fixture.detectChanges();
    expect(button.classList.contains('btn-rainbow-outline')).toBe(true);
  });

  it('should apply ghost class when ghost input is true', () => {
    fixture.componentRef.setInput('ghost', true);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');
    expect(button.classList.contains('btn-ghost')).toBe(true);
  });

  it('should apply rainbow-ghost class when color is rainbow and ghost is true', () => {
    fixture.componentRef.setInput('color', 'rainbow');
    fixture.componentRef.setInput('ghost', true);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');
    expect(button.classList.contains('btn-rainbow-ghost')).toBe(true);
  });

  it('should render an icon when icon input is provided', () => {
    fixture.componentRef.setInput('icon', 'search');
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('app-icon');
    expect(icon).toBeTruthy();
  });

  it('should render two icons and handle toggling when secondaryIcon is provided', () => {
    fixture.componentRef.setInput('icon', 'play_arrow');
    fixture.componentRef.setInput('secondaryIcon', 'pause');
    fixture.detectChanges();

    const icons = fixture.nativeElement.querySelectorAll('app-icon');
    expect(icons.length).toBe(2);

    const button = fixture.nativeElement.querySelector('button');
    button.click();
    fixture.detectChanges();

    expect(component.toggled()).toBe(true);

    button.click();
    fixture.detectChanges();
    expect(component.toggled()).toBe(false);
  });

  it('should emit click event when clicked and not disabled', () => {
    const clickSpy = vi.spyOn(component.click, 'emit');
    const button = fixture.nativeElement.querySelector('button');

    button.click();
    expect(clickSpy).toHaveBeenCalled();
  });

  it('should not emit click event when clicked and disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const clickSpy = vi.spyOn(component.click, 'emit');

    // We need to call onClick directly or trigger it because pointer-events: none might prevent the click event in a real browser,
    // but in JSDOM it might still trigger if we use button.click().
    // However, the component logic has an explicit check for !this.disabled().
    component.onClick(new MouseEvent('click'));
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('should set data-e2e attribute from input', () => {
    fixture.componentRef.setInput('data-e2e', 'test-button');
    fixture.detectChanges();
    // Host binding
    expect(fixture.nativeElement.getAttribute('data-e2e')).toBe('test-button');
  });

  it('should set button type and tabindex', () => {
    fixture.componentRef.setInput('type', 'submit');
    fixture.componentRef.setInput('tabindex', 5);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button');
    expect(button.getAttribute('type')).toBe('submit');
    expect(button.getAttribute('tabindex')).toBe('5');
  });
});
