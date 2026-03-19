import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ButtonComponent } from 'src/app/components/button/button.component';

import { logoSrc } from '../../constants';
import { AppRouterService } from '../../services/router.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, ButtonComponent],
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
})
export class WelcomeComponent {
  readonly appRouter = inject(AppRouterService);
  readonly logoSrc = logoSrc;
}
