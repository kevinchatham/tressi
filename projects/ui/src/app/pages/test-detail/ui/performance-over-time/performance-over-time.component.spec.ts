import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChartType, PollingInterval } from '@tressi/shared/ui';
import { describe, expect, it, vi } from 'vitest';

import { PerformanceOverTimeComponent } from './performance-over-time.component';

describe('PerformanceOverTimeComponent', () => {
  let component: PerformanceOverTimeComponent;
  let fixture: ComponentFixture<PerformanceOverTimeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PerformanceOverTimeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PerformanceOverTimeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit chartTypeChange when onChartTypeChange is called', () => {
    const spy = vi.spyOn(component.chartTypeChange, 'emit');
    const event = {
      stopPropagation: vi.fn(),
      target: { value: 'latency' },
    } as unknown as Event;

    component.onChartTypeChange(event);

    expect(event.stopPropagation).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith('latency' as ChartType);
  });

  it('should emit pollingIntervalChange when onPollingIntervalChange is called', () => {
    const spy = vi.spyOn(component.pollingIntervalChange, 'emit');
    const event = {
      stopPropagation: vi.fn(),
      target: { value: '10000' },
    } as unknown as Event;

    component.onPollingIntervalChange(event);

    expect(event.stopPropagation).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(10000 as PollingInterval);
  });

  it('should emit refresh when onRefresh is called', () => {
    const spy = vi.spyOn(component.refresh, 'emit');
    const event = {
      stopPropagation: vi.fn(),
    } as unknown as Event;

    component.onRefresh(event);

    expect(event.stopPropagation).toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
  });

  it('should emit collapsedChange when onCollapsedChange is called', () => {
    const spy = vi.spyOn(component.collapsedChange, 'emit');
    component.onCollapsedChange(true);
    expect(spy).toHaveBeenCalledWith(true);
  });
});
