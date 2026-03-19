import { inject } from '@angular/core';
import type { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import type { TestDetailResolvedData } from '@tressi/shared/ui';

import { TestService } from '../services/test.service';

/**
 * Resolver that fetches test details and metrics for a specific test ID.
 * Ensures the test detail page has all initial data before transitioning.
 */
export const testDetailResolver: ResolveFn<TestDetailResolvedData> = async (
  route: ActivatedRouteSnapshot,
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

  return { metrics, test };
};
