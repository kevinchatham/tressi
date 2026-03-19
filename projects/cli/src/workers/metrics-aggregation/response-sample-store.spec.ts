import { beforeEach, describe, expect, it } from 'vitest';

import { ResponseSampleStore } from './response-sample-store';

describe('ResponseSampleStore', () => {
  const runId = 'test-run';
  const url = 'http://example.com';
  let store: ResponseSampleStore;

  beforeEach(() => {
    store = new ResponseSampleStore();
  });

  it('should record and retrieve samples', () => {
    store.recordResponseSample(runId, url, 200, { 'content-type': 'text/plain' }, 'body1');

    const samples = store.getCollectedResponseSamples(runId);
    const endpointSamples = samples.get(url);

    expect(endpointSamples).toHaveLength(1);
    expect(endpointSamples![0]).toEqual({
      body: 'body1',
      headers: { 'content-type': 'text/plain' },
      statusCode: 200,
    });
  });

  it('should only store one sample per status code per url', () => {
    store.recordResponseSample(runId, url, 200, {}, 'first');
    store.recordResponseSample(runId, url, 200, {}, 'second');
    store.recordResponseSample(runId, url, 404, {}, 'not found');

    const samples = store.getCollectedResponseSamples(runId);
    const endpointSamples = samples.get(url);

    expect(endpointSamples).toHaveLength(2);
    expect(endpointSamples![0].body).toBe('first');
    expect(endpointSamples![1].statusCode).toBe(404);
  });

  it('should cleanup samples for a run', () => {
    store.recordResponseSample(runId, url, 200, {}, 'body');
    store.cleanupResponseSamples(runId);

    const samples = store.getCollectedResponseSamples(runId);
    expect(samples.size).toBe(0);
  });
});
