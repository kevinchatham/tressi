import { Component } from '@angular/core';
import {
  BUTTON_COLORS,
  ButtonComponent,
} from 'src/app/components/button/button.component';

@Component({
  selector: 'app-showcase',
  imports: [ButtonComponent],
  templateUrl: './showcase.component.html',
})
export class ShowcaseComponent {
  buttonColors = BUTTON_COLORS;
  logMessage(): void {
    // eslint-disable-next-line no-console
    console.log('hello');
  }
}
