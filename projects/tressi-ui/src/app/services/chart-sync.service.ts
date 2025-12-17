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

  private batchMs = 16; // 60 frames per second
  private lastUpdate = 0;

  broadcastState(
    updates: Partial<
      Omit<ChartSyncState, 'lastInteractedChartId' | 'syncGroup'>
    >,
  ): void {
    const now = performance.now();
    const span = now - this.lastUpdate;
    if (span > this.batchMs) {
      this.state.update((current) => ({
        ...current,
        ...updates,
      }));
      this.lastUpdate = performance.now();
    }
  }

  getState(): ChartSyncState {
    return this.state();
  }
}
