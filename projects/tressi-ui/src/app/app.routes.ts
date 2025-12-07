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
const configGuard = (
  route?: ActivatedRouteSnapshot,
  state?: RouterStateSnapshot,
): Promise<boolean> => {
  const configService = inject(ConfigService);
  const router = inject(Router);

  return new Promise((resolve) => {
    configService.getAllConfigMetadata().subscribe({
      next: (configs) => {
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
            router.navigate(['/dashboard']);
            resolve(false);
          } else {
            resolve(true);
          }
        } else {
          // No configs exist, only allow welcome or settings
          if (
            pathToCheck === 'welcome' ||
            pathToCheck === 'settings' ||
            pathToCheck === ''
          ) {
            resolve(true);
          } else {
            router.navigate(['/welcome']);
            resolve(false);
          }
        }
      },
      error: () => {
        // On error, allow navigation to handle the issue
        resolve(true);
      },
    });
  });
};

export const routes: Routes = [
  {
    path: 'server-unavailable',
    component: ServerUnavailableComponent,
  },
  {
    path: 'welcome',
    component: WelcomeComponent,
    canActivate: [configGuard],
  },
  {
    path: 'settings',
    component: SettingsComponent,
    canActivate: [configGuard],
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [healthCheckGuard, configGuard],
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
