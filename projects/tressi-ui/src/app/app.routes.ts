import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Routes,
} from '@angular/router';

import { configsResolver } from './resolvers/configs.resolver';
import { docsResolver } from './resolvers/docs.resolver';
import { testDetailResolver } from './resolvers/test-detail.resolver';
import { ConfigService } from './services/config.service';
import { HealthService } from './services/health.service';
import { AppRouterService } from './services/router.service';

export const AppRoutes = {
  HOME: '',
  WELCOME: 'welcome',
  CONFIGS: 'configs',
  CONFIGS_CREATE: 'configs/create',
  DASHBOARD: 'dashboard',
  DASHBOARD_WITH_ID: 'dashboard/:configId',
  TESTS_WITH_ID: 'tests/:testId',
  DOCS: 'docs',
  DOCS_WITH_FILENAME: 'docs/:filename',
  DOCS_WITH_SECTION: 'docs/:section/:filename',
  SERVER_UNAVAILABLE: 'server-unavailable',
  SHOWCASE: 'showcase',
} as const;

export type AppRoute = (typeof AppRoutes)[keyof typeof AppRoutes];

// Health check guard using the centralized service
const healthCheckGuard = (): boolean => {
  const health = inject(HealthService);
  const appRouter = inject(AppRouterService);

  // If already known to be unhealthy, navigate to error page
  if (!health.isHealthy()) {
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
    const urlPath = fullUrl.replace(/^\/+|\/+$/g, '');

    // Determine which path to use for logic
    const pathToCheck = targetPath || urlPath;

    if (hasConfigs) {
      // When configs exist, redirect away from welcome to dashboard
      if (pathToCheck === AppRoutes.WELCOME || pathToCheck === AppRoutes.HOME) {
        await appRouter.toDashboard();
        return false;
      } else {
        return true;
      }
    } else {
      // No configs exist, only allow welcome or settings
      if (
        pathToCheck === AppRoutes.WELCOME ||
        pathToCheck === 'settings' ||
        pathToCheck === AppRoutes.HOME
      ) {
        return true;
      } else {
        await appRouter.toWelcome();
        return false;
      }
    }
  } catch {
    // On error, allow navigation to handle the issue
    return true;
  }
};

export const routes: Routes = [
  {
    path: AppRoutes.SERVER_UNAVAILABLE,
    loadComponent: () =>
      import('./pages/server-unavailable/server-unavailable.component').then(
        (m) => m.ServerUnavailableComponent,
      ),
    data: { title: 'Server Unavailable' },
  },
  {
    path: AppRoutes.WELCOME,
    loadComponent: () =>
      import('./pages/welcome/welcome.component').then(
        (m) => m.WelcomeComponent,
      ),
    canActivate: [healthCheckGuard, configGuard],
    data: { title: 'Welcome' },
  },
  {
    path: AppRoutes.CONFIGS,
    loadComponent: () =>
      import('./pages/configs/configs.component').then(
        (m) => m.ConfigurationsComponent,
      ),
    canActivate: [healthCheckGuard],
    resolve: { configs: configsResolver },
    data: { title: 'Configs' },
  },
  {
    path: AppRoutes.CONFIGS_CREATE,
    loadComponent: () =>
      import('./pages/configs/configs.component').then(
        (m) => m.ConfigurationsComponent,
      ),
    canActivate: [healthCheckGuard],
    resolve: { configs: configsResolver },
    data: { title: 'Configs' },
  },
  {
    path: AppRoutes.DASHBOARD,
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
    canActivate: [healthCheckGuard, configGuard],
    resolve: { configs: configsResolver },
    data: { title: 'Dashboard' },
  },
  {
    path: AppRoutes.DASHBOARD_WITH_ID,
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
    canActivate: [healthCheckGuard, configGuard],
    resolve: { configs: configsResolver },
    data: { title: 'Dashboard' },
  },
  {
    path: AppRoutes.SHOWCASE,
    loadComponent: () =>
      import('./pages/showcase/showcase.component').then(
        (m) => m.ShowcaseComponent,
      ),
    data: { title: 'Showcase' },
  },
  {
    path: AppRoutes.TESTS_WITH_ID,
    loadComponent: () =>
      import('./pages/test-detail/test-detail.component').then(
        (m) => m.TestDetailComponent,
      ),
    canActivate: [healthCheckGuard],
    resolve: { data: testDetailResolver },
    data: { title: 'Test Details' },
  },
  {
    path: AppRoutes.DOCS,
    loadComponent: () =>
      import('./pages/docs/docs.component').then((m) => m.DocsComponent),
    canActivate: [healthCheckGuard],
    resolve: { availableDocs: docsResolver },
    data: { title: 'Documentation' },
  },
  {
    path: AppRoutes.DOCS_WITH_FILENAME,
    loadComponent: () =>
      import('./pages/docs/docs.component').then((m) => m.DocsComponent),
    canActivate: [healthCheckGuard],
    resolve: { availableDocs: docsResolver },
    data: { title: 'Documentation' },
  },
  {
    path: AppRoutes.DOCS_WITH_SECTION,
    loadComponent: () =>
      import('./pages/docs/docs.component').then((m) => m.DocsComponent),
    canActivate: [healthCheckGuard],
    resolve: { availableDocs: docsResolver },
    data: { title: 'Documentation' },
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
