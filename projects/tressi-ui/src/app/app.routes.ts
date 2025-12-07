import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';

import { ConfigFormComponent } from './components/config-form/config-form.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ServerUnavailableComponent } from './pages/server-unavailable/server-unavailable.component';
import { SettingsComponent } from './pages/settings/settings.component';
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

export const routes: Routes = [
  {
    path: 'server-unavailable',
    component: ServerUnavailableComponent,
  },
  {
    path: '',
    canActivate: [healthCheckGuard],
    children: [
      {
        path: '',
        component: DashboardComponent,
      },
      {
        path: 'settings',
        component: SettingsComponent,
      },
      {
        path: 'config',
        component: ConfigFormComponent,
      },
      {
        path: '**',
        redirectTo: '',
      },
    ],
  },
];
