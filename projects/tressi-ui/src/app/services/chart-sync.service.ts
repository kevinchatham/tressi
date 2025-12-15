import { Injectable, signal } from '@angular/core';

export interface ChartSyncState {
  xAxisMin: number | null;
  xAxisMax: number | null;
  selectionStart: number | null;
  selectionEnd: number | null;
  lastInteractedChartId: string | null;
  syncGroup: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class ChartSyncService {
  private readonly state = signal<ChartSyncState>({
    xAxisMin: null,
    xAxisMax: null,
    selectionStart: null,
    selectionEnd: null,
    lastInteractedChartId: null,
    syncGroup: null,
  });

  readonly lastInteractedChartId = (): string | null =>
    this.state().lastInteractedChartId;

  private registeredCharts = new Set<string>();

  registerChart(chartId: string): void {
    this.registeredCharts.add(chartId);
  }

  setAsMaster(chartId: string, syncGroup?: string): void {
    if (!this.registeredCharts.has(chartId)) {
      // eslint-disable-next-line no-console
      console.warn(`Chart ${chartId} not registered`);
      return;
    }

    this.state.update((current) => ({
      ...current,
      lastInteractedChartId: chartId,
      syncGroup: syncGroup || current.syncGroup,
    }));
  }

  broadcastState(
    updates: Partial<
      Omit<ChartSyncState, 'lastInteractedChartId' | 'syncGroup'>
    >,
  ): void {
    this.state.update((current) => ({
      ...current,
      ...updates,
    }));
  }

  getState(): ChartSyncState {
    return this.state();
  }
}
