import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  defaultTressiConfig,
  GlobalSummary,
  TestDocument,
} from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TestService } from '../../../../services/test.service';
import { HeroStatsComponent } from './hero-stats.component';

describe('HeroStatsComponent', () => {
  let component: HeroStatsComponent;
  let fixture: ComponentFixture<HeroStatsComponent>;
  let testServiceSpy: {
    getTestDuration: ReturnType<typeof vi.fn>;
  };

  const mockSummary: GlobalSummary = {
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
    histogram: {
      totalCount: 1000,
      min: 10,
      max: 120,
      mean: 50,
      stdDev: 20,
      percentiles: { 50: 45, 95: 80, 99: 100 },
      buckets: [],
    },
  };

  const mockTest: TestDocument = {
    id: 'test-123',
    configId: 'config-1',
    status: 'completed',
    epochCreatedAt: Date.now(),
    error: null,
    summary: {
      tressiVersion: '1.0.0',
      configSnapshot: defaultTressiConfig,
      global: mockSummary,
      endpoints: [],
    },
  };

  beforeEach(async () => {
    testServiceSpy = {
      getTestDuration: vi.fn(() => 10000),
    };

    await TestBed.configureTestingModule({
      imports: [HeroStatsComponent],
      providers: [{ provide: TestService, useValue: testServiceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroStatsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should compute targetAchievedPercentage correctly', () => {
    fixture.componentRef.setInput('selectedSummary', mockSummary);
    expect(component.targetAchievedPercentage()).toBe(0.95);
  });

  it('should return 0 for targetAchievedPercentage if no summary', () => {
    fixture.componentRef.setInput('selectedSummary', null);
    expect(component.targetAchievedPercentage()).toBe(0);
  });

  it('should return duration from test service', () => {
    fixture.componentRef.setInput('testData', mockTest);
    expect(component.getDurationSec()).toBe(10);
    expect(testServiceSpy.getTestDuration).toHaveBeenCalledWith(mockTest);
  });

  it('should return null for duration if no test data', () => {
    fixture.componentRef.setInput('testData', null);
    expect(component.getDurationSec()).toBeNull();
  });
});
