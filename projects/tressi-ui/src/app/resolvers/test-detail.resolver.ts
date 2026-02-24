import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';

import { TestDocument, TestMetrics } from '../services/rpc.service';
import { TestService } from '../services/test.service';

export interface TestDetailResolvedData {
  test: TestDocument;
  metrics: TestMetrics;
}

/**
 * Resolver that fetches test details and metrics for a specific test ID.
 * Ensures the test detail page has all initial data before transitioning.
 */
export const testDetailResolver: ResolveFn<TestDetailResolvedData> = async (
  route,
) => {
  const testService = inject(TestService);
  const testId = route.paramMap.get('testId');

  if (!testId) {
    throw new Error('Test ID is required for resolution');
  }

  const [test, metrics] = await Promise.all([
    testService.getTestById(testId),
    testService.getTestMetrics(testId),
  ]);

  return { test, metrics };
};
