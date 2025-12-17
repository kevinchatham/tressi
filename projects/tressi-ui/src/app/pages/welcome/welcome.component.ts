import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

import { IconComponent } from '../../components/icon/icon.component';

@Component({
  selector: 'app-welcome',
  imports: [RouterModule, IconComponent],
  templateUrl: './welcome.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomeComponent {
  private readonly router = inject(Router);

  /**
   * Navigates to the settings page when the user clicks the CTA button.
   */
  navigateToSettings(): void {
    this.router.navigate(['/settings']);
  }
}
