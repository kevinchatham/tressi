import { CommonModule, Location } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';

import { ButtonComponent } from '../../components/button/button.component';
import { HeaderComponent } from '../../components/header/header.component';
import { IconComponent } from '../../components/icon/icon.component';
import { GetDocsResponseSuccess } from '../../services/rpc.service';

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
  markdownSrc = signal<string>('');
  error = signal<string | null>(null);
  availableDocs = signal<GetDocsResponseSuccess>({});

  // Custom comparator to preserve the order from the server
  preserveOrder = (): number => {
    return 0;
  };

  ngOnInit(): void {
    this.initializeFromResolvedData();
    this.route.params.subscribe((params) => {
      const section = params['section'];
      const filename = params['filename'] || 'home';
      const fullPath = section ? `${section}/${filename}` : filename;
      this.loadDocs(fullPath);
    });
  }

  /**
   * Initializes the component using data pre-resolved by the router.
   */
  private initializeFromResolvedData(): void {
    const data = this.route.snapshot.data[
      'availableDocs'
    ] as GetDocsResponseSuccess;
    if (data) {
      this.availableDocs.set(data);
    }
  }

  loadDocs(filename: string): void {
    this.error.set(null);

    const safeFilename = filename.endsWith('.md') ? filename : `${filename}.md`;

    // Use root-relative path to ensure it works regardless of current route depth
    this.markdownSrc.set(`/public/docs/${safeFilename}`);
  }

  onError(): void {
    this.error.set('Failed to load documentation.');
  }

  goBack(): void {
    this.location.back();
  }
}
