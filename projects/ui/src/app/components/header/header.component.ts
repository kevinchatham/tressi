import { Component, inject } from '@angular/core';

import { logoSrc } from '../../constants';
import { AppRouterService } from '../../services/router.service';
import { TitleService } from '../../services/title.service';
import { ButtonComponent } from '../button/button.component';

@Component({
  imports: [ButtonComponent],
  selector: 'app-header',
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  readonly titleService = inject(TitleService);
  readonly appRouter = inject(AppRouterService);
  readonly logoSrc = logoSrc;
}
