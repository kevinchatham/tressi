import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterModule } from '@angular/router';

import { GetDocsResponseSuccess } from '../../../services/rpc.service';

@Component({
  selector: 'app-docs-menu',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './docs-menu.component.html',
})
export class DocsMenuComponent {
  availableDocs = input.required<GetDocsResponseSuccess>();

  // Custom comparator to preserve the order from the server
  preserveOrder = (): number => {
    return 0;
  };

  formatTitle(title: string): string {
    return title.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }
}
