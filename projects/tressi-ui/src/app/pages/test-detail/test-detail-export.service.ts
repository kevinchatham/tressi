import { inject, Injectable } from '@angular/core';

import { LogService } from '../../services/log.service';
import { TestDocument, TestMetrics } from '../../services/rpc.service';

@Injectable({ providedIn: 'root' })
export class TestDetailExportService {
  private readonly logService = inject(LogService);

  async export(
    test: TestDocument,
    metrics: TestMetrics,
    format: 'json' | 'csv' | 'xlsx',
  ): Promise<void> {
    try {
      switch (format) {
        case 'json':
          await this.exportJSON(test, metrics);
          break;
        case 'csv':
          await this.exportCSV(test, metrics);
          break;
        case 'xlsx':
          await this.exportXLSX(test, metrics);
          break;
      }
    } catch (error) {
      this.logService.error('Export failed', error);
      throw error;
    }
  }

  private async exportJSON(
    test: TestDocument,
    metrics: TestMetrics,
  ): Promise<void> {
    const exportData = {
      test,
      metrics,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    this.downloadFile(blob, `test-${test.id}.json`);
  }

  private async exportCSV(
    test: TestDocument,
    metrics: TestMetrics,
  ): Promise<void> {
    const csvContent = this.generateCSVContent(test, metrics);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    this.downloadFile(blob, `test-${test.id}.csv`);
  }

  private async exportXLSX(
    test: TestDocument,
    metrics: TestMetrics,
  ): Promise<void> {
    // For now, use CSV as fallback since we don't have XLSX library
    await this.exportCSV(test, metrics);
    this.logService.info('XLSX export not implemented, using CSV fallback');
  }

  private generateCSVContent(test: TestDocument, metrics: TestMetrics): string {
    const lines: string[] = [];

    // Test info
    lines.push('Test Information');
    lines.push('ID,Status,Config ID,Created At,Started At,Ended At,Duration');

    const createdAt = new Date(test.epochCreatedAt).toISOString();
    const startedAt = test.summary?.global.epochStartedAt
      ? new Date(test.summary.global.epochStartedAt).toISOString()
      : '';
    const endedAt = test.summary?.global.epochEndedAt
      ? new Date(test.summary.global.epochEndedAt).toISOString()
      : '';
    const duration =
      test.summary?.global.epochStartedAt && test.summary?.global.epochEndedAt
        ? Math.round(
            (test.summary.global.epochEndedAt -
              test.summary.global.epochStartedAt) /
              1000,
          )
        : '';

    lines.push(
      `${test.id},${test.status},${test.configId},${createdAt},${startedAt},${endedAt},${duration}`,
    );
    lines.push('');

    // Global metrics
    if (metrics.global?.length) {
      lines.push('Global Metrics');
      lines.push('Timestamp,Requests Per Second, Total Requests');

      for (const metric of metrics.global) {
        const m = metric.metric;
        lines.push(
          `${new Date(metric.epoch).toISOString()},${m.requestsPerSecond},${m.totalRequests}`,
        );
      }
      lines.push('');
    }

    // Endpoint metrics
    if (metrics.endpoints?.length) {
      lines.push('Endpoint Metrics');
      lines.push('URL,Timestamp,Requests Per Second,Total Requests');

      for (const metric of metrics.endpoints) {
        const m = metric.metric;
        lines.push(
          `${metric.url},${new Date(metric.epoch).toISOString()},${m.requestsPerSecond},${m.totalRequests}`,
        );
      }
    }

    return lines.join('\n');
  }

  private downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
