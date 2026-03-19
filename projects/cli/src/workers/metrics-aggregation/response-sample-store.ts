import type { ResponseSample } from '@tressi/shared/cli';

export class ResponseSampleStore {
  // Store for body samples collected during test
  // Map<url, ResponseSample[]>
  private _samples = new Map<string, Map<string, ResponseSample[]>>();

  public getCollectedResponseSamples(runId: string): Map<string, ResponseSample[]> {
    return this._samples.get(runId) || new Map();
  }

  public recordResponseSample(
    runId: string,
    url: string,
    statusCode: number,
    headers: Record<string, string>,
    body: string,
  ): void {
    if (!this._samples.has(runId)) {
      this._samples.set(runId, new Map());
    }
    const samples = this._samples.get(runId)!;

    if (!samples.has(url)) {
      samples.set(url, []);
    }

    const endpointSamples = samples.get(url)!;

    const existingSampleIndex = endpointSamples.findIndex((s) => s.statusCode === statusCode);

    if (existingSampleIndex === -1) {
      endpointSamples.push({
        body,
        headers,
        statusCode,
      });
    }
  }

  public cleanupResponseSamples(runId: string): void {
    this._samples.delete(runId);
  }
}
