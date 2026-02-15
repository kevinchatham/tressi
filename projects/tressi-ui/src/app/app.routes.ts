import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  Routes,
} from '@angular/router';

import { configsResolver } from './resolvers/configs.resolver';
import { docsResolver } from './resolvers/docs.resolver';
import { testDetailResolver } from './resolvers/test-detail.resolver';
import { ConfigService } from './services/config.service';
import { HealthService } from './services/health.service';

// Health check guard using the centralized service
const healthCheckGuard = (): boolean => {
  const health = inject(HealthService);
  const router = inject(Router);

  // If already known to be unhealthy, navigate to error page
  if (!health.isHealthy()) {
    router.navigate(['/server-unavailable']);
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
  const router = inject(Router);

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
      if (pathToCheck === 'welcome' || pathToCheck === '') {
        await router.navigate(['/dashboard']);
        return false;
      } else {
        return true;
      }
    } else {
      // No configs exist, only allow welcome or settings
      if (
        pathToCheck === 'welcome' ||
        pathToCheck === 'settings' ||
        pathToCheck === ''
      ) {
        return true;
      } else {
        await router.navigate(['/welcome']);
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
    path: 'server-unavailable',
    loadComponent: () =>
      import('./pages/server-unavailable/server-unavailable.component').then(
        (m) => m.ServerUnavailableComponent,
      ),
    data: { title: 'Server Unavailable' },
  },
  {
    path: 'welcome',
    loadComponent: () =>
      import('./pages/welcome/welcome.component').then(
        (m) => m.WelcomeComponent,
      ),
    canActivate: [healthCheckGuard, configGuard],
    data: { title: 'Welcome' },
  },
  {
    path: 'configs',
    loadComponent: () =>
      import('./pages/configs/configs.component').then(
        (m) => m.ConfigurationsComponent,
      ),
    canActivate: [healthCheckGuard],
    resolve: { configs: configsResolver },
    data: { title: 'Configs' },
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
    canActivate: [healthCheckGuard, configGuard],
    resolve: { configs: configsResolver },
    data: { title: 'Dashboard' },
  },
  {
    path: 'dashboard/:configId',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
    canActivate: [healthCheckGuard, configGuard],
    resolve: { configs: configsResolver },
    data: { title: 'Dashboard' },
  },
  {
    path: 'showcase',
    loadComponent: () =>
      import('./pages/showcase/showcase.component').then(
        (m) => m.ShowcaseComponent,
      ),
    data: { title: 'Showcase' },
  },
  {
    path: 'tests/:testId',
    loadComponent: () =>
      import('./pages/test-detail/test-detail.component').then(
        (m) => m.TestDetailComponent,
      ),
    canActivate: [healthCheckGuard],
    resolve: { data: testDetailResolver },
    data: { title: 'Test Details' },
  },
  {
    path: 'docs',
    loadComponent: () =>
      import('./pages/docs/docs.component').then((m) => m.DocsComponent),
    canActivate: [healthCheckGuard],
    resolve: { availableDocs: docsResolver },
    data: { title: 'Documentation' },
  },
  {
    path: 'docs/:filename',
    loadComponent: () =>
      import('./pages/docs/docs.component').then((m) => m.DocsComponent),
    canActivate: [healthCheckGuard],
    resolve: { availableDocs: docsResolver },
    data: { title: 'Documentation' },
  },
  {
    path: 'docs/:section/:filename',
    loadComponent: () =>
      import('./pages/docs/docs.component').then((m) => m.DocsComponent),
    canActivate: [healthCheckGuard],
    resolve: { availableDocs: docsResolver },
    data: { title: 'Documentation' },
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: '/welcome',
  },
  {
    path: '**',
    redirectTo: '/welcome',
  },
];
