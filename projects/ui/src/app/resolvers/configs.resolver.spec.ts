import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import type { ConfigDocument } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigService } from '../services/config.service';
import { configsResolver } from './configs.resolver';

describe('configsResolver', () => {
  let configServiceSpy: {
    getAll: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    configServiceSpy = {
      getAll: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: ConfigService, useValue: configServiceSpy }],
    });
  });

  it('should resolve configs from ConfigService', async () => {
    const mockRoute = {} as ActivatedRouteSnapshot;
    const mockState = {} as RouterStateSnapshot;

    const mockConfigs: ConfigDocument[] = [
      { config: {}, id: '1', name: 'Test Config' } as ConfigDocument,
    ];

    configServiceSpy.getAll.mockResolvedValue(mockConfigs);

    const resolved = (await TestBed.runInInjectionContext(() =>
      configsResolver(mockRoute, mockState),
    )) as ConfigDocument[];

    expect(resolved).toEqual(mockConfigs);
    expect(configServiceSpy.getAll).toHaveBeenCalledTimes(1);
  });
});
