import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { TitleService } from '../../services/title.service';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-header',
  imports: [ButtonComponent],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  private titleService = inject(TitleService);
  private router = inject(Router);

  get title(): string {
    return this.titleService.getTitle();
  }

  navigateToDocs(): void {
    this.router.navigate(['/docs']);
  }
}
