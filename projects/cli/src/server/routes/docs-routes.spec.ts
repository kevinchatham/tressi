import * as fs from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import docs from './docs-routes';

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

describe('docs-routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /list should return structured docs', async () => {
    vi.mocked(fs.readdir).mockImplementation((async (path: unknown): Promise<unknown[]> => {
      if ((path as string).endsWith('browser/docs')) {
        return [{ isDirectory: () => true, name: '01-getting-started' }] as unknown as unknown[];
      }
      return ['01-intro.md'] as unknown as unknown[];
    }) as unknown as typeof fs.readdir);

    const res = await docs.request('/list');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('Getting Started');
  });

  it('GET /search should return search results', async () => {
    vi.mocked(fs.readdir).mockImplementation((async (path: unknown): Promise<unknown[]> => {
      if ((path as string).endsWith('browser/docs')) {
        return [{ isDirectory: () => true, name: '01-getting-started' }] as unknown as unknown[];
      }
      return ['01-intro.md'] as unknown as unknown[];
    }) as unknown as typeof fs.readdir);
    vi.mocked(fs.readFile).mockResolvedValue('test content');

    const res = await docs.request('/search?q=test');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
