import { inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class TitleService {
  private titleService = inject(Title);
  private router = inject(Router);

  private defaultTitle = 'Tressi';
  private currentTitle = this.defaultTitle;

  constructor() {
    this.initializeRouteListener();
  }

  private initializeRouteListener(): void {
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd,
        ),
      )
      .subscribe(() => {
        this.updateTitleFromRoute();
      });
  }

  private updateTitleFromRoute(): void {
    let route = this.router.routerState.root;

    while (route.firstChild) {
      route = route.firstChild;
    }

    route.data.subscribe((d: { title?: string }) => {
      const title = d.title || this.defaultTitle;
      this.setTitle(title);
    });
  }

  setTitle(title: string): void {
    this.currentTitle = title;
    this.titleService.setTitle(title);
  }

  getTitle(): string {
    return this.currentTitle;
  }

  resetTitle(): void {
    this.setTitle(this.defaultTitle);
  }
}
