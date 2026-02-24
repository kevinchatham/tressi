import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ThemeService } from '../../services/theme.service';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-theme-switcher',
  templateUrl: './theme-switcher.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
})
export class ThemeSwitcherComponent {
  readonly themeService = inject(ThemeService);
}
