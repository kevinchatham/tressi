import type { form } from '@angular/forms/signals';

import type { SaveConfigRequest, TressiEarlyExitConfig } from '../common';

/**
 * Form type for early exit configuration
 */
export type EarlyExitConfigRequestFormType = ReturnType<typeof form<TressiEarlyExitConfig>>;

/**
 * Form type for modifying configuration requests
 */
export type ModifyConfigRequestFormType = ReturnType<typeof form<SaveConfigRequest>>;
