import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AppRoutes } from '@tressi/shared/ui';
import { describe, expect, it, type Mock, vi } from 'vitest';
import { configGuard, healthCheckGuard, routes } from './app.routes';
import { ConfigService } from './services/config.service';
import { HealthService } from './services/health.service';
import { AppRouterService } from './services/router.service';

describe('app.routes', () => {
  describe('routes array', () => {
    it('should have the correct number of routes', () => {
      expect(routes).toBeDefined();
      expect(routes.length).toBe(13);
    });

    it('should have server unavailable route', () => {
      const serverUnavailableRoute = routes.find((r) => r.path === AppRoutes.SERVER_UNAVAILABLE);
      expect(serverUnavailableRoute).toBeDefined();
      expect(serverUnavailableRoute?.data).toEqual({ title: 'Server Unavailable' });
    });

    it('should have welcome route with both guards', () => {
      const welcomeRoute = routes.find((r) => r.path === AppRoutes.WELCOME);
      expect(welcomeRoute).toBeDefined();
      expect(welcomeRoute?.canActivate).toContain(healthCheckGuard);
      expect(welcomeRoute?.canActivate).toContain(configGuard);
      expect(welcomeRoute?.data).toEqual({ title: 'Welcome' });
    });

    it('should have configs routes with healthCheckGuard', () => {
      const configsRoute = routes.find((r) => r.path === AppRoutes.CONFIGS);
      expect(configsRoute).toBeDefined();
      expect(configsRoute?.canActivate).toContain(healthCheckGuard);
      expect(configsRoute?.resolve).toBeDefined();
      expect(configsRoute?.resolve?.['configs']).toBeDefined();
    });

    it('should have configs create route', () => {
      const configsCreateRoute = routes.find((r) => r.path === AppRoutes.CONFIGS_CREATE);
      expect(configsCreateRoute).toBeDefined();
      expect(configsCreateRoute?.canActivate).toContain(healthCheckGuard);
    });

    it('should have dashboard routes with both guards', () => {
      const dashboardRoute = routes.find((r) => r.path === AppRoutes.DASHBOARD);
      expect(dashboardRoute).toBeDefined();
      expect(dashboardRoute?.canActivate).toContain(healthCheckGuard);
      expect(dashboardRoute?.canActivate).toContain(configGuard);
    });

    it('should have dashboard with id route', () => {
      const dashboardWithIdRoute = routes.find((r) => r.path === AppRoutes.DASHBOARD_WITH_ID);
      expect(dashboardWithIdRoute).toBeDefined();
      expect(dashboardWithIdRoute?.canActivate).toContain(healthCheckGuard);
      expect(dashboardWithIdRoute?.canActivate).toContain(configGuard);
    });

    it('should have showcase route without guards', () => {
      const showcaseRoute = routes.find((r) => r.path === AppRoutes.SHOWCASE);
      expect(showcaseRoute).toBeDefined();
      expect(showcaseRoute?.canActivate).toBeUndefined();
      expect(showcaseRoute?.data).toEqual({ title: 'Showcase' });
    });

    it('should have test details route with healthCheckGuard', () => {
      const testDetailRoute = routes.find((r) => r.path === AppRoutes.TESTS_WITH_ID);
      expect(testDetailRoute).toBeDefined();
      expect(testDetailRoute?.canActivate).toContain(healthCheckGuard);
      expect(testDetailRoute?.resolve?.['data']).toBeDefined();
    });

    it('should have docs routes with healthCheckGuard', () => {
      const docsRoute = routes.find((r) => r.path === AppRoutes.DOCS);
      expect(docsRoute).toBeDefined();
      expect(docsRoute?.canActivate).toContain(healthCheckGuard);
      expect(docsRoute?.resolve?.['availableDocs']).toBeDefined();

      const docsWithFilenameRoute = routes.find((r) => r.path === AppRoutes.DOCS_WITH_FILENAME);
      expect(docsWithFilenameRoute).toBeDefined();
      expect(docsWithFilenameRoute?.canActivate).toContain(healthCheckGuard);

      const docsWithSectionRoute = routes.find((r) => r.path === AppRoutes.DOCS_WITH_SECTION);
      expect(docsWithSectionRoute).toBeDefined();
      expect(docsWithSectionRoute?.canActivate).toContain(healthCheckGuard);
    });

    it('should have home redirect route', () => {
      const homeRoute = routes.find((r) => r.path === AppRoutes.HOME);
      expect(homeRoute).toBeDefined();
      expect(homeRoute?.pathMatch).toBe('full');
      expect(homeRoute?.redirectTo).toBe(`/${AppRoutes.WELCOME}`);
    });

    it('should have wildcard redirect route', () => {
      const wildcardRoute = routes.find((r) => r.path === '**');
      expect(wildcardRoute).toBeDefined();
      expect(wildcardRoute?.redirectTo).toBe(`/${AppRoutes.WELCOME}`);
    });
  });

  describe('healthCheckGuard', () => {
    let mockHealth: { isHealthy: Mock; check: Mock };
    let mockAppRouter: { toServerUnavailable: Mock };

    beforeEach(() => {
      mockHealth = {
        check: vi.fn(),
        isHealthy: vi.fn(),
      };
      mockAppRouter = {
        toServerUnavailable: vi.fn(),
      };

      TestBed.configureTestingModule({
        providers: [
          { provide: HealthService, useValue: mockHealth },
          { provide: AppRouterService, useValue: mockAppRouter },
        ],
      });
    });

    it('should return false and redirect when already known unhealthy', async () => {
      mockHealth.isHealthy.mockReturnValue(false);

      const result = await TestBed.runInInjectionContext(async () => healthCheckGuard());

      expect(result).toBe(false);
      expect(mockAppRouter.toServerUnavailable).toHaveBeenCalled();
    });

    it('should return false and redirect when health check fails', async () => {
      mockHealth.isHealthy.mockReturnValue(true);
      mockHealth.check.mockResolvedValue(false);

      const result = await TestBed.runInInjectionContext(async () => healthCheckGuard());

      expect(result).toBe(false);
      expect(mockAppRouter.toServerUnavailable).toHaveBeenCalled();
    });

    it('should return true when health check passes', async () => {
      mockHealth.isHealthy.mockReturnValue(true);
      mockHealth.check.mockResolvedValue(true);

      const result = await TestBed.runInInjectionContext(async () => healthCheckGuard());

      expect(result).toBe(true);
      expect(mockAppRouter.toServerUnavailable).not.toHaveBeenCalled();
    });
  });

  describe('configGuard', () => {
    let mockConfigService: { getAll: Mock };
    let mockAppRouter: { toDashboard: Mock; toWelcome: Mock };
    let mockRoute: ActivatedRouteSnapshot;
    let mockState: RouterStateSnapshot;

    beforeEach(() => {
      mockConfigService = {
        getAll: vi.fn(),
      };
      mockAppRouter = {
        toDashboard: vi.fn(),
        toWelcome: vi.fn(),
      };
      mockRoute = {} as ActivatedRouteSnapshot;
      mockState = { url: '' } as RouterStateSnapshot;

      TestBed.configureTestingModule({
        providers: [
          { provide: ConfigService, useValue: mockConfigService },
          { provide: AppRouterService, useValue: mockAppRouter },
        ],
      });
    });

    it('should redirect to dashboard when configs exist and on welcome/home route', async () => {
      mockConfigService.getAll.mockResolvedValue([{ id: '1' }]);
      Object.defineProperty(mockRoute, 'routeConfig', {
        value: { path: AppRoutes.WELCOME },
      });

      const result = await TestBed.runInInjectionContext(async () =>
        configGuard(mockRoute, mockState),
      );

      expect(result).toBe(false);
      expect(mockAppRouter.toDashboard).toHaveBeenCalled();
    });

    it('should return true when configs exist and not on welcome/home route', async () => {
      mockConfigService.getAll.mockResolvedValue([{ id: '1' }]);
      Object.defineProperty(mockRoute, 'routeConfig', {
        value: { path: AppRoutes.DASHBOARD },
      });

      const result = await TestBed.runInInjectionContext(async () =>
        configGuard(mockRoute, mockState),
      );

      expect(result).toBe(true);
      expect(mockAppRouter.toDashboard).not.toHaveBeenCalled();
    });

    it('should return true when no configs and on welcome route', async () => {
      mockConfigService.getAll.mockResolvedValue([]);
      Object.defineProperty(mockRoute, 'routeConfig', {
        value: { path: AppRoutes.WELCOME },
      });

      const result = await TestBed.runInInjectionContext(async () =>
        configGuard(mockRoute, mockState),
      );

      expect(result).toBe(true);
      expect(mockAppRouter.toWelcome).not.toHaveBeenCalled();
    });

    it('should return true when no configs and on settings route', async () => {
      mockConfigService.getAll.mockResolvedValue([]);
      Object.defineProperty(mockRoute, 'routeConfig', {
        value: { path: 'settings' },
      });

      const result = await TestBed.runInInjectionContext(async () =>
        configGuard(mockRoute, mockState),
      );

      expect(result).toBe(true);
    });

    it('should redirect to welcome when no configs and not on welcome/settings/home', async () => {
      mockConfigService.getAll.mockResolvedValue([]);
      Object.defineProperty(mockRoute, 'routeConfig', {
        value: { path: AppRoutes.DASHBOARD },
      });

      const result = await TestBed.runInInjectionContext(async () =>
        configGuard(mockRoute, mockState),
      );

      expect(result).toBe(false);
      expect(mockAppRouter.toWelcome).toHaveBeenCalled();
    });

    it('should use urlPath when targetPath is empty', async () => {
      mockConfigService.getAll.mockResolvedValue([{ id: '1' }]);
      Object.defineProperty(mockRoute, 'routeConfig', {
        value: { path: '' },
      });
      mockState.url = `/${AppRoutes.WELCOME}`;

      const result = await TestBed.runInInjectionContext(async () =>
        configGuard(mockRoute, mockState),
      );

      expect(result).toBe(false);
      expect(mockAppRouter.toDashboard).toHaveBeenCalled();
    });

    it('should return true when configService.getAll throws error', async () => {
      mockConfigService.getAll.mockRejectedValue(new Error('Network error'));

      const result = await TestBed.runInInjectionContext(async () =>
        configGuard(mockRoute, mockState),
      );

      expect(result).toBe(true);
    });

    it('should redirect to welcome when configs is not an array', async () => {
      mockConfigService.getAll.mockResolvedValue(null);
      Object.defineProperty(mockRoute, 'routeConfig', {
        value: { path: AppRoutes.DASHBOARD },
      });

      const result = await TestBed.runInInjectionContext(async () =>
        configGuard(mockRoute, mockState),
      );

      expect(result).toBe(false);
      expect(mockAppRouter.toWelcome).toHaveBeenCalled();
    });

    it('should return true when configs is an empty array', async () => {
      mockConfigService.getAll.mockResolvedValue([]);
      Object.defineProperty(mockRoute, 'routeConfig', {
        value: { path: AppRoutes.HOME },
      });

      const result = await TestBed.runInInjectionContext(async () =>
        configGuard(mockRoute, mockState),
      );

      expect(result).toBe(true);
    });
  });
});
