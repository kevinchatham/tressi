import { Injectable, signal } from '@angular/core';
import type { ChartSyncState } from '@tressi/shared/ui';

@Injectable({
  providedIn: 'root',
})
export class ChartSyncService {
  private readonly _state = signal<ChartSyncState>({
    lastInteractedChartId: null,
    selectionEnd: null,
    selectionStart: null,
    xAxisMax: null,
    xAxisMin: null,
  });

  readonly lastInteractedChartId = (): string | null => this._state().lastInteractedChartId;

  private readonly _registeredCharts = new Set<string>();

  registerChart(chartId: string): void {
    this._registeredCharts.add(chartId);
  }

  setAsMaster(chartId: string): void {
    if (!this._registeredCharts.has(chartId)) {
      // biome-ignore lint/suspicious/noConsole: default
      console.warn(`Chart ${chartId} not registered`);
      return;
    }

    this._state.update((current) => ({
      ...current,
      lastInteractedChartId: chartId,
    }));
  }

  private readonly _batchMs = 16; // 60 frames per second
  private _lastUpdate = 0;

  broadcastState(updates: Partial<Omit<ChartSyncState, 'lastInteractedChartId'>>): void {
    const now = Date.now();
    const span = now - this._lastUpdate;
    if (span > this._batchMs) {
      this._state.update((current) => ({
        ...current,
        ...updates,
      }));
      this._lastUpdate = Date.now();
    }
  }

  getState(): ChartSyncState {
    return this._state();
  }
}
