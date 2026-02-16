import { KeyValuePipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';
import { IconComponent } from 'src/app/components/icon/icon.component';

import { SearchBarComponent } from '../../../components/search-bar/search-bar.component';
import {
  GetDocsResponseSuccess,
  RPCService,
  SearchResult,
} from '../../../services/rpc.service';

@Component({
  selector: 'app-docs-menu',
  standalone: true,
  imports: [RouterModule, KeyValuePipe, SearchBarComponent, IconComponent],
  templateUrl: './docs-menu.component.html',
  styleUrl: './docs-menu.component.css',
})
export class DocsMenuComponent {
  availableDocs = input.required<GetDocsResponseSuccess>();

  expandedSection = signal<string | null>(null);
  isCollapsed = signal(false);
  searchQuery = signal('');
  searchResults = signal<SearchResult[]>([]);
  isSearching = signal(false);

  private readonly router = inject(Router);
  private readonly rpc = inject(RPCService);
  private readonly currentUrl = signal(this.router.url);

  constructor() {
    // Update the currentUrl signal on every successful navigation
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd,
        ),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects);
      });

    effect(
      () => {
        const docs = this.availableDocs();
        const url = this.currentUrl();

        // If we're at the root docs page, expand Home
        if (url === '/docs') {
          this.expandedSection.set('Home');
          return;
        }

        // Otherwise, find which section contains the current URL
        for (const [sectionKey, sectionValue] of Object.entries(docs)) {
          const sectionPath = sectionValue.path;
          if (sectionPath && url.includes(`/docs/${sectionPath}`)) {
            this.expandedSection.set(sectionKey);
            return;
          }
        }

        // Default to Home if nothing else matches
        if (!this.expandedSection()) {
          this.expandedSection.set('Home');
        }
      },
      { allowSignalWrites: true },
    );

    // Search effect
    effect(async () => {
      const query = this.searchQuery();
      if (!query || query.length < 2) {
        this.searchResults.set([]);
        this.isSearching.set(false);
        return;
      }

      this.isSearching.set(true);
      try {
        const response = await this.rpc.client.docs.search.$get({
          query: { q: query },
        });
        if (response.ok) {
          const results = await response.json();
          // Hono client types might be tricky here, but we know it's SearchResult[]
          this.searchResults.set(results as SearchResult[]);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Search failed', error);
      }
    });
  }

  // Custom comparator to preserve the order from the server
  preserveOrder = (): number => {
    return 0;
  };

  toggleSection(sectionKey: string): void {
    const section = this.availableDocs()[sectionKey];
    if (!section) return;

    // Navigate to the section's index (e.g., /docs/getting-started)
    const path = section.path ? ['/docs', section.path] : ['/docs'];
    this.router.navigate(path);

    // Ensure the section expands immediately
    this.expandedSection.set(sectionKey);
  }

  formatTitle(title: string): string {
    return title.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  onSearch(query: string): void {
    this.searchQuery.set(query);
  }

  toggleCollapse(): void {
    this.isCollapsed.update((v) => !v);
  }
}
