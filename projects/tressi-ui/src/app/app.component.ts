import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';

import { LoadingComponent } from './components/loading/loading.component';
import { ToastComponent } from './components/toast/toast.component';
import { ThemeService } from './services/theme.service';
import { TitleService } from './services/title.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoadingComponent, ToastComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  private titleService = inject(TitleService);
  private themeService = inject(ThemeService);
  private router = inject(Router);

  /** Signal to track if a route transition is in progress (resolving data) */
  readonly isNavigating = signal(false);

  ngOnInit(): void {
    this.titleService.resetTitle();
    this.themeService.loadInitialTheme();
    this.setupNavigationListeners();
  }

  /**
   * Listens to router events to show/hide the global loading indicator
   * during route transitions (when resolvers are running).
   */
  private setupNavigationListeners(): void {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.isNavigating.set(true);
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.isNavigating.set(false);
      }
    });
  }
}
