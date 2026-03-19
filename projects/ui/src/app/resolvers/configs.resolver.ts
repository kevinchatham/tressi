import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { ConfigDocument } from '@tressi/shared/common';

import { ConfigService } from '../services/config.service';

/**
 * Resolver that fetches all available configurations.
 * Used by Dashboard and Configurations pages to ensure data is ready before navigation.
 */
export const configsResolver: ResolveFn<ConfigDocument[]> = () => {
  return inject(ConfigService).getAll();
};
