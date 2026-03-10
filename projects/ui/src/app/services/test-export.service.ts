import { inject, Injectable } from '@angular/core';

import { LogService } from './log.service';
import { RPCService } from './rpc.service';

@Injectable({ providedIn: 'root' })
export class TestExportService {
  private readonly _rpcService = inject(RPCService);
  private readonly _logService = inject(LogService);

  async exportTest(
    testId: string,
    format: 'json' | 'xlsx' | 'md',
  ): Promise<void> {
    try {
      const response = await this._rpcService.client.tests[':id'].export.$get({
        param: { id: testId },
        query: { format },
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const filename = `test-${testId}.${format}`;
      this._downloadFile(blob, filename);

      this._logService.info('Test exported successfully', { testId, format });
    } catch (error) {
      this._logService.error('Failed to export test', error);
      throw error;
    }
  }

  private _downloadFile(blob: Blob, filename: string): void {
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
