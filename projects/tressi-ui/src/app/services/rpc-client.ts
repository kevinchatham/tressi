import { hc, InferRequestType, InferResponseType } from 'hono/client';
import type { AppType } from 'tressi-cli/src/server';

// Create the Hono client with proper typing
const client = hc<AppType>('http://localhost:3108', {
  init: {
    credentials: 'include',
  },
}).api;

export { client };

export type CreateConfig = InferRequestType<typeof client.config.$post>['json'];

export type GetAllConfigs = InferResponseType<typeof client.config.$get>;

export type GetConfigById = InferResponseType<
  (typeof client.config)[':id']['$get']
>;

export type GetHealthResponse = InferResponseType<typeof client.health.$get>;
