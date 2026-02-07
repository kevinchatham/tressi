import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';

import { AllThemes, Theme, ThemeService } from '../../services/theme.service';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-theme-switcher',
  imports: [CommonModule, ButtonComponent],
  templateUrl: './theme-switcher.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeSwitcherComponent implements OnInit {
  readonly themeService = inject(ThemeService);
  readonly themes = AllThemes;
  currentTheme: Theme = 'light';

  ngOnInit(): void {
    this.currentTheme = this.themeService.getTheme();
  }

  /**
   * Handles theme selection changes from the UI dropdown.
   *
   * @param theme - The selected theme name as a string
   *
   * @remarks
   * Updates both the component's local state and the global theme service.
   * The theme change takes effect immediately across the entire application
   * due to the theme service's global state management.
   *
   * @example
   * ```typescript
   * // When user selects "dark" from dropdown:
   * // Updates currentTheme property
   * // Calls themeService.setTheme('dark')
   * // Application theme changes immediately
   * ```
   */
  changeTheme(theme: string): void {
    this.currentTheme = theme as Theme;
    this.themeService.setTheme(theme as Theme);
  }
}
