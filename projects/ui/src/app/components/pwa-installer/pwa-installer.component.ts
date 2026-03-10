import { Component, inject } from '@angular/core';

import { PwaService } from '../../services/pwa.service';

@Component({
  selector: 'app-pwa-installer',
  imports: [],
  templateUrl: './pwa-installer.component.html',
  styleUrl: './pwa-installer.component.css',
})
export class PwaInstallerComponent {
  readonly pwaService = inject(PwaService);
}
