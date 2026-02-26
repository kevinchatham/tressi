import { Injectable } from '@angular/core';
import { hc, InferRequestType, InferResponseType } from 'hono/client';
import type { AppType } from 'tressi-cli/src/server/routes/types';

@Injectable({
  providedIn: 'root',
})
export class RPCService {
  public readonly client = hc<AppType>('/').api;

  /**
   * Retrieves the current test status from the backend
   * @returns Promise resolving to test status information
   */
  async getTestStatus(): Promise<{ isRunning: boolean; jobId?: string }> {
    try {
      const response = await this.client.test.status.$get();
      if (!response.ok) {
        throw new Error(`Failed to get test status: ${response.statusText}`);
      }
      const data = await response.json();

      if (data.isRunning && 'jobId' in data) {
        return {
          isRunning: true,
          jobId: data.jobId as string,
        };
      }

      return { isRunning: false };
    } catch {
      return { isRunning: false }; // Safe default
    }
  }
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

export type TestDocument = GetTestsResponseSuccess[number];

export type TestSummary = TestDocument['summary'];

export type TestStatus = TestDocument['status'] | 'cancelled';

export type LatencyHistogram = NonNullable<
  NonNullable<TestSummary>['global']['histogram']
>;

export type GlobalSummary = NonNullable<NonNullable<TestSummary>['global']>;

export type EndpointSummary = NonNullable<
  NonNullable<TestSummary>['endpoints']
>[number];

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

// ! Test Export
export type ExportTestResponse = InferResponseType<
  (typeof client.tests)[':id']['export']['$get']
>;

export type ExportTestRequest = InferRequestType<
  (typeof client.tests)[':id']['export']['$get']
>;

// ! Test Status
export type GetTestStatusResponse = InferResponseType<
  typeof client.test.status.$get
>;

// ! Docs
export type GetDocsResponse = InferResponseType<typeof client.docs.list.$get>;

export type GetDocsResponseSuccess = Extract<
  GetDocsResponse,
  Record<
    string,
    {
      path: string;
      realPath: string;
      docs: { slug: string; sectionSlug: string; realPath: string }[];
    }
  >
>;

export type GetDocsResponseError = Extract<GetDocsResponse, { error: object }>;

export type SearchDocsResponse = InferResponseType<
  typeof client.docs.search.$get
>;

export type SearchDocsResponseSuccess = Extract<SearchDocsResponse, unknown[]>;

export type SearchDocsResponseError = Extract<
  SearchDocsResponse,
  { error: object }
>;

export type SearchResult = SearchDocsResponseSuccess[number];

// ! Health
export type GetHealthResponse = InferResponseType<typeof client.health.$get>;
