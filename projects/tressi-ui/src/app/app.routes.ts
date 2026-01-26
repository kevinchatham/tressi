import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  Routes,
} from '@angular/router';

import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ServerUnavailableComponent } from './pages/server-unavailable/server-unavailable.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { ShowcaseComponent } from './pages/showcase/showcase.component';
import { TestDetailComponent } from './pages/test-detail/test-detail.component';
import { WelcomeComponent } from './pages/welcome/welcome.component';
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
    component: ServerUnavailableComponent,
    data: { title: 'Tressi - Server Unavailable' },
  },
  {
    path: 'welcome',
    component: WelcomeComponent,
    canActivate: [healthCheckGuard, configGuard],
    data: { title: 'Tressi - Welcome' },
  },
  {
    path: 'settings',
    component: SettingsComponent,
    canActivate: [healthCheckGuard, configGuard],
    data: { title: 'Tressi - Settings' },
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [healthCheckGuard, configGuard],
    data: { title: 'Tressi - Dashboard' },
  },
  {
    path: 'showcase',
    component: ShowcaseComponent,
    data: { title: 'Tressi - Showcase' },
  },
  {
    path: 'tests/:testId',
    component: TestDetailComponent,
    canActivate: [healthCheckGuard],
    data: { title: 'Tressi - Test Details' },
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
