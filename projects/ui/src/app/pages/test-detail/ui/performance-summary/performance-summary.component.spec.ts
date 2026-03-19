import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { EndpointSummary, GlobalSummary, LatencyHistogram } from '@tressi/shared/common';
import { describe, expect, it, vi } from 'vitest';

import { PerformanceSummaryComponent } from './performance-summary.component';

describe('PerformanceSummaryComponent', () => {
  let component: PerformanceSummaryComponent;
  let fixture: ComponentFixture<PerformanceSummaryComponent>;

  const mockGlobalSummary: GlobalSummary = {
    averageRequestsPerSecond: 100,
    avgProcessMemoryUsageMB: 100,
    avgSystemCpuUsagePercent: 50,
    epochEndedAt: 2000,
    epochStartedAt: 1000,
    errorRate: 0.05,
    failedRequests: 50,
    finalDurationSec: 10,
    histogram: {} as LatencyHistogram,
    maxLatencyMs: 120,
    minLatencyMs: 10,
    networkBytesPerSec: 5000,
    networkBytesReceived: 25000,
    networkBytesSent: 25000,
    p50LatencyMs: 45,
    p95LatencyMs: 80,
    p99LatencyMs: 100,
    peakRequestsPerSecond: 150,
    successfulRequests: 950,
    targetAchieved: 0.95,
    totalEndpoints: 1,
    totalRequests: 1000,
  };

  const mockEndpointSummary: EndpointSummary = {
    averageRequestsPerSecond: 50,
    errorRate: 0.04,
    failedRequests: 20,
    histogram: {} as LatencyHistogram,
    maxLatencyMs: 100,
    method: 'GET',
    minLatencyMs: 5,
    p50LatencyMs: 40,
    p95LatencyMs: 70,
    p99LatencyMs: 90,
    peakRequestsPerSecond: 75,
    responseSamples: [],
    statusCodeDistribution: { '200': 480 },
    successfulRequests: 480,
    targetAchieved: 0.96,
    theoreticalMaxRps: 100,
    totalRequests: 500,
    url: 'https://api.example.com',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PerformanceSummaryComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PerformanceSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should compute endpointSummary correctly', () => {
    fixture.componentRef.setInput('selectedSummary', mockEndpointSummary);
    expect(component.endpointSummary()).toEqual(mockEndpointSummary);
    expect(component.globalSummary()).toBeNull();
  });

  it('should compute globalSummary correctly', () => {
    fixture.componentRef.setInput('selectedSummary', mockGlobalSummary);
    expect(component.globalSummary()).toEqual(mockGlobalSummary);
    expect(component.endpointSummary()).toBeNull();
  });

  it('should emit collapsedChange when onCollapsedChange is called', () => {
    const spy = vi.spyOn(component.collapsedChange, 'emit');
    component.onCollapsedChange(true);
    expect(spy).toHaveBeenCalledWith(true);
  });

  describe('getCpuState', () => {
    it('should return good for low usage', () => {
      expect(component.getCpuState(50)).toBe('good');
    });
    it('should return warning for medium usage', () => {
      expect(component.getCpuState(75)).toBe('warning');
    });
    it('should return error for high usage', () => {
      expect(component.getCpuState(90)).toBe('error');
    });
    it('should return good for undefined', () => {
      expect(component.getCpuState(undefined)).toBe('good');
    });
  });

  describe('getMemoryState', () => {
    it('should return good for low usage', () => {
      expect(component.getMemoryState(400)).toBe('good');
    });
    it('should return warning for medium usage', () => {
      expect(component.getMemoryState(600)).toBe('warning');
    });
    it('should return error for high usage', () => {
      expect(component.getMemoryState(1200)).toBe('error');
    });
    it('should return good for undefined', () => {
      expect(component.getMemoryState(undefined)).toBe('good');
    });
  });

  describe('getStateClasses', () => {
    it('should return error classes', () => {
      expect(component.getStateClasses('error')).toEqual({
        bg: 'bg-error/20',
        text: 'text-error',
      });
    });
    it('should return warning classes', () => {
      expect(component.getStateClasses('warning')).toEqual({
        bg: 'bg-warning/20',
        text: 'text-warning',
      });
    });
    it('should return success classes for good', () => {
      expect(component.getStateClasses('good')).toEqual({
        bg: 'bg-success/20',
        text: 'text-success',
      });
    });
  });
});
