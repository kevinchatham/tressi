/**
 * Theme and color types for shared use across UI components
 */

/**
 * Available UI themes
 */
export const ALL_THEMES = ['shine', 'storm'] as const;

/**
 * Theme type derived from the constants
 */
export type Theme = (typeof ALL_THEMES)[number];

/**
 * Available button colors
 */
export const BUTTON_COLORS = [
  'primary',
  'secondary',
  'accent',
  'rainbow',
  'default',
  'neutral',
  'info',
  'success',
  'warning',
  'error',
] as const;

/**
 * Button color type derived from the constants
 */
export type ButtonColor = (typeof BUTTON_COLORS)[number];

/**
 * Color state for performance metrics
 */
export type MetricState = 'good' | 'warning' | 'error';
