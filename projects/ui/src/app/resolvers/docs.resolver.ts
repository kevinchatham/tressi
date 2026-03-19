import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { MarkdownSlugs } from '@tressi/shared/common';

import { RPCService } from '../services/rpc.service';

/**
 * Resolver that fetches the list of available documentation files.
 * Ensures the documentation sidebar is populated before the page loads.
 */
export const docsResolver: ResolveFn<MarkdownSlugs> = async () => {
  const rpc = inject(RPCService);
  const response = await rpc.client.docs.list.$get();

  if (!response.ok) {
    throw new Error('Failed to load documentation list');
  }

  const data = await response.json();

  if ('error' in data) {
    throw new Error('Failed to load documentation list');
  }

  return data;
};
