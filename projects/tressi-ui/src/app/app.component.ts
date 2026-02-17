import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';

import { LoadingComponent } from './components/loading/loading.component';
import { ToastComponent } from './components/toast/toast.component';
import { AppRouterService } from './services/router.service';
import { ThemeService } from './services/theme.service';
import { TitleService } from './services/title.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoadingComponent, ToastComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  private readonly _titleService = inject(TitleService);
  private readonly _themeService = inject(ThemeService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  /** Signal to track if a route transition is in progress (resolving data) */
  readonly isNavigating = signal(false);
  readonly appRouter = inject(AppRouterService);

  ngOnInit(): void {
    this._titleService.resetTitle();
    this._themeService.loadInitialTheme();
    this._setupNavigationListeners();
  }

  /**
   * Listens to router events to show/hide the global loading indicator
   * during route transitions (when resolvers are running).
   */
  private _setupNavigationListeners(): void {
    this._router.events
      .pipe(
        takeUntilDestroyed(this._destroyRef),
        filter(
          (event) =>
            event instanceof NavigationStart ||
            event instanceof NavigationEnd ||
            event instanceof NavigationCancel ||
            event instanceof NavigationError,
        ),
      )
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          // docs subroutes have custom loader
          if (!this.appRouter.isOnDocsSubroute()) {
            this.isNavigating.set(true);
          }
        } else {
          this.isNavigating.set(false);
        }
      });
  }
}
