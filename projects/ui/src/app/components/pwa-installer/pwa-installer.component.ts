import { Component, inject } from '@angular/core';

import { PwaService } from '../../services/pwa.service';

@Component({
  imports: [],
  selector: 'app-pwa-installer',
  styleUrl: './pwa-installer.component.css',
  templateUrl: './pwa-installer.component.html',
})
export class PwaInstallerComponent {
  readonly pwaService = inject(PwaService);
}
