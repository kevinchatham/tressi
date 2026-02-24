import { Location } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';
import { filter, map } from 'rxjs';

import { AppRoute, AppRoutes } from '../app.routes';
import { LocalStorageService } from './local-storage.service';

@Injectable({ providedIn: 'root' })
export class AppRouterService {
  private readonly _router = inject(Router);
  private readonly _location = inject(Location);
  private readonly _localStorage = inject(LocalStorageService);

  /** Signal to track if a route transition is in progress (resolving data) */
  readonly isNavigating = signal(false);

  private readonly _navigationTrigger = toSignal(
    this._router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => Date.now()), // Just a trigger
    ),
    { initialValue: 0 },
  );

  constructor() {
    this._listenToNavigation();
  }

  /** Returns the current URL */
  getCurrentUrl = computed(() => {
    this._navigationTrigger();
    return window.location.href;
  });

  // has template references!
  isOnDocs = computed(() => this.getCurrentUrl().endsWith(AppRoutes.DOCS));

  // has template references!
  isOnServerUnavailable = computed(() =>
    this.getCurrentUrl().includes(AppRoutes.SERVER_UNAVAILABLE),
  );

  isOnDocsSubroute = computed(() =>
    this.getCurrentUrl().includes(`/${AppRoutes.DOCS}/`),
  );

  /** Navigates to the dashboard, optionally for a specific configuration */
  toDashboard(configId?: string): void {
    const path = configId
      ? [`/${AppRoutes.DASHBOARD}`, configId]
      : [`/${AppRoutes.DASHBOARD}`];
    this._router.navigate(path);
  }

  /** Navigates to the root/home path */
  toHome(): void {
    this._router.navigate([`/${AppRoutes.HOME}`]);
  }

  /** Navigates to the configurations management page */
  toConfigs(): void {
    this._router.navigate([`/${AppRoutes.CONFIGS}`]);
  }

  /** Navigates to documentation, supporting sections and specific files */
  toDocs(section?: string, filename?: string): void {
    const path = [`/${AppRoutes.DOCS}`];
    if (section) path.push(section);
    if (filename) path.push(filename);
    this._router.navigate(path);
  }

  /** Navigates to the details of a specific test execution */
  toTestDetails(testId: string): void {
    // Extract base path from constant (tests/:testId -> tests)
    const basePath = AppRoutes.TESTS_WITH_ID.split('/')[0];
    this._router.navigate([`/${basePath}`, testId]);
  }

  /** Navigates to the welcome/onboarding page */
  toWelcome(): void {
    this._router.navigate([`/${AppRoutes.WELCOME}`]);
  }

  /** Navigates to the server unavailable error page */
  toServerUnavailable(): void {
    this._router.navigate([`/${AppRoutes.SERVER_UNAVAILABLE}`]);
  }

  /** Navigates to the last known route or defaults to home */
  toLastRoute(): void {
    const lastRoute = this._localStorage.preferences().lastRoute;
    if (lastRoute) {
      window.location.href = lastRoute;
      return;
    }
    this.toHome();
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

  private _listenToNavigation(): void {
    this._router.events
      .pipe(
        filter(
          (
            event,
          ): event is
            | NavigationStart
            | NavigationEnd
            | NavigationCancel
            | NavigationError =>
            event instanceof NavigationStart ||
            event instanceof NavigationEnd ||
            event instanceof NavigationCancel ||
            event instanceof NavigationError,
        ),
      )
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          // docs subroutes have custom loader
          if (!this.isOnDocsSubroute()) {
            this.isNavigating.set(true);
          }
        } else {
          this.isNavigating.set(false);

          if (
            event instanceof NavigationEnd &&
            !event.urlAfterRedirects.includes(AppRoutes.SERVER_UNAVAILABLE)
          ) {
            this._localStorage.saveLastRoute(event.urlAfterRedirects);
          }
        }
      });
  }
}
