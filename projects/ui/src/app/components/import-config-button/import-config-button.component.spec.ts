import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NameService } from '../../services/name.service';
import { ImportConfigButtonComponent } from './import-config-button.component';

describe('ImportConfigButtonComponent', () => {
  let component: ImportConfigButtonComponent;
  let fixture: ComponentFixture<ImportConfigButtonComponent>;

  beforeEach(async () => {
    const nameServiceMock = {
      generate: vi.fn().mockReturnValue('Generated Name'),
    };

    await TestBed.configureTestingModule({
      imports: [ImportConfigButtonComponent],
      providers: [{ provide: NameService, useValue: nameServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportConfigButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should trigger file input click', () => {
    const mockInput = { click: vi.fn() } as unknown as HTMLInputElement;
    component.triggerFileInput(mockInput);
    expect(mockInput.click).toHaveBeenCalled();
  });

  it('should trigger file input when button is clicked', () => {
    const fileInput = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');

    const button = fixture.nativeElement.querySelector('app-button');
    button.click();

    expect(clickSpy).toHaveBeenCalled();
  });

  describe('onFileSelected', () => {
    it('should do nothing if no file is selected', async () => {
      const mockInput = {
        files: null,
        value: 'some-value',
      } as unknown as HTMLInputElement;
      const event = { target: mockInput } as unknown as Event;

      await component.onFileSelected(event);

      // Should not reset value if no file
      expect(mockInput.value).toBe('some-value');
    });

    it('should emit importError if JSON is invalid', async () => {
      const mockFile = new File(['invalid json'], 'test.json', {
        type: 'application/json',
      });

      const mockInput = {
        files: [mockFile],
        value: 'test.json',
      } as unknown as HTMLInputElement;

      const event = { target: mockInput } as unknown as Event;

      const errorSpy = vi.fn();
      component.importError.subscribe(errorSpy);

      await component.onFileSelected(event);

      expect(errorSpy).toHaveBeenCalledWith('Invalid JSON file format');
      expect(mockInput.value).toBe('');
    });

    it('should emit importError if validation fails', async () => {
      const mockFile = new File(['{"valid": "json"}'], 'test.json', {
        type: 'application/json',
      });

      const mockInput = {
        files: [mockFile],
        value: 'test.json',
      } as unknown as HTMLInputElement;

      const event = { target: mockInput } as unknown as Event;

      const errorSpy = vi.fn();
      component.importError.subscribe(errorSpy);

      await component.onFileSelected(event);

      expect(errorSpy).toHaveBeenCalledWith('Invalid configuration file');
      expect(mockInput.value).toBe('');
    });

    it('should emit configImported if validation succeeds', async () => {
      const mockConfig = {
        $schema: 'http://example.com/schema.json',
        options: {
          durationSec: 10,
          headers: {},
          rampUpDurationSec: 0,
          threads: 1,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 1,
            exitStatusCodes: [],
            monitoringWindowSeconds: 1,
          },
          workerMemoryLimit: 128,
        },
        requests: [
          {
            earlyExit: {
              enabled: false,
              errorRateThreshold: 1,
              exitStatusCodes: [],
              monitoringWindowSeconds: 1,
            },
            headers: {},
            method: 'GET',
            payload: {},
            rampUpDurationSec: 0,
            rps: 10,
            url: 'http://localhost:3000',
          },
        ],
      };
      const mockFile = {
        name: 'tressi-my-config.json',
        text: vi.fn().mockResolvedValue(JSON.stringify(mockConfig)),
      } as unknown as File;

      const mockInput = {
        files: [mockFile],
        value: 'tressi-my-config.json',
      } as unknown as HTMLInputElement;

      const event = { target: mockInput } as unknown as Event;

      const importedSpy = vi.fn();
      component.configImported.subscribe(importedSpy);

      await component.onFileSelected(event);

      expect(importedSpy).toHaveBeenCalledWith({
        config: mockConfig,
        name: 'My Config',
      });
      expect(mockInput.value).toBe('');
    });

    it('should use NameService if cleaned name is empty', async () => {
      const mockConfig = {
        $schema: 'http://example.com/schema.json',
        options: {
          durationSec: 10,
          headers: {},
          rampUpDurationSec: 0,
          threads: 1,
          workerEarlyExit: {
            enabled: false,
            errorRateThreshold: 1,
            exitStatusCodes: [],
            monitoringWindowSeconds: 1,
          },
          workerMemoryLimit: 128,
        },
        requests: [
          {
            earlyExit: {
              enabled: false,
              errorRateThreshold: 1,
              exitStatusCodes: [],
              monitoringWindowSeconds: 1,
            },
            headers: {},
            method: 'GET',
            payload: {},
            rampUpDurationSec: 0,
            rps: 10,
            url: 'http://localhost:3000',
          },
        ],
      };
      const mockFile = {
        name: 'tressi-.json',
        text: vi.fn().mockResolvedValue(JSON.stringify(mockConfig)),
      } as unknown as File;

      const mockInput = {
        files: [mockFile],
        value: 'tressi-.json',
      } as unknown as HTMLInputElement;

      const event = { target: mockInput } as unknown as Event;

      const importedSpy = vi.fn();
      component.configImported.subscribe(importedSpy);

      await component.onFileSelected(event);

      expect(importedSpy).toHaveBeenCalledWith({
        config: mockConfig,
        name: 'Generated Name',
      });
      expect(mockInput.value).toBe('');
    });

    it('should handle generic read errors', async () => {
      const mockFile = {
        name: 'test.json',
        text: vi.fn().mockRejectedValue(new Error('Read failed')),
      } as unknown as File;

      const mockInput = {
        files: [mockFile],
        value: 'test.json',
      } as unknown as HTMLInputElement;

      const event = { target: mockInput } as unknown as Event;

      const errorSpy = vi.fn();
      component.importError.subscribe(errorSpy);

      await component.onFileSelected(event);

      expect(errorSpy).toHaveBeenCalledWith('Failed to read configuration file');
      expect(mockInput.value).toBe('');
    });
  });

  describe('_generateNameFromFile', () => {
    it('should clean up filenames correctly', () => {
      const testCases = [
        { expected: 'My Config', input: 'my-config.json' },
        { expected: 'Test', input: 'tressi-test-123.json' },
        { expected: 'Prod', input: 'config_prod_abc12345.json' },
        { expected: 'Simple', input: 'simple.json' },
        { expected: 'Multiple Dashes', input: 'multiple---dashes.json' },
        { expected: 'UPPERCASE', input: 'UPPERCASE.json' },
        { expected: 'Mixed CASE Name', input: 'mixed-CASE-name.json' },
        { expected: 'Config Both', input: 'tressi-config-both.json' },
      ];

      testCases.forEach(({ input, expected }) => {
        // Accessing private method for testing
        const result = (
          component as unknown as {
            _generateNameFromFile: (s: string) => string;
          }
        )._generateNameFromFile(input);
        expect(result).toBe(expected);
      });
    });
  });
});
