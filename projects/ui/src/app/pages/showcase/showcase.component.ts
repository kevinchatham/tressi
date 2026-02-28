import { Component } from '@angular/core';
import { BUTTON_COLORS } from '@tressi/shared/ui';
import { ButtonComponent } from 'src/app/components/button/button.component';
import { ThemeSwitcherComponent } from 'src/app/components/theme-switcher/theme-switcher.component';

@Component({
  selector: 'app-showcase',
  imports: [ButtonComponent, ThemeSwitcherComponent],
  templateUrl: './showcase.component.html',
})
export class ShowcaseComponent {
  buttonColors = BUTTON_COLORS;
  logMessage(): void {
    // eslint-disable-next-line no-console
    console.log('hello');
  }
}
