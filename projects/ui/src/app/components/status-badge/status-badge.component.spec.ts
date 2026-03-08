import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { StatusBadgeComponent } from './status-badge.component';

describe('StatusBadgeComponent', () => {
  let component: StatusBadgeComponent;
  let fixture: ComponentFixture<StatusBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusBadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatusBadgeComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('status', 'running');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should return correct color for running status', () => {
    expect(component.getStatusColor()).toContain('text-info');
  });

  it('should return correct icon for running status', () => {
    expect(component.getStatusIcon()).toBe('dynamic_form');
  });

  it('should return correct display text', () => {
    expect(component.getDisplayText()).toBe('Running');
  });
});
