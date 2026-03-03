import { test as setup } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { run } from './utils';

setup('global setup', async () => {
  // eslint-disable-next-line no-console
  console.log('Building projects...');

  // Build all projects from the root using the sanitized utility
  run('npm run build');

  // Ensure the test database is clean
  const dbPath = path.resolve(__dirname, 'tressi.test.db');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
});
