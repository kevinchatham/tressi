import { Injectable } from '@angular/core';
import { hc, InferRequestType, InferResponseType } from 'hono/client';
import type { AppType } from 'tressi-cli/src/server';

@Injectable({
  providedIn: 'root',
})
export class RPCService {
  public client = hc<AppType>('http://localhost:3108', {
    init: {
      credentials: 'include',
    },
  }).api;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { client } = new RPCService();

export type CreateConfigRequest = InferRequestType<
  typeof client.config.$post
>['json'];

export type GetAllConfigsResponse = InferResponseType<
  typeof client.config.$get
>;

export type GetConfigByIdResponse = InferResponseType<
  (typeof client.config)[':id']['$get']
>;

export type GetHealthResponse = InferResponseType<typeof client.health.$get>;
