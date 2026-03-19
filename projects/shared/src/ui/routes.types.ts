/**
 * Application route constants and types
 */
export const AppRoutes = {
  CONFIGS: 'configs',
  CONFIGS_CREATE: 'configs/create',
  DASHBOARD: 'dashboard',
  DASHBOARD_WITH_ID: 'dashboard/:configId',
  DOCS: 'docs',
  DOCS_WITH_FILENAME: 'docs/:filename',
  DOCS_WITH_SECTION: 'docs/:section/:filename',
  HOME: '',
  SERVER_UNAVAILABLE: 'server-unavailable',
  SHOWCASE: 'showcase',
  TESTS_WITH_ID: 'tests/:testId',
  WELCOME: 'welcome',
} as const;

/**
 * Type representing a valid application route
 */
export type AppRoute = (typeof AppRoutes)[keyof typeof AppRoutes];
