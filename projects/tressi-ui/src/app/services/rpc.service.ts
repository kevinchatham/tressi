import { Injectable } from '@angular/core';
import { hc, InferRequestType, InferResponseType } from 'hono/client';
import type { AppType } from 'tressi-cli/src/server/routes/types';

@Injectable({
  providedIn: 'root',
})
export class RPCService {
  public readonly client = hc<AppType>('http://localhost:3108', {
    init: {
      credentials: 'include',
    },
  }).api;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { client } = new RPCService();

// ! Config
export type ModifyConfigRequest = InferRequestType<
  typeof client.config.$post
>['json'];

type GetConfigResponse = InferResponseType<typeof client.config.$get>;

export type GetConfigResponseSuccess = Extract<GetConfigResponse, unknown[]>;

export type GetConfigResponseError = Extract<
  GetConfigResponse,
  { error: object }
>;

export type ConfigDocument = GetConfigResponseSuccess[number];

// ! Metrics SSI
export type GetSystemMetricsResponse = InferResponseType<
  typeof client.metrics.system.$get
>;

// ! Metrics
export type GetEndpointsMetricsResponse = InferResponseType<
  (typeof client.metrics.endpoints)[':testId']['$get']
>;

export type GetEndpointsMetricsResponseSuccess = Extract<
  GetEndpointsMetricsResponse,
  unknown[]
>;

export type GetEndpointsMetricsResponseError = Extract<
  GetEndpointsMetricsResponse,
  { error: object }
>;

export type EndpointMetricDocument = GetEndpointsMetricsResponseSuccess[number];

export type EndpointMetric = EndpointMetricDocument['metric'];

export type GetGlobalMetricsResponse = InferResponseType<
  (typeof client.metrics.global)[':testId']['$get']
>;

export type GetGlobalMetricsResponseSuccess = Extract<
  GetGlobalMetricsResponse,
  unknown[]
>;

export type GetGlobalMetricsResponseError = Extract<
  GetGlobalMetricsResponse,
  { error: object }
>;

export type GlobalMetricDocument = GetGlobalMetricsResponseSuccess[number];

export type TestMetrics = {
  global: GlobalMetricDocument[];
  endpoints: EndpointMetricDocument[];
};

// ! Test Management
export type StartTestRequest = InferRequestType<
  typeof client.test.$post
>['json'];

export type GetTestsResponse = InferResponseType<typeof client.tests.$get>;

export type GetTestsResponseSuccess = Extract<GetTestsResponse, unknown[]>;

export type GetTestsResponseError = Extract<
  GetTestsResponse,
  { error: object }
>;

export type TestDocument = Extract<GetTestsResponseSuccess, unknown[]>[number];

export type TestStatus = TestDocument['status'];

export type DeleteTestResponse = InferResponseType<
  (typeof client.tests)[':id']['$delete']
>;

export type DeleteTestResponseSuccess = Extract<
  DeleteTestResponse,
  { metricsDeleted: object }
>;

export type DeleteTestResponseError = Extract<
  DeleteTestResponse,
  { error: object }
>;
