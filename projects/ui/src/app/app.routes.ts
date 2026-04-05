import { inject } from '@angular/core';
import type { ActivatedRouteSnapshot, RouterStateSnapshot, Routes } from '@angular/router';
import { AppRoutes } from '@tressi/shared/ui';

import { configsResolver } from './resolvers/configs.resolver';
import { docsResolver } from './resolvers/docs.resolver';
import { testDetailResolver } from './resolvers/test-detail.resolver';
import { ConfigService } from './services/config.service';
import { HealthService } from './services/health.service';
import { AppRouterService } from './services/router.service';

// Health check guard using the centralized service
const healthCheckGuard = async (): Promise<boolean> => {
  const health = inject(HealthService);
  const appRouter = inject(AppRouterService);

  // If already known to be unhealthy, navigate to error page
  if (!health.isHealthy()) {
    appRouter.toServerUnavailable();
    return false;
  }

  // Otherwise probe the server once to ensure it is online
  const isHealthy = await health.check();

  if (!isHealthy) {
    appRouter.toServerUnavailable();
    return false;
  }

  // Otherwise allow navigation (health checks happen in background)
  return true;
};

// Configuration guard for welcome and settings routes
const configGuard = async (
  route?: ActivatedRouteSnapshot,
  state?: RouterStateSnapshot,
): Promise<boolean> => {
  const configService = inject(ConfigService);
  const appRouter = inject(AppRouterService);

  try {
    const configs = await configService.getAll();
    const hasConfigs = Array.isArray(configs) && configs.length > 0;

    // Get the target path from the route or state
    const targetPath = route?.routeConfig?.path || '';
    const fullUrl = state?.url || '';
    const urlPath = fullUrl.replaceAll(/(^\/+)|(\/+$)/g, '');

    // Determine which path to use for logic
    const pathToCheck = targetPath || urlPath;

    if (hasConfigs) {
      // When configs exist, redirect away from welcome to dashboard
      if (pathToCheck === AppRoutes.WELCOME || pathToCheck === AppRoutes.HOME) {
        appRouter.toDashboard();
        return false;
      } else {
        return true;
      }
    } else {
      if (
        pathToCheck === AppRoutes.WELCOME ||
        pathToCheck === 'settings' ||
        pathToCheck === AppRoutes.HOME
      ) {
        return true;
      }
      appRouter.toWelcome();
      return false;
    }
  } catch {
    // On error, allow navigation to handle the issue
    return true;
  }
};

export const routes: Routes = [
  {
    data: { title: 'Server Unavailable' },
    loadComponent: () =>
      import('./pages/server-unavailable/server-unavailable.component').then(
        (m) => m.ServerUnavailableComponent,
      ),
    path: AppRoutes.SERVER_UNAVAILABLE,
  },
  {
    canActivate: [healthCheckGuard, configGuard],
    data: { title: 'Welcome' },
    loadComponent: () =>
      import('./pages/welcome/welcome.component').then((m) => m.WelcomeComponent),
    path: AppRoutes.WELCOME,
  },
  {
    canActivate: [healthCheckGuard],
    data: { title: 'Configs' },
    loadComponent: () =>
      import('./pages/configs/configs.component').then((m) => m.ConfigsComponent),
    path: AppRoutes.CONFIGS,
    resolve: { configs: configsResolver },
  },
  {
    canActivate: [healthCheckGuard],
    data: { title: 'Configs' },
    loadComponent: () =>
      import('./pages/configs/configs.component').then((m) => m.ConfigsComponent),
    path: AppRoutes.CONFIGS_CREATE,
    resolve: { configs: configsResolver },
  },
  {
    canActivate: [healthCheckGuard, configGuard],
    data: { title: 'Dashboard' },
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    path: AppRoutes.DASHBOARD,
    resolve: { configs: configsResolver },
  },
  {
    canActivate: [healthCheckGuard, configGuard],
    data: { title: 'Dashboard' },
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    path: AppRoutes.DASHBOARD_WITH_ID,
    resolve: { configs: configsResolver },
  },
  {
    data: { title: 'Showcase' },
    loadComponent: () =>
      import('./pages/showcase/showcase.component').then((m) => m.ShowcaseComponent),
    path: AppRoutes.SHOWCASE,
  },
  {
    canActivate: [healthCheckGuard],
    data: { title: 'Test Details' },
    loadComponent: () =>
      import('./pages/test-detail/test-detail.component').then((m) => m.TestDetailComponent),
    path: AppRoutes.TESTS_WITH_ID,
    resolve: { data: testDetailResolver },
  },
  {
    canActivate: [healthCheckGuard],
    data: { title: 'Documentation' },
    loadComponent: () => import('./pages/docs/docs.component').then((m) => m.DocsComponent),
    path: AppRoutes.DOCS,
    resolve: { availableDocs: docsResolver },
  },
  {
    canActivate: [healthCheckGuard],
    data: { title: 'Documentation' },
    loadComponent: () => import('./pages/docs/docs.component').then((m) => m.DocsComponent),
    path: AppRoutes.DOCS_WITH_FILENAME,
    resolve: { availableDocs: docsResolver },
  },
  {
    canActivate: [healthCheckGuard],
    data: { title: 'Documentation' },
    loadComponent: () => import('./pages/docs/docs.component').then((m) => m.DocsComponent),
    path: AppRoutes.DOCS_WITH_SECTION,
    resolve: { availableDocs: docsResolver },
  },
  {
    path: AppRoutes.HOME,
    pathMatch: 'full',
    redirectTo: `/${AppRoutes.WELCOME}`,
  },
  {
    path: '**',
    redirectTo: `/${AppRoutes.WELCOME}`,
  },
];
