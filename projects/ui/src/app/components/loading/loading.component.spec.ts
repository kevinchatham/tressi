import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoadingComponent } from './loading.component';

describe('LoadingComponent', () => {
  let component: LoadingComponent;
  let fixture: ComponentFixture<LoadingComponent>;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [LoadingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LoadingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not render initially', () => {
    expect(component.shouldRender()).toBe(false);
    const overlay = fixture.nativeElement.querySelector(
      '[data-e2e="loading-overlay"]',
    );
    expect(overlay).toBeFalsy();
  });

  it('should render when navigating is true', () => {
    fixture.componentRef.setInput('navigating', true);
    fixture.detectChanges();

    expect(component.shouldRender()).toBe(true);
    expect(component.isFadingOut()).toBe(false);
    const overlay = fixture.nativeElement.querySelector(
      '[data-e2e="loading-overlay"]',
    );
    expect(overlay).toBeTruthy();
  });

  it('should start fading out when navigating becomes false', () => {
    // First set to true to show it
    fixture.componentRef.setInput('navigating', true);
    fixture.detectChanges();
    expect(component.shouldRender()).toBe(true);

    // Then set to false
    fixture.componentRef.setInput('navigating', false);
    fixture.detectChanges();

    expect(component.isFadingOut()).toBe(true);
    expect(component.shouldRender()).toBe(true); // Still rendering during fade out

    // Advance timers by 300ms
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    expect(component.shouldRender()).toBe(false);
    expect(component.isFadingOut()).toBe(false);
  });
});
