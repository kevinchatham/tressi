import { inject, Injectable } from '@angular/core';

import { LogService } from './log.service';
import type {
  DeleteTestResponseSuccess,
  TestDocument,
  TestMetrics,
} from './rpc.service';
import { RPCService } from './rpc.service';

@Injectable({
  providedIn: 'root',
})
export class TestService {
  private readonly rpc = inject(RPCService);
  private readonly logService = inject(LogService);
  private readonly testClient = this.rpc.client.tests;
  private readonly metricsClient = this.rpc.client.metrics;

  /**
   * Get all tests and filter by config ID
   * @param configId The configuration ID to filter tests by
   * @returns Promise<TestDocument[]> Array of tests for the given config
   */
  async getTestsByConfigId(configId: string): Promise<TestDocument[]> {
    try {
      const response = await this.testClient.$get();

      if (!response.ok) {
        throw new Error(`Failed to load tests: ${response.statusText}`);
      }

      const allTests: TestDocument[] = await response.json();
      const filteredTests = allTests.filter(
        (test) => test.configId === configId,
      );

      // Sort by creation time, most recent first
      return filteredTests.sort((a, b) => b.epochCreatedAt - a.epochCreatedAt);
    } catch (error) {
      this.logService.error('Failed to load tests:', error);
      throw error;
    }
  }

  /**
   * Get a single test by ID
   * @param testId The test ID to retrieve
   * @returns Promise<TestDocument> The test document
   */
  async getTestById(id: string): Promise<TestDocument> {
    try {
      const response = await this.testClient[':id'].$get({
        param: { id },
      });

      if (!response.ok) {
        throw new Error(`Failed to load test: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      this.logService.error('Failed to load test:', error);
      throw error;
    }
  }

  /**
   * Delete a test by ID with confirmation
   * @param testId The test ID to delete
   * @returns Promise<void>
   */
  async deleteTest(id: string): Promise<DeleteTestResponseSuccess> {
    try {
      const response = await this.testClient[':id'].$delete({
        param: { id },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete test: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      this.logService.error('Failed to delete test:', error);
      throw error;
    }
  }

  /**
   * Get both global and endpoint metrics for a test
   * @param id The test ID to retrieve metrics for
   * @returns Promise<TestMetrics> Object containing global and endpoint metrics
   */
  async getTestMetrics(id: string): Promise<TestMetrics> {
    try {
      const globalMetricsPromise = this.metricsClient.global[':testId'].$get({
        param: { testId: id },
      });

      const endpointMetricsPromise = this.metricsClient.endpoints[
        ':testId'
      ].$get({
        param: { testId: id },
      });

      const [globalResponse, endpointsResponse] = await Promise.all([
        globalMetricsPromise,
        endpointMetricsPromise,
      ]);

      if (!globalResponse.ok) {
        throw new Error(
          `Failed to load global metrics: ${globalResponse.statusText}`,
        );
      }

      if (!endpointsResponse.ok) {
        throw new Error(
          `Failed to load endpoint metrics: ${endpointsResponse.statusText}`,
        );
      }

      const globalMetrics = await globalResponse.json();
      const endpointMetrics = await endpointsResponse.json();

      // Sort metrics by timestamp (epoch)
      globalMetrics.sort((a, b) => a.epoch - b.epoch);
      endpointMetrics.sort((a, b) => a.epoch - b.epoch);

      return {
        global: globalMetrics,
        endpoints: endpointMetrics,
      };
    } catch (error) {
      this.logService.error('Failed to load test metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate test duration in milliseconds
   * @param test The test document
   * @returns number Duration in milliseconds, or 0 if test hasn't started
   */
  getTestDuration(test: TestDocument): number {
    // Use embedded summary fields
    if (test.summary?.global.epochStartedAt) {
      const endTime = test.summary?.global.epochEndedAt || Date.now();
      return endTime - test.summary.global.epochStartedAt;
    }

    return 0;
  }
}
