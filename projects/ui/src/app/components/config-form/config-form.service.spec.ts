import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NameService } from '../../services/name.service';
import { ConfigFormService } from './config-form.service';

describe('ConfigFormService', () => {
  let service: ConfigFormService;
  let mockNameService: { generate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockNameService = { generate: vi.fn().mockReturnValue('Test Config Name') };

    TestBed.configureTestingModule({
      providers: [{ provide: NameService, useValue: mockNameService }, ConfigFormService],
    });

    service = TestBed.inject(ConfigFormService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have a model with a generated name', () => {
      expect(service.model().name).toBe('Test Config Name');
    });

    it('should have at least one request in the model', () => {
      expect(service.model().config.requests).toBeDefined();
      expect(service.model().config.requests.length).toBeGreaterThan(0);
    });

    it('should have general as the active tab', () => {
      expect(service.activeTab()).toBe('general');
    });
  });

  describe('loadConfig', () => {
    it('should load a given config', () => {
      const config = {
        config: {
          $schema: 'https://example.com/schema',
          options: {
            durationSec: 60,
            headers: {},
            rampUpDurationSec: 10,
            threads: 4,
            workerEarlyExit: {
              enabled: false,
              errorRateThreshold: 1,
              exitStatusCodes: [500],
              monitoringWindowMs: 1000,
            },
            workerMemoryLimit: 256,
          },
          requests: [
            {
              earlyExit: {
                enabled: true,
                errorRateThreshold: 5,
                exitStatusCodes: [502, 503],
                monitoringWindowMs: 2000,
              },
              headers: { 'Content-Type': 'application/json' },
              method: 'POST' as const,
              payload: { key: 'value' },
              rampUpDurationSec: 5,
              rps: 10,
              url: 'https://api.example.com/endpoint',
            },
          ],
        },
        name: 'Loaded Config',
      };

      service.loadConfig(config);

      expect(service.model().name).toBe('Loaded Config');
      expect(service.model().config.options.durationSec).toBe(60);
      expect(service.model().config.requests.length).toBe(1);
      expect(service.model().config.requests[0].url).toBe('https://api.example.com/endpoint');
    });

    it('should create empty config when passed null', () => {
      service.loadConfig(null);

      expect(service.model().name).toBe('Test Config Name');
    });
  });

  describe('reset', () => {
    it('should reset model to new empty config', () => {
      service.model.update((m) => ({
        ...m,
        config: {
          ...m.config,
          requests: [
            ...m.config.requests,
            {
              earlyExit: {
                enabled: false,
                errorRateThreshold: 1,
                exitStatusCodes: [500],
                monitoringWindowMs: 1000,
              },
              headers: {},
              method: 'GET' as const,
              payload: {},
              rampUpDurationSec: 0,
              rps: 1,
              url: 'https://another.com',
            },
          ],
        },
        name: 'Modified Name',
      }));

      service.reset();

      expect(service.model().name).toBe('Test Config Name');
      expect(service.model().config.requests.length).toBe(1);
    });

    it('should reset active tab to general', () => {
      service.activeTab.set('requests');

      service.reset();

      expect(service.activeTab()).toBe('general');
    });
  });

  describe('submit', () => {
    it('should return the current model', () => {
      const submitted = service.submit();

      expect(submitted).toBe(service.model());
    });
  });

  describe('setActiveTab', () => {
    it('should set the active tab', () => {
      service.setActiveTab('requests');

      expect(service.activeTab()).toBe('requests');

      service.setActiveTab('general');

      expect(service.activeTab()).toBe('general');
    });
  });

  describe('addRequest', () => {
    it('should add a new request to the model', () => {
      const initialCount = service.model().config.requests.length;

      service.addRequest();

      expect(service.model().config.requests.length).toBe(initialCount + 1);
    });
  });

  describe('removeRequest', () => {
    it('should remove a request at the given index', () => {
      service.addRequest();
      service.addRequest();
      const countAfterAdds = service.model().config.requests.length;

      service.removeRequest(0);

      expect(service.model().config.requests.length).toBe(countAfterAdds - 1);
    });
  });

  describe('addGlobalExitStatusCode', () => {
    it('should add a status code to global early exit', () => {
      const initialCodes =
        service.model().config.options.workerEarlyExit?.exitStatusCodes?.length ?? 0;

      service.addGlobalExitStatusCode();

      const codes = service.model().config.options.workerEarlyExit?.exitStatusCodes;
      expect(codes?.length).toBe(initialCodes + 1);
      expect(codes?.includes(500)).toBe(true);
    });
  });

  describe('removeGlobalExitStatusCode', () => {
    it('should remove a status code at the given index', () => {
      service.addGlobalExitStatusCode();
      service.addGlobalExitStatusCode();
      const codesAfterAdd =
        service.model().config.options.workerEarlyExit?.exitStatusCodes?.length ?? 0;

      service.removeGlobalExitStatusCode(0);

      const codes = service.model().config.options.workerEarlyExit?.exitStatusCodes;
      expect(codes?.length).toBe(codesAfterAdd - 1);
    });
  });

  describe('addRequestExitStatusCode', () => {
    it('should add a status code to a specific request early exit', () => {
      const requestIndex = 0;
      const initialCodes =
        service.model().config.requests[requestIndex]?.earlyExit?.exitStatusCodes?.length ?? 0;

      service.addRequestExitStatusCode(requestIndex);

      const codes = service.model().config.requests[requestIndex]?.earlyExit?.exitStatusCodes;
      expect(codes?.length).toBe(initialCodes + 1);
    });
  });

  describe('removeRequestExitStatusCode', () => {
    it('should remove a status code at given indices', () => {
      const requestIndex = 0;
      service.addRequestExitStatusCode(requestIndex);
      service.addRequestExitStatusCode(requestIndex);
      const codesAfterAdd =
        service.model().config.requests[requestIndex]?.earlyExit?.exitStatusCodes?.length ?? 0;

      service.removeRequestExitStatusCode(requestIndex, 0);

      const codes = service.model().config.requests[requestIndex]?.earlyExit?.exitStatusCodes;
      expect(codes?.length).toBe(codesAfterAdd - 1);
    });
  });

  describe('onJsonTextAreaChange', () => {
    it('should trigger model update without changing values', () => {
      const originalModel = service.model();

      service.onJsonTextAreaChange();

      expect(service.model()).not.toBe(originalModel);
      expect(service.model().name).toBe(originalModel.name);
    });
  });
});
