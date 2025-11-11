import { EventEmitter } from 'events';

export interface TimingCoordinatorOptions {
  precisionMs?: number;
  driftCorrection?: boolean;
}

export class TimingCoordinator extends EventEmitter {
  private startTime: number = 0;
  private offset: number = 0;
  private precisionMs: number;
  private driftCorrection: boolean;
  private lastSyncTime: number = 0;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(options: TimingCoordinatorOptions = {}) {
    super();
    this.precisionMs = options.precisionMs || 1;
    this.driftCorrection = options.driftCorrection !== false;
  }

  async initialize(): Promise<void> {
    this.startTime = this.getSystemTime();
    this.offset = 0;
    this.lastSyncTime = this.startTime;

    if (this.driftCorrection) {
      this.startDriftCorrection();
    }

    this.emit('initialized', { startTime: this.startTime });
  }

  getCurrentTime(): number {
    const systemTime = this.getSystemTime();
    return systemTime - this.startTime + this.offset;
  }

  getSystemTime(): number {
    return Date.now();
  }

  syncWithExternal(time: number): void {
    const currentTime = this.getCurrentTime();
    const drift = time - currentTime;

    if (Math.abs(drift) > this.precisionMs) {
      this.offset += drift;
      this.lastSyncTime = this.getSystemTime();

      this.emit('sync-adjusted', {
        oldTime: currentTime,
        newTime: this.getCurrentTime(),
        drift,
      });
    }
  }

  waitUntil(targetTime: number): Promise<void> {
    return new Promise((resolve) => {
      const currentTime = this.getCurrentTime();
      const delay = targetTime - currentTime;

      if (delay <= 0) {
        resolve();
        return;
      }

      setTimeout(resolve, Math.max(0, delay - this.precisionMs));
    });
  }

  createBarrier(expectedCount: number): Promise<void> {
    let count = 0;

    return new Promise((resolve) => {
      const checkComplete = () => {
        count++;
        if (count >= expectedCount) {
          resolve();
        }
      };

      this.emit('barrier-created', { expectedCount });

      // Return the check function for external use
      return checkComplete;
    });
  }

  private startDriftCorrection(): void {
    this.syncInterval = setInterval(() => {
      const now = this.getSystemTime();
      const elapsed = now - this.lastSyncTime;

      if (elapsed > 1000) {
        // Sync every second
        const expectedTime = this.getCurrentTime();
        const actualTime = now - this.startTime + this.offset;

        if (Math.abs(actualTime - expectedTime) > this.precisionMs) {
          this.syncWithExternal(expectedTime);
        }
      }
    }, this.precisionMs * 10);
  }

  private stopDriftCorrection(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  shutdown(): void {
    this.stopDriftCorrection();
    this.emit('shutdown');
  }

  getPrecision(): number {
    return this.precisionMs;
  }

  getOffset(): number {
    return this.offset;
  }

  getUptime(): number {
    return this.getCurrentTime();
  }
}
