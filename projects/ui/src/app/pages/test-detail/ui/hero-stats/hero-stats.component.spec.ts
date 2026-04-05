import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { defaultTressiConfig, type GlobalSummary, type TestDocument } from '@tressi/shared/common';
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
    averageRequestsPerSecond: 100,
    avgProcessMemoryUsageMB: 100,
    avgSystemCpuUsagePercent: 50,
    earlyExitTriggered: false,
    epochEndedAt: 2000,
    epochStartedAt: 1000,
    errorRate: 0.05,
    failedRequests: 50,
    finalDurationSec: 10,
    histogram: {
      buckets: [],
      max: 120,
      mean: 50,
      min: 10,
      percentiles: { 50: 45, 95: 80, 99: 100 },
      stdDev: 20,
      totalCount: 1000,
    },
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

  const mockTest: TestDocument = {
    configId: 'config-1',
    epochCreatedAt: Date.now(),
    error: null,
    id: 'test-123',
    status: 'completed',
    summary: {
      configSnapshot: defaultTressiConfig,
      endpoints: [],
      global: mockSummary,
      tressiVersion: '1.0.0',
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
