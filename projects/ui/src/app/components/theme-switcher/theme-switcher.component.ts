import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ThemeService } from '../../services/theme.service';
import { ButtonComponent } from '../button/button.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  selector: 'app-theme-switcher',
  templateUrl: './theme-switcher.component.html',
})
export class ThemeSwitcherComponent {
  readonly themeService = inject(ThemeService);
}
