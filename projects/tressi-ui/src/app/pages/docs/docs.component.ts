import { CommonModule, Location } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';

import { ButtonComponent } from '../../components/button/button.component';
import { HeaderComponent } from '../../components/header/header.component';
import { IconComponent } from '../../components/icon/icon.component';
import { GetDocsResponseSuccess, RPCService } from '../../services/rpc.service';

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MarkdownModule,
    HeaderComponent,
    ButtonComponent,
    IconComponent,
  ],
  templateUrl: './docs.component.html',
})
export class DocsComponent implements OnInit {
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  private readonly rpc = inject(RPCService);

  markdownSrc = signal<string>('');
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);
  availableDocs = signal<GetDocsResponseSuccess>({});

  // Custom comparator to preserve the order from the server
  preserveOrder = (): number => {
    return 0;
  };

  ngOnInit(): void {
    this.loadAvailableDocs();
    this.route.params.subscribe((params) => {
      const section = params['section'];
      const filename = params['filename'] || 'home';
      const fullPath = section ? `${section}/${filename}` : filename;
      this.loadDocs(fullPath);
    });
  }

  async loadAvailableDocs(): Promise<void> {
    try {
      const response = await this.rpc.client.docs.list.$get();
      if (response.ok) {
        const data = await response.json();
        if ('error' in data) {
          throw new Error('Failed to load documentation');
        }
        this.availableDocs.set(data);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load available docs:', error);
    }
  }

  loadDocs(filename: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    const safeFilename = filename.endsWith('.md') ? filename : `${filename}.md`;

    // Use root-relative path to ensure it works regardless of current route depth
    this.markdownSrc.set(`/public/docs/${safeFilename}`);
  }

  onLoad(): void {
    this.isLoading.set(false);
  }

  onError(): void {
    this.isLoading.set(false);
    this.error.set('Failed to load documentation.');
  }

  goBack(): void {
    this.location.back();
  }
}
