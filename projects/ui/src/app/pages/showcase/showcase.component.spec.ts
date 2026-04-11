import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { BUTTON_COLORS } from '@tressi/shared/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShowcaseComponent } from './showcase.component';

describe('ShowcaseComponent', () => {
  let component: ShowcaseComponent;
  let fixture: ComponentFixture<ShowcaseComponent>;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    TestBed.configureTestingModule({
      imports: [ShowcaseComponent],
    });
    fixture = TestBed.createComponent(ShowcaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose BUTTON_COLORS', () => {
    expect(component.buttonColors).toBe(BUTTON_COLORS);
    expect(Array.isArray(component.buttonColors)).toBe(true);
    expect(component.buttonColors.length).toBeGreaterThan(0);
  });

  describe('logMessage', () => {
    it('should log hello to console', () => {
      component.logMessage();
      // biome-ignore lint/suspicious/noConsole: default
      expect(console.log).toHaveBeenCalledWith('hello');
    });
  });
});
