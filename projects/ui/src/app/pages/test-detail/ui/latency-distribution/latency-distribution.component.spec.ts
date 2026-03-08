import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LatencyHistogram } from '@tressi/shared/common';
import { describe, expect, it } from 'vitest';

import { LatencyDistributionComponent } from './latency-distribution.component';

describe('LatencyDistributionComponent', () => {
  let component: LatencyDistributionComponent;
  let fixture: ComponentFixture<LatencyDistributionComponent>;

  const mockHistogram: LatencyHistogram = {
    totalCount: 1000,
    min: 10,
    max: 120,
    mean: 50,
    stdDev: 20,
    percentiles: {
      1: 12,
      5: 15,
      10: 20,
      25: 30,
      50: 45,
      75: 70,
      90: 90,
      95: 100,
      99: 115,
    },
    buckets: [
      { lowerBound: 0, upperBound: 20, count: 100 },
      { lowerBound: 20, upperBound: 40, count: 200 },
      { lowerBound: 40, upperBound: 60, count: 400 },
      { lowerBound: 60, upperBound: 80, count: 200 },
      { lowerBound: 80, upperBound: 100, count: 100 },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LatencyDistributionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LatencyDistributionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit collapsedChange when onCollapsedChange is called', () => {
    const spy = vi.spyOn(component.collapsedChange, 'emit');
    component.onCollapsedChange(true);
    expect(spy).toHaveBeenCalledWith(true);
  });

  it('should return sorted histogram buckets', () => {
    const unsortedHistogram: LatencyHistogram = {
      ...mockHistogram,
      buckets: [
        { lowerBound: 20, upperBound: 40, count: 200 },
        { lowerBound: 0, upperBound: 20, count: 100 },
      ],
    };
    fixture.componentRef.setInput('histogram', unsortedHistogram);
    const buckets = component.getHistogramBuckets();
    expect(buckets[0].lowerBound).toBe(0);
    expect(buckets[1].lowerBound).toBe(20);
  });

  it('should return empty array if no histogram buckets', () => {
    fixture.componentRef.setInput('histogram', undefined);
    expect(component.getHistogramBuckets()).toEqual([]);
  });

  it('should calculate horizontal bar width correctly', () => {
    fixture.componentRef.setInput('histogram', mockHistogram);
    // max count is 400
    expect(component.getHorizontalBarWidth(200)).toBe('50%');
    expect(component.getHorizontalBarWidth(400)).toBe('100%');
    expect(component.getHorizontalBarWidth(0)).toBe('0%');
  });

  it('should calculate bucket height correctly (sqrt scale)', () => {
    fixture.componentRef.setInput('histogram', mockHistogram);
    // max count is 400
    // sqrt(100/400) * 100 = 0.5 * 100 = 50%
    expect(component.getBucketHeight(100)).toBe('50%');
    // sqrt(400/400) * 100 = 1 * 100 = 100%
    expect(component.getBucketHeight(400)).toBe('100%');
  });

  it('should generate bucket tooltip', () => {
    fixture.componentRef.setInput('histogram', mockHistogram);
    const bucket = mockHistogram.buckets[0]; // 0-20, count 100, total 1000 (10%)
    const tooltip = component.getBucketTooltip(bucket);
    expect(tooltip).toContain('0μs - 20.0ms');
    expect(tooltip).toContain('100 requests');
    expect(tooltip).toContain('10.0%');
  });

  it('should return percentile data', () => {
    fixture.componentRef.setInput('histogram', mockHistogram);
    const data = component.getPercentileData();
    expect(data.length).toBe(9);
    expect(data.find((p) => p.percentile === 50)?.value).toBe(45);
  });

  it('should return min/max', () => {
    fixture.componentRef.setInput('histogram', mockHistogram);
    expect(component.getMinMax()).toEqual({ min: 10, max: 120 });
  });

  it('should format latency correctly', () => {
    expect(component.formatLatency(0.5)).toBe('500μs');
    expect(component.formatLatency(500)).toBe('500.0ms');
    expect(component.formatLatency(1500)).toBe('1.50s');
  });

  it('should calculate bar width correctly', () => {
    expect(component.getBarWidth(50, 0, 100)).toBe('50%');
    expect(component.getBarWidth(0, 0, 100)).toBe('5%'); // min 5%
  });

  it('should calculate percentile bar width correctly', () => {
    fixture.componentRef.setInput('histogram', mockHistogram);
    // max percentile value is 115 (99th)
    const width = component.getPercentileBarWidth(57.5);
    expect(width).toBe('50%');
  });
});
