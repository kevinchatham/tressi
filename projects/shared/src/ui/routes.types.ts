/**
 * Application route constants and types
 */
export const AppRoutes = {
  HOME: '',
  WELCOME: 'welcome',
  CONFIGS: 'configs',
  CONFIGS_CREATE: 'configs/create',
  DASHBOARD: 'dashboard',
  DASHBOARD_WITH_ID: 'dashboard/:configId',
  TESTS_WITH_ID: 'tests/:testId',
  DOCS: 'docs',
  DOCS_WITH_FILENAME: 'docs/:filename',
  DOCS_WITH_SECTION: 'docs/:section/:filename',
  SERVER_UNAVAILABLE: 'server-unavailable',
  SHOWCASE: 'showcase',
} as const;

/**
 * Type representing a valid application route
 */
export type AppRoute = (typeof AppRoutes)[keyof typeof AppRoutes];
