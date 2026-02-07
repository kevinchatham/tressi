import { Injectable } from '@angular/core';

import { LogService } from './log.service';
import { RPCService } from './rpc.service';

@Injectable({ providedIn: 'root' })
export class TestExportService {
  constructor(
    private rpcService: RPCService,
    private logService: LogService,
  ) {}

  async exportTest(
    testId: string,
    format: 'json' | 'xlsx' | 'md',
  ): Promise<void> {
    try {
      const response = await this.rpcService.client.tests[':id'].export.$get({
        param: { id: testId },
        query: { format },
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const filename = `test-${testId}.${format}`;
      this.downloadFile(blob, filename);

      this.logService.info('Test exported successfully', { testId, format });
    } catch (error) {
      this.logService.error('Failed to export test', error);
      throw error;
    }
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
