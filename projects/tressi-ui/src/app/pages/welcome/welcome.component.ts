import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ButtonComponent } from 'src/app/components/button/button.component';

import { AppRouterService } from '../../services/router.service';

@Component({
  selector: 'app-welcome',
  imports: [RouterModule, ButtonComponent],
  templateUrl: './welcome.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomeComponent {
  readonly appRouter = inject(AppRouterService);
}
