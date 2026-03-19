import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import type { MarkdownSlugs } from '@tressi/shared/common';
import type { ClientResponse } from 'hono/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RPCService } from '../services/rpc.service';
import { docsResolver } from './docs.resolver';

// Create a mock ClientResponse that matches the hono interface
function createMockClientResponse<T>(body: string, status: number): ClientResponse<T> {
  const response = {
    arrayBuffer: async (): Promise<ArrayBuffer> => new ArrayBuffer(0),
    blob: async (): Promise<Blob> => new Blob([body]),
    body: null,
    bodyUsed: false,
    bytes: async (): Promise<Uint8Array> => new Uint8Array(),
    clone: (): Response => new Response(null, { status }),
    formData: async (): Promise<FormData> => new FormData(),
    headers: new Headers(),
    json: async (): Promise<T> => JSON.parse(body),
    ok: status >= 200 && status < 300,
    redirect: (_url: string, status: number): Response => new Response(null, { status }),
    redirected: false,
    status,
    statusText: status === 200 ? 'OK' : 'Server Error',
    text: async (): Promise<string> => body,
    type: 'basic',
    url: 'http://localhost',
  };

  return response as unknown as ClientResponse<T>;
}

describe('docsResolver', () => {
  let rpcServiceSpy: RPCService;
  let getDocsMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getDocsMock = vi.fn();

    const mockClient = {
      docs: {
        list: {
          $get: getDocsMock,
        },
      },
    };

    rpcServiceSpy = {
      client: mockClient,
    } as unknown as RPCService;

    TestBed.configureTestingModule({
      providers: [{ provide: RPCService, useValue: rpcServiceSpy }],
    });
  });

  it('should resolve docs slugs successfully', async () => {
    const mockRoute = {} as ActivatedRouteSnapshot;
    const mockState = {} as RouterStateSnapshot;

    const mockDocs: MarkdownSlugs = {
      '01-getting-started': {
        docs: [
          {
            realPath: 'docs/01-getting-started/01-intro.md',
            sectionSlug: '01-getting-started',
            slug: '01-intro.md',
          },
        ],
        path: 'docs/01-getting-started',
        realPath: '/docs/01-getting-started',
      },
    };

    const mockResponse = createMockClientResponse<MarkdownSlugs>(JSON.stringify(mockDocs), 200);

    getDocsMock.mockResolvedValue(mockResponse);

    const resolved = await TestBed.runInInjectionContext(() => docsResolver(mockRoute, mockState));

    expect(resolved).toEqual(mockDocs);
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });

  it('should throw error if response not ok', async () => {
    const mockRoute = {} as ActivatedRouteSnapshot;
    const mockState = {} as RouterStateSnapshot;

    const mockResponse = createMockClientResponse<string>('Server error', 500);

    getDocsMock.mockResolvedValue(mockResponse);

    await expect(
      TestBed.runInInjectionContext(() => docsResolver(mockRoute, mockState)),
    ).rejects.toThrow();
  });

  it('should throw error if data contains error', async () => {
    const mockRoute = {} as ActivatedRouteSnapshot;
    const mockState = {} as RouterStateSnapshot;

    const mockErrorData = { error: 'Failed to load docs' };

    const mockResponse = createMockClientResponse<typeof mockErrorData>(
      JSON.stringify(mockErrorData),
      200,
    );

    getDocsMock.mockResolvedValue(mockResponse);

    await expect(
      TestBed.runInInjectionContext(() => docsResolver(mockRoute, mockState)),
    ).rejects.toThrow();
  });
});
