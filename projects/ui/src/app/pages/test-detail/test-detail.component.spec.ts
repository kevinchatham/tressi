import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChartType } from '@tressi/shared/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LogService } from '../../services/log.service';
import { AppRouterService } from '../../services/router.service';
import { TestService } from '../../services/test.service';
import { TestDetailComponent } from './test-detail.component';
import { TestDetailService } from './test-detail.service';

describe('TestDetailComponent', () => {
  let fixture: ComponentFixture<TestDetailComponent>;
  let component: TestDetailComponent;
  let service: TestDetailService;
  let toHomeSpy: ReturnType<typeof vi.fn>;
  let deleteTestSpy: ReturnType<typeof vi.fn>;
  let logServiceSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    toHomeSpy = vi.fn();
    deleteTestSpy = vi.fn(() => Promise.resolve());
    logServiceSpy = vi.fn();

    await TestBed.configureTestingModule({
      imports: [TestDetailComponent],
      providers: [
        TestDetailService,
        {
          provide: AppRouterService,
          useValue: {
            toHome: toHomeSpy,
            isOnDocs: vi.fn(() => false),
          },
        },
        {
          provide: TestService,
          useValue: {
            deleteTest: deleteTestSpy,
            getTestDuration: vi.fn(() => 10000),
          },
        },
        {
          provide: LogService,
          useValue: {
            info: logServiceSpy,
            error: logServiceSpy,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestDetailComponent);
    fixture.componentRef.setInput('data', {
      test: {
        id: 'test-123',
        configId: 'config-1',
        status: 'completed',
        epochCreatedAt: Date.now(),
        error: null,
        summary: null,
      },
      metrics: null,
    });
    component = fixture.componentInstance;
    service = fixture.debugElement.injector.get(TestDetailService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should have default signals initialized', () => {
      expect(component.showDeleteModal).toBeDefined();
      expect(component.isDeleting).toBeDefined();
      expect(component.configCollapsed).toBeDefined();
      expect(component.performanceSummaryCollapsed).toBeDefined();
      expect(component.performanceOverTimeCollapsed).toBeDefined();
      expect(component.latencyDistributionCollapsed).toBeDefined();
      expect(component.responseSamplesCollapsed).toBeDefined();
    });

    it('should have chart options defined', () => {
      expect(component.chartOptions).toBeDefined();
      expect(component.chartOptions.length).toBeGreaterThan(0);
    });

    it('should have polling options defined', () => {
      expect(component.pollingOptions).toBeDefined();
      expect(component.pollingOptions.length).toBeGreaterThan(0);
    });
  });

  describe('getYAxisLabel', () => {
    it('should return "Req/sec" for throughput chart types', () => {
      service.selectedChartType.set('peak_throughput' as ChartType);
      expect(component.getYAxisLabel()).toBe('Req/sec');

      service.selectedChartType.set('average_throughput' as ChartType);
      expect(component.getYAxisLabel()).toBe('Req/sec');
    });

    it('should return "ms" for latency chart types', () => {
      service.selectedChartType.set('latency' as ChartType);
      expect(component.getYAxisLabel()).toBe('ms');

      service.selectedChartType.set('latency_p95' as ChartType);
      expect(component.getYAxisLabel()).toBe('ms');

      service.selectedChartType.set('latency_p99' as ChartType);
      expect(component.getYAxisLabel()).toBe('ms');
    });

    it('should return "%" for rate chart types', () => {
      service.selectedChartType.set('target_achieved' as ChartType);
      expect(component.getYAxisLabel()).toBe('%');

      service.selectedChartType.set('error_rate' as ChartType);
      expect(component.getYAxisLabel()).toBe('%');

      service.selectedChartType.set('success_rate' as ChartType);
      expect(component.getYAxisLabel()).toBe('%');
    });

    it('should return "Bytes/sec" for network throughput', () => {
      service.selectedChartType.set('network_throughput' as ChartType);
      expect(component.getYAxisLabel()).toBe('Bytes/sec');
    });

    it('should return "Bytes" for network bytes', () => {
      service.selectedChartType.set('network_bytes_sent' as ChartType);
      expect(component.getYAxisLabel()).toBe('Bytes');

      service.selectedChartType.set('network_bytes_received' as ChartType);
      expect(component.getYAxisLabel()).toBe('Bytes');
    });

    it('should return "requests" for failed_requests', () => {
      service.selectedChartType.set('failed_requests' as ChartType);
      expect(component.getYAxisLabel()).toBe('requests');
    });

    it('should return "Value" for unknown chart types', () => {
      service.selectedChartType.set('latency_min_max' as ChartType);
      expect(component.getYAxisLabel()).toBe('Value');
    });
  });

  describe('getChartId', () => {
    it('should return global chart id for global endpoint', () => {
      service.selectedEndpoint.set('global');
      service.selectedChartType.set('latency' as ChartType);
      expect(component.getChartId()).toBe('global-latency');
    });

    it('should return endpoint chart id with sanitized URL', () => {
      service.selectedEndpoint.set('https://api.example.com/users/123');
      service.selectedChartType.set('peak_throughput' as ChartType);
      expect(component.getChartId()).toBe(
        'endpoint-https___api_example_com_users_123-peak_throughput',
      );
    });
  });

  describe('sanitizeForChartId', () => {
    it('should replace non-alphanumeric characters with underscores', () => {
      expect(component.sanitizeForChartId('https://api.example.com')).toBe(
        'https___api_example_com',
      );
    });

    it('should keep alphanumeric characters', () => {
      expect(component.sanitizeForChartId('test123')).toBe('test123');
    });

    it('should handle special characters', () => {
      expect(component.sanitizeForChartId('api/v1/users?id=123')).toBe(
        'api_v1_users_id_123',
      );
    });
  });

  describe('deleteTest', () => {
    it('should open delete modal when deleteTest is called', () => {
      component.deleteTest();
      expect(component.showDeleteModal()).toBe(true);
    });
  });

  describe('handleDeleteCancel', () => {
    it('should close delete modal when cancel is called', () => {
      component.showDeleteModal.set(true);
      component.handleDeleteCancel();
      expect(component.showDeleteModal()).toBe(false);
    });
  });

  describe('handleDeleteConfirm', () => {
    it('should not call deleteTest if testId is null', async () => {
      service.testId.set(null);
      await component.handleDeleteConfirm();
      expect(deleteTestSpy).not.toHaveBeenCalled();
    });

    it('should set isDeleting to true when delete is confirmed', async () => {
      service.testId.set('test-123');
      component.handleDeleteConfirm();
      expect(component.isDeleting()).toBe(true);
    });

    it('should call deleteTest and navigate to home on success', async () => {
      service.testId.set('test-123');
      await component.handleDeleteConfirm();
      expect(deleteTestSpy).toHaveBeenCalledWith('test-123');
      expect(toHomeSpy).toHaveBeenCalled();
    });

    it('should reset isDeleting and close modal in finally block', async () => {
      service.testId.set('test-123');
      await component.handleDeleteConfirm();
      expect(component.isDeleting()).toBe(false);
      expect(component.showDeleteModal()).toBe(false);
    });
  });

  describe('onEndpointChangeValue', () => {
    it('should update selectedEndpoint when called', () => {
      component.onEndpointChangeValue('https://api.example.com');
      expect(service.selectedEndpoint()).toBe('https://api.example.com');
    });
  });
});
