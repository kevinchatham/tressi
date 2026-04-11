import { Component } from '@angular/core';
import { BUTTON_COLORS } from '@tressi/shared/ui';
import { ButtonComponent } from '../../components/button/button.component';
import { ThemeSwitcherComponent } from '../../components/theme-switcher/theme-switcher.component';

@Component({
  imports: [ButtonComponent, ThemeSwitcherComponent],
  selector: 'app-showcase',
  templateUrl: './showcase.component.html',
})
export class ShowcaseComponent {
  buttonColors = BUTTON_COLORS;
  logMessage(): void {
    // biome-ignore lint/suspicious/noConsole: default
    console.log('hello');
  }
}
