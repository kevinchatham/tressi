import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { LoadingComponent } from './components/loading/loading.component';
import { LoadingService } from './services/loading.service';
import { ThemeService } from './services/theme.service';
import { TitleService } from './services/title.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoadingComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  private titleService = inject(TitleService);
  private themeService = inject(ThemeService);
  protected loadingService = inject(LoadingService);

  ngOnInit(): void {
    this.titleService.resetTitle();
    this.themeService.loadInitialTheme();
  }
}
