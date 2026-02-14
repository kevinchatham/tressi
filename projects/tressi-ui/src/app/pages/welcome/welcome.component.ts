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
  navigateToConfigs(): void {
    this.router.navigate(['/configs']);
  }

  navigateToDocs(): void {
    this.router.navigate(['/docs']);
  }
}
