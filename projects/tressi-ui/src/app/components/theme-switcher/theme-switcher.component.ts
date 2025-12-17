import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';

import { AllThemes, Theme, ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-theme-switcher',
  imports: [CommonModule],
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
   * @param event - The DOM change event from the select element
   *
   * @remarks
   * Extracts the selected theme value from the event target and updates
   * both the component's local state and the global theme service.
   *
   * The theme change takes effect immediately across the entire application
   * due to the theme service's global state management. The method includes
   * proper type casting for DOM element access.
   *
   * @example
   * ```typescript
   * // When user selects "dark" from dropdown:
   * // - Updates currentTheme property
   * // - Calls themeService.setTheme('dark')
   * // - Application theme changes immediately
   * ```
   */
  changeTheme(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const theme = select.value;
    this.currentTheme = theme as Theme;
    this.themeService.setTheme(theme as Theme);
  }
}
