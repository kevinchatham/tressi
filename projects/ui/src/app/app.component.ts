import { ChangeDetectionStrategy, Component, inject, type OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { LoadingComponent } from './components/loading/loading.component';
import { PwaInstallerComponent } from './components/pwa-installer/pwa-installer.component';
import { ToastComponent } from './components/toast/toast.component';
import { PwaService } from './services/pwa.service';
import { AppRouterService } from './services/router.service';
import { ThemeService } from './services/theme.service';
import { TitleService } from './services/title.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, LoadingComponent, ToastComponent, PwaInstallerComponent],
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private readonly _titleService = inject(TitleService);
  private readonly _themeService = inject(ThemeService);

  readonly appRouter = inject(AppRouterService);
  readonly pwaService = inject(PwaService);

  ngOnInit(): void {
    this._titleService.resetTitle();
    this._themeService.loadInitialTheme();
  }
}
