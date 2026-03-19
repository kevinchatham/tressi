import type { createApp } from '../../../cli/src/server/routes';

/**
 * Type-only export of the AppType to prevent Angular compiler from pulling in
 * the entire @tressi/cli application when only the type is needed.
 *
 * This file should only contain type imports and exports - no runtime code.
 */
export type AppType = ReturnType<typeof createApp>;
