import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { AppRoutes } from '@tressi/shared/ui';
import { Subject } from 'rxjs';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';

import { LocalStorageService } from './local-storage.service';
import { AppRouterService } from './router.service';

describe('AppRouterService', () => {
  let service: AppRouterService;
  let mockRouter: {
    navigate: Mock;
    events: Subject<unknown>;
    routerState: unknown;
  };
  let mockLocation: { back: Mock; go: Mock };
  let mockLocalStorage: { preferences: Mock; saveLastRoute: Mock };

  beforeEach(() => {
    mockRouter = {
      navigate: vi.fn(),
      events: new Subject<unknown>(),
      routerState: { root: {} },
    };
    mockLocation = {
      back: vi.fn(),
      go: vi.fn(),
    };
    mockLocalStorage = {
      preferences: vi.fn().mockReturnValue({ lastRoute: null }),
      saveLastRoute: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AppRouterService,
        { provide: Router, useValue: mockRouter },
        { provide: Location, useValue: mockLocation },
        { provide: LocalStorageService, useValue: mockLocalStorage },
      ],
    });

    service = TestBed.inject(AppRouterService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Navigation Methods', () => {
    it('should navigate to dashboard', () => {
      service.toDashboard();
      expect(mockRouter.navigate).toHaveBeenCalledWith([
        `/${AppRoutes.DASHBOARD}`,
      ]);
    });

    it('should navigate to dashboard with configId', () => {
      service.toDashboard('123');
      expect(mockRouter.navigate).toHaveBeenCalledWith([
        `/${AppRoutes.DASHBOARD}`,
        '123',
      ]);
    });

    it('should navigate to home', () => {
      service.toHome();
      expect(mockRouter.navigate).toHaveBeenCalledWith([`/${AppRoutes.HOME}`]);
    });

    it('should navigate to configs', () => {
      service.toConfigs();
      expect(mockRouter.navigate).toHaveBeenCalledWith([
        `/${AppRoutes.CONFIGS}`,
      ]);
    });

    it('should navigate to docs', () => {
      service.toDocs('section', 'file.md');
      expect(mockRouter.navigate).toHaveBeenCalledWith([
        `/${AppRoutes.DOCS}`,
        'section',
        'file.md',
      ]);
    });

    it('should navigate to test details', () => {
      service.toTestDetails('test-456');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/tests', 'test-456']);
    });

    it('should navigate back', () => {
      service.back();
      expect(mockLocation.back).toHaveBeenCalled();
    });
  });

  describe('URL Updates (Soft Navigation)', () => {
    it('should update dashboard URL without full navigation', () => {
      service.updateDashboardUrl('789');
      expect(mockLocation.go).toHaveBeenCalledWith(
        `/${AppRoutes.DASHBOARD}/789`,
      );
    });

    it('should update generic URL', () => {
      service.updateUrl(AppRoutes.HOME);
      expect(mockLocation.go).toHaveBeenCalledWith(`/${AppRoutes.HOME}`);
    });
  });

  describe('Navigation State', () => {
    it('should track isNavigating state', () => {
      expect(service.isNavigating()).toBe(false);

      // Simulate start
      const startEvent = new NavigationStart(1, '/test');
      mockRouter.events.next(startEvent);
      expect(service.isNavigating()).toBe(true);

      // Simulate end
      const endEvent = new NavigationEnd(1, '/test', '/test');
      mockRouter.events.next(endEvent);
      expect(service.isNavigating()).toBe(false);
    });

    it('should save last route on successful navigation', () => {
      const endEvent = new NavigationEnd(1, '/new-route', '/new-route');
      mockRouter.events.next(endEvent);

      expect(mockLocalStorage.saveLastRoute).toHaveBeenCalledWith('/new-route');
    });
  });

  describe('toLastRoute', () => {
    it('should navigate to home if no lastRoute available', () => {
      service.toLastRoute();
      expect(mockRouter.navigate).toHaveBeenCalledWith([`/${AppRoutes.HOME}`]);
    });
  });
});
