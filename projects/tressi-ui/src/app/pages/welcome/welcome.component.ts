import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ButtonComponent } from 'src/app/components/button/button.component';

@Component({
  selector: 'app-welcome',
  imports: [RouterModule, ButtonComponent],
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
