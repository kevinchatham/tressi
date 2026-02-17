import { Location } from '@angular/common';
import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

import { AppRoute, AppRoutes } from '../app.routes';

@Injectable({ providedIn: 'root' })
export class AppRouterService {
  private readonly _router = inject(Router);
  private readonly _location = inject(Location);
  private readonly _navigationTrigger = toSignal(
    this._router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => Date.now()), // Just a trigger
    ),
    { initialValue: 0 },
  );

  /** Returns the current URL */
  getCurrentUrl = computed(() => {
    this._navigationTrigger();
    return window.location.href;
  });

  // has template references!
  isOnDocs = computed(() => this.getCurrentUrl().endsWith(AppRoutes.DOCS));

  // has template references!
  isOnServerUnavailable = computed(() =>
    this.getCurrentUrl().endsWith(AppRoutes.SERVER_UNAVAILABLE),
  );

  isOnDocsSubroute = computed(() =>
    this.getCurrentUrl().includes(`/${AppRoutes.DOCS}/`),
  );

  /** Navigates to the dashboard, optionally for a specific configuration */
  toDashboard(configId?: string): Promise<boolean> {
    const path = configId
      ? [`/${AppRoutes.DASHBOARD}`, configId]
      : [`/${AppRoutes.DASHBOARD}`];
    return this._router.navigate(path);
  }

  /** Navigates to the root/home path */
  toHome(): Promise<boolean> {
    return this._router.navigate([`/${AppRoutes.HOME}`]);
  }

  /** Navigates to the configurations management page */
  toConfigs(): Promise<boolean> {
    return this._router.navigate([`/${AppRoutes.CONFIGS}`]);
  }

  /** Navigates to documentation, supporting sections and specific files */
  toDocs(section?: string, filename?: string): Promise<boolean> {
    const path = [`/${AppRoutes.DOCS}`];
    if (section) path.push(section);
    if (filename) path.push(filename);
    return this._router.navigate(path);
  }

  /** Navigates to the details of a specific test execution */
  toTestDetails(testId: string): Promise<boolean> {
    // Extract base path from constant (tests/:testId -> tests)
    const basePath = AppRoutes.TESTS_WITH_ID.split('/')[0];
    return this._router.navigate([`/${basePath}`, testId]);
  }

  /** Navigates to the welcome/onboarding page */
  toWelcome(): Promise<boolean> {
    return this._router.navigate([`/${AppRoutes.WELCOME}`]);
  }

  /** Navigates to the server unavailable error page */
  toServerUnavailable(): Promise<boolean> {
    return this._router.navigate([`/${AppRoutes.SERVER_UNAVAILABLE}`]);
  }

  /** Updates the URL without triggering a full route navigation (Soft Navigation) */
  updateDashboardUrl(configId: string): void {
    this._location.go(`/${AppRoutes.DASHBOARD}/${configId}`);
  }

  updateUrl(route: AppRoute): void {
    if (route.includes(':')) return;
    this._location.go(`/${route}`);
  }

  /** Navigates back in the platform history */
  back(): void {
    this._location.back();
  }
}
