/* eslint-disable no-console */
/**
 * Performance metrics for the TUI system
 */
export interface TuiPerformanceMetrics {
  renderTimeMs: number;
  bufferUtilization: number;
  memoryUsageMB: number;
  updateFrequency: number;
  droppedFrames: number;
}

/**
 * Monitors TUI performance and provides optimization insights
 */
export class TuiPerformanceMonitor {
  private renderTimes: number[] = [];
  private frameDrops = 0;
  private readonly MAX_RENDER_TIME = 16; // 60fps threshold (16.67ms)
  private readonly MAX_HISTORY = 100;

  /**
   * Track render time for a quadrant
   */
  trackRenderTime(quadrantId: string, renderFn: () => void): number {
    const start = performance.now();
    renderFn();
    const end = performance.now();
    const renderTime = end - start;

    this.renderTimes.push(renderTime);
    if (this.renderTimes.length > this.MAX_HISTORY) {
      this.renderTimes.shift();
    }

    if (renderTime > this.MAX_RENDER_TIME) {
      this.frameDrops++;
      console.warn(
        `Quadrant ${quadrantId} render time exceeded 60fps threshold: ${renderTime.toFixed(2)}ms`,
      );
    }

    return renderTime;
  }

  /**
   * Check performance metrics and provide warnings
   */
  checkPerformance(metrics: TuiPerformanceMetrics): void {
    if (metrics.renderTimeMs > this.MAX_RENDER_TIME) {
      console.warn(
        `Render time exceeded 60fps threshold: ${metrics.renderTimeMs}ms`,
      );
    }

    if (metrics.bufferUtilization > 0.9) {
      console.warn(
        `High buffer utilization detected: ${(metrics.bufferUtilization * 100).toFixed(1)}%`,
      );
    }

    if (metrics.memoryUsageMB > 100) {
      console.warn(`High memory usage detected: ${metrics.memoryUsageMB}MB`);
    }

    if (metrics.droppedFrames > 10) {
      console.warn(
        `High frame drop rate: ${metrics.droppedFrames} frames dropped`,
      );
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): TuiPerformanceMetrics {
    const avgRenderTime =
      this.renderTimes.length > 0
        ? this.renderTimes.reduce((sum, time) => sum + time, 0) /
          this.renderTimes.length
        : 0;

    return {
      renderTimeMs: avgRenderTime,
      bufferUtilization: 0, // Will be set by buffer manager
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      updateFrequency: 0, // Will be set by update loop
      droppedFrames: this.frameDrops,
    };
  }

  /**
   * Reset performance counters
   */
  reset(): void {
    this.renderTimes = [];
    this.frameDrops = 0;
  }

  /**
   * Get render time statistics
   */
  getRenderTimeStats(): {
    average: number;
    min: number;
    max: number;
    percentile95: number;
  } {
    if (this.renderTimes.length === 0) {
      return { average: 0, min: 0, max: 0, percentile95: 0 };
    }

    const sorted = [...this.renderTimes].sort((a, b) => a - b);
    const average = sorted.reduce((sum, time) => sum + time, 0) / sorted.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95Index = Math.floor(sorted.length * 0.95);
    const percentile95 = sorted[p95Index];

    return { average, min, max, percentile95 };
  }

  /**
   * Check if performance is optimal
   */
  isPerformanceOptimal(): boolean {
    const metrics = this.getMetrics();
    return (
      metrics.renderTimeMs <= this.MAX_RENDER_TIME &&
      metrics.memoryUsageMB <= 50 &&
      metrics.droppedFrames <= 5
    );
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(): string[] {
    const metrics = this.getMetrics();
    const recommendations: string[] = [];

    if (metrics.renderTimeMs > this.MAX_RENDER_TIME) {
      recommendations.push(
        'Consider reducing update frequency or optimizing render logic',
      );
    }

    if (metrics.memoryUsageMB > 100) {
      recommendations.push(
        'High memory usage detected - consider implementing data cleanup',
      );
    }

    if (metrics.droppedFrames > 10) {
      recommendations.push(
        'High frame drop rate - consider throttling updates',
      );
    }

    return recommendations;
  }
}
