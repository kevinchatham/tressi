import { inject, Injectable } from '@angular/core';

import { LogService } from '../../services/log.service';
import { TestService } from '../../services/test.service';

/**
 * Result of a delete operation containing success status and details.
 */
export type DeleteResult = {
  /** Whether the entire operation was successful */
  success: boolean;
  /** Number of tests successfully deleted */
  deletedCount: number;
  /** Number of tests that failed to delete */
  failedCount: number;
  /** Array of error messages for failed deletions */
  errors: string[];
};

/**
 * Service for handling test deletion operations with loading states and error handling.
 */
@Injectable({ providedIn: 'root' })
export class TestListDeleteService {
  private readonly _testService = inject(TestService);
  private readonly _logService = inject(LogService);

  /**
   * Deletes a single test by ID.
   * @param testId - The ID of the test to delete
   * @returns Promise resolving to the deletion result
   */
  async deleteTest(testId: string): Promise<DeleteResult> {
    try {
      const result = await this._testService.deleteTest(testId);

      if (result.success) {
        this._logService.info(`Test ${testId} deleted successfully`);
        return {
          success: true,
          deletedCount: 1,
          failedCount: 0,
          errors: [],
        };
      } else {
        return {
          success: false,
          deletedCount: 0,
          failedCount: 1,
          errors: [`Failed to delete test ${testId}`],
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this._logService.error(`Failed to delete test ${testId}:`, error);
      return {
        success: false,
        deletedCount: 0,
        failedCount: 1,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Deletes multiple tests by their IDs.
   * @param testIds - Array of test IDs to delete
   * @returns Promise resolving to the combined deletion result
   */
  async deleteTests(testIds: string[]): Promise<DeleteResult> {
    if (testIds.length === 0) {
      return {
        success: true,
        deletedCount: 0,
        failedCount: 0,
        errors: [],
      };
    }

    try {
      // Delete tests one by one
      const results = await Promise.allSettled(
        testIds.map((testId) => this._testService.deleteTest(testId)),
      );

      const successfulDeletions = results.filter(
        (r) => r.status === 'fulfilled' && r.value.success,
      );
      const failedDeletions = results.filter(
        (r) =>
          r.status === 'rejected' ||
          (r.status === 'fulfilled' && !r.value.success),
      );

      const errors: string[] = [];
      failedDeletions.forEach((result, index) => {
        if (result.status === 'rejected') {
          errors.push(`Test ${testIds[index]}: ${result.reason}`);
        } else if (result.status === 'fulfilled' && !result.value.success) {
          errors.push(`Test ${testIds[index]}: Deletion failed`);
        }
      });

      if (successfulDeletions.length > 0) {
        this._logService.info(
          `${successfulDeletions.length} tests deleted successfully`,
        );
      }

      return {
        success: failedDeletions.length === 0,
        deletedCount: successfulDeletions.length,
        failedCount: failedDeletions.length,
        errors,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this._logService.error('Failed to delete tests:', error);
      return {
        success: false,
        deletedCount: 0,
        failedCount: testIds.length,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Deletes a single test with loading state management.
   * @param testId - The ID of the test to delete
   * @returns Promise resolving to the deletion result
   */
  async deleteTestWithLoading(testId: string): Promise<DeleteResult> {
    return await this.deleteTest(testId);
  }

  /**
   * Deletes multiple tests.
   * @param testIds - Array of test IDs to delete
   */
  async deleteTestsWithLoading(testIds: string[]): Promise<DeleteResult> {
    return await this.deleteTests(testIds);
  }
}
