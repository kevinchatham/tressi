import {
  Component,
  computed,
  inject,
  OnInit,
  SecurityContext,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import {
  CLIPBOARD_OPTIONS,
  MarkdownModule,
  MARKED_OPTIONS,
  MERMAID_OPTIONS,
  provideMarkdown,
  SANITIZE,
} from 'ngx-markdown';

import { ButtonComponent } from '../../components/button/button.component';
import { HeaderComponent } from '../../components/header/header.component';
import { IconComponent } from '../../components/icon/icon.component';
import { AppRouterService } from '../../services/router.service';
import { GetDocsResponseSuccess } from '../../services/rpc.service';
import { DocsMenuComponent } from './docs-menu/docs-menu.component';

@Component({
  selector: 'app-docs',
  imports: [
    RouterModule,
    MarkdownModule,
    HeaderComponent,
    ButtonComponent,
    IconComponent,
    DocsMenuComponent,
  ],
  providers: [
    provideMarkdown({
      sanitize: {
        provide: SANITIZE,
        useValue: SecurityContext.NONE,
      },
      clipboardOptions: {
        provide: CLIPBOARD_OPTIONS,
        useValue: {
          buttonComponent: undefined,
        },
      },
      mermaidOptions: {
        provide: MERMAID_OPTIONS,
        useValue: {
          startOnLoad: false,
          theme: 'dark',
        },
      },
      markedOptions: {
        provide: MARKED_OPTIONS,
        useValue: {
          gfm: true,
          breaks: false,
          pedantic: false,
        },
      },
    }),
  ],
  templateUrl: './docs.component.html',
  styleUrl: './docs.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class DocsComponent implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  readonly appRouter = inject(AppRouterService);
  readonly markdownSrc = signal<string>('');
  readonly error = signal<string | null>(null);
  readonly availableDocs = signal<GetDocsResponseSuccess>({});
  readonly isTransitioning = signal(false);
  readonly isBaseUrl = computed<boolean>(() => this.appRouter.isOnDocs());

  ngOnInit(): void {
    this._initializeFromResolvedData();
    this._route.params.subscribe((params) => {
      const section = params['section'];
      const filename = params['filename'] || 'index';
      const fullPath = section ? `${section}/${filename}` : filename;
      this.loadDocs(fullPath);
    });
  }

  /**
   * Initializes the component using data pre-resolved by the router.
   */
  private _initializeFromResolvedData(): void {
    const data = this._route.snapshot.data[
      'availableDocs'
    ] as GetDocsResponseSuccess;
    if (data) {
      this.availableDocs.set(data);
    }
  }

  loadDocs(slug: string): void {
    this.isTransitioning.set(true);

    // Small delay to allow fade out to start/complete
    setTimeout(() => {
      this.error.set(null);

      let realPath = slug;
      const docs = this.availableDocs();

      // Find the real path from the nice slug
      for (const section of Object.values(docs)) {
        // Check if the slug is exactly the section path (e.g. /docs/core-concepts)
        // If so, we want to load the index file for that section
        if (section.path === slug && section.path !== '') {
          const indexDoc = section.docs.find((d) => d.slug === 'index');
          if (indexDoc) {
            realPath = indexDoc.realPath;
            break;
          }
        }

        const docMatch = section.docs.find((d) => {
          const fullSlug = d.sectionSlug
            ? `${d.sectionSlug}/${d.slug}`
            : d.slug;
          return fullSlug === slug;
        });

        if (docMatch) {
          realPath = docMatch.realPath;
          break;
        }
      }

      const safeFilename = realPath.endsWith('.md')
        ? realPath
        : `${realPath}.md`;

      // Use root-relative path to ensure it works regardless of current route depth
      this.markdownSrc.set(`/docs/${safeFilename}`);
    }, 150);
  }

  onLoad(): void {
    // Small delay to ensure the markdown is fully rendered
    setTimeout(() => {
      this.isTransitioning.set(false);
    }, 100);
  }

  onError(): void {
    this.error.set('Failed to load documentation.');
    this.isTransitioning.set(false);
  }
}
