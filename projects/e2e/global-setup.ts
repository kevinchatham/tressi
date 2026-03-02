import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function globalSetup(config: FullConfig): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('Building projects...');

  const rootDir = path.resolve(__dirname, '../../');

  // Build all projects from the root
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

  // Ensure the test database is clean
  const dbPath = path.resolve(__dirname, 'tressi.test.db');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
}

export default globalSetup;
