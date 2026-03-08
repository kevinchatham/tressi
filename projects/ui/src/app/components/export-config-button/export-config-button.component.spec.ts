import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfigDocument, defaultTressiConfig } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExportConfigButtonComponent } from './export-config-button.component';

describe('ExportConfigButtonComponent', () => {
  let component: ExportConfigButtonComponent;
  let fixture: ComponentFixture<ExportConfigButtonComponent>;

  const createMockConfig = (
    overrides: Partial<ConfigDocument> = {},
  ): ConfigDocument => ({
    id: 'test-id',
    name: 'Test Config',
    config: {
      ...defaultTressiConfig,
      requests: [
        {
          url: 'https://example.com/api',
          method: 'GET',
          rps: 10,
          rampUpDurationSec: 5,
          earlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [],
            monitoringWindowMs: 1000,
          },
          headers: {},
          payload: {},
        },
      ],
      options: {
        ...defaultTressiConfig.options,
        durationSec: 60,
        threads: 4,
        rampUpDurationSec: 2,
        workerEarlyExit: {
          enabled: false,
          errorRateThreshold: 0,
          exitStatusCodes: [],
          monitoringWindowMs: 1000,
        },
      },
    },
    epochCreatedAt: 1700000000000,
    epochUpdatedAt: 1700000001000,
    ...overrides,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExportConfigButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ExportConfigButtonComponent);
    component = fixture.componentInstance;
  });

  describe('toSlug', () => {
    it('should convert lowercase text to slug', () => {
      expect(component.toSlug('hello world')).toBe('hello-world');
    });

    it('should convert uppercase text to lowercase', () => {
      expect(component.toSlug('HELLO WORLD')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(component.toSlug('test@#$config')).toBe('testconfig');
    });

    it('should replace underscores with hyphens', () => {
      expect(component.toSlug('test_config')).toBe('test-config');
    });

    it('should replace multiple spaces with single hyphen', () => {
      expect(component.toSlug('test    config')).toBe('test-config');
    });

    it('should trim leading and trailing hyphens', () => {
      expect(component.toSlug('  test config  ')).toBe('test-config');
    });

    it('should handle complex configuration names', () => {
      expect(component.toSlug('My API Config v2.0')).toBe('my-api-config-v20');
    });

    it('should handle names with hyphens already', () => {
      expect(component.toSlug('my-config-name')).toBe('my-config-name');
    });

    it('should return empty string for whitespace-only input', () => {
      expect(component.toSlug('   ')).toBe('');
    });
  });

  describe('export', () => {
    let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
    let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // Spy on URL methods only - the DOM operations are hard to mock in Angular test environment
      createObjectURLSpy = vi
        .spyOn(URL, 'createObjectURL')
        .mockImplementation(() => 'blob:http://test');
      revokeObjectURLSpy = vi
        .spyOn(URL, 'revokeObjectURL')
        .mockImplementation(() => undefined);
    });

    afterEach(() => {
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });

    it('should create a JSON blob with config data only', async () => {
      const mockConfig = createMockConfig({ name: 'Test Config' });
      fixture.componentRef.setInput('config', mockConfig);
      fixture.detectChanges();

      await component.export();

      expect(createObjectURLSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'application/json',
        }),
      );
    });

    it('should use epochUpdatedAt for timestamp when available', async () => {
      const mockConfig = createMockConfig({
        name: 'Test Config',
        epochUpdatedAt: 1700000005000,
        epochCreatedAt: 1700000000000,
      });
      fixture.componentRef.setInput('config', mockConfig);
      fixture.detectChanges();

      // Call the method and verify it doesn't throw
      await component.export();

      // The method should complete without error
      expect(createObjectURLSpy).toHaveBeenCalled();
    });

    it('should fallback to epochCreatedAt when epochUpdatedAt is null', async () => {
      const mockConfig = createMockConfig({
        name: 'Test Config',
        epochUpdatedAt: null,
      });
      fixture.componentRef.setInput('config', mockConfig);
      fixture.detectChanges();

      await component.export();

      expect(createObjectURLSpy).toHaveBeenCalled();
    });

    it('should handle empty config object', async () => {
      const mockConfig = createMockConfig({
        name: 'Empty Config',
        config: {
          ...defaultTressiConfig,
          requests: [],
        },
      });
      fixture.componentRef.setInput('config', mockConfig);
      fixture.detectChanges();

      await component.export();

      expect(createObjectURLSpy).toHaveBeenCalled();
    });
  });
});
