import { Injectable } from '@angular/core';
import type { AppType } from '@tressi/shared/common';
import { hc } from 'hono/client';

@Injectable({
  providedIn: 'root',
})
export class RPCService {
  public readonly client = hc<AppType>('/').api;

  /**
   * Retrieves the current test status from the backend
   * @returns Promise resolving to test status information
   */
  async getTestStatus(): Promise<{ isRunning: boolean; jobId?: string }> {
    try {
      const response = await this.client.test.status.$get();
      if (!response.ok) {
        throw new Error(`Failed to get test status: ${response.statusText}`);
      }
      const data = await response.json();

      if (data.isRunning && 'jobId' in data) {
        return {
          isRunning: true,
          jobId: data.jobId as string,
        };
      }

      return { isRunning: false };
    } catch {
      return { isRunning: false }; // Safe default
    }
  }
}
