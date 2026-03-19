import { expect } from '@playwright/test';

import { test } from '../setup/fixtures';

test.describe('API Integration', () => {
  test('GET /api/health should return 200 OK', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
  });

  test('GET /api/tests should return an array of results', async ({ request }) => {
    const response = await request.get('/api/test');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test('GET /api/configs should return an array of configs', async ({ request }) => {
    const response = await request.get('/api/config');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });
});
