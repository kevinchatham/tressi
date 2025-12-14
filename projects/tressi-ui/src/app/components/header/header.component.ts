import { Component, inject } from '@angular/core';

import { TitleService } from '../../services/title.service';

@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  private titleService = inject(TitleService);

  get title(): string {
    return this.titleService.getTitle();
  }
}
