import { computed, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pageLoadingStates = signal<Map<string, boolean>>(new Map());

  public readonly isLoading = computed(() => {
    const states = this.pageLoadingStates();
    return Array.from(states.values()).some((isLoading) => isLoading);
  });

  public registerPage(pageName: string): void {
    this.pageLoadingStates.update((states) => {
      const newStates = new Map(states);
      newStates.set(pageName, false);
      return newStates;
    });
  }

  public unregisterPage(pageName: string): void {
    this.pageLoadingStates.update((states) => {
      const newStates = new Map(states);
      newStates.delete(pageName);
      return newStates;
    });
  }

  public setPageLoading(pageName: string, isLoading: boolean): void {
    this.pageLoadingStates.update((states) => {
      const newStates = new Map(states);
      if (newStates.has(pageName)) {
        newStates.set(pageName, isLoading);
      }
      return newStates;
    });
  }

  public getPageLoading(pageName: string): boolean {
    return this.pageLoadingStates().get(pageName) ?? false;
  }
}
