import { Injectable, signal } from '@angular/core';

export type ChartSyncState = {
  xAxisMin: number | null;
  xAxisMax: number | null;
  selectionStart: number | null;
  selectionEnd: number | null;
  lastInteractedChartId: string | null;
};

@Injectable({
  providedIn: 'root',
})
export class ChartSyncService {
  private readonly _state = signal<ChartSyncState>({
    xAxisMin: null,
    xAxisMax: null,
    selectionStart: null,
    selectionEnd: null,
    lastInteractedChartId: null,
  });

  readonly lastInteractedChartId = (): string | null =>
    this._state().lastInteractedChartId;

  private readonly _registeredCharts = new Set<string>();

  registerChart(chartId: string): void {
    this._registeredCharts.add(chartId);
  }

  setAsMaster(chartId: string): void {
    if (!this._registeredCharts.has(chartId)) {
      // eslint-disable-next-line no-console
      console.warn(`Chart ${chartId} not registered`);
      return;
    }

    this._state.update((current) => ({
      ...current,
      lastInteractedChartId: chartId,
    }));
  }

  private _batchMs = 16; // 60 frames per second
  private _lastUpdate = 0;

  broadcastState(
    updates: Partial<Omit<ChartSyncState, 'lastInteractedChartId'>>,
  ): void {
    const now = performance.now();
    const span = now - this._lastUpdate;
    if (span > this._batchMs) {
      this._state.update((current) => ({
        ...current,
        ...updates,
      }));
      this._lastUpdate = performance.now();
    }
  }

  getState(): ChartSyncState {
    return this._state();
  }
}
