import { Location } from '@angular/common';
import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

import { AppRoutes } from '../app.routes';

@Injectable({ providedIn: 'root' })
export class AppRouterService {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly navigationTrigger = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => Date.now()), // Just a trigger
    ),
    { initialValue: 0 },
  );

  /** Returns the current URL */
  getCurrentUrl = computed(() => {
    this.navigationTrigger();
    return window.location.href;
  });

  // has template references!
  isOnDocs = computed(
    () =>
      this.getCurrentUrl().endsWith(AppRoutes.DOCS) ||
      this.getCurrentUrl().includes(AppRoutes.DOCS),
  );

  isOnDocsSubroute = computed(() =>
    this.getCurrentUrl().includes(`/${AppRoutes.DOCS}/`),
  );

  /** Navigates to the dashboard, optionally for a specific configuration */
  toDashboard(configId?: string): Promise<boolean> {
    const path = configId
      ? [`/${AppRoutes.DASHBOARD}`, configId]
      : [`/${AppRoutes.DASHBOARD}`];
    return this.router.navigate(path);
  }

  /** Navigates to the root/home path */
  toHome(): Promise<boolean> {
    return this.router.navigate([`/${AppRoutes.HOME}`]);
  }

  /** Navigates to the configurations management page */
  toConfigs(): Promise<boolean> {
    return this.router.navigate([`/${AppRoutes.CONFIGS}`]);
  }

  /** Navigates to documentation, supporting sections and specific files */
  toDocs(section?: string, filename?: string): Promise<boolean> {
    const path = [`/${AppRoutes.DOCS}`];
    if (section) path.push(section);
    if (filename) path.push(filename);
    return this.router.navigate(path);
  }

  /** Navigates to the details of a specific test execution */
  toTestDetails(testId: string): Promise<boolean> {
    // Extract base path from constant (tests/:testId -> tests)
    const basePath = AppRoutes.TESTS_WITH_ID.split('/')[0];
    return this.router.navigate([`/${basePath}`, testId]);
  }

  /** Navigates to the welcome/onboarding page */
  toWelcome(): Promise<boolean> {
    return this.router.navigate([`/${AppRoutes.WELCOME}`]);
  }

  /** Navigates to the server unavailable error page */
  toServerUnavailable(): Promise<boolean> {
    return this.router.navigate([`/${AppRoutes.SERVER_UNAVAILABLE}`]);
  }

  /** Updates the URL without triggering a full route navigation (Soft Navigation) */
  updateDashboardUrl(configId: string): void {
    this.location.go(`/${AppRoutes.DASHBOARD}/${configId}`);
  }

  /** Navigates back in the platform history */
  back(): void {
    this.location.back();
  }
}
