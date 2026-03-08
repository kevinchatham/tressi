import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  EndpointSummary,
  GlobalSummary,
  LatencyHistogram,
} from '@tressi/shared/common';
import { describe, expect, it, vi } from 'vitest';

import { PerformanceSummaryComponent } from './performance-summary.component';

describe('PerformanceSummaryComponent', () => {
  let component: PerformanceSummaryComponent;
  let fixture: ComponentFixture<PerformanceSummaryComponent>;

  const mockGlobalSummary: GlobalSummary = {
    totalEndpoints: 1,
    totalRequests: 1000,
    successfulRequests: 950,
    failedRequests: 50,
    minLatencyMs: 10,
    maxLatencyMs: 120,
    p50LatencyMs: 45,
    p95LatencyMs: 80,
    p99LatencyMs: 100,
    finalDurationSec: 10,
    epochStartedAt: 1000,
    epochEndedAt: 2000,
    errorRate: 0.05,
    averageRequestsPerSecond: 100,
    peakRequestsPerSecond: 150,
    networkBytesSent: 25000,
    networkBytesReceived: 25000,
    networkBytesPerSec: 5000,
    avgSystemCpuUsagePercent: 50,
    avgProcessMemoryUsageMB: 100,
    targetAchieved: 0.95,
    histogram: {} as LatencyHistogram,
  };

  const mockEndpointSummary: EndpointSummary = {
    url: 'https://api.example.com',
    method: 'GET',
    totalRequests: 500,
    successfulRequests: 480,
    failedRequests: 20,
    minLatencyMs: 5,
    maxLatencyMs: 100,
    p50LatencyMs: 40,
    p95LatencyMs: 70,
    p99LatencyMs: 90,
    errorRate: 0.04,
    averageRequestsPerSecond: 50,
    peakRequestsPerSecond: 75,
    targetAchieved: 0.96,
    theoreticalMaxRps: 100,
    statusCodeDistribution: { '200': 480 },
    responseSamples: [],
    histogram: {} as LatencyHistogram,
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
