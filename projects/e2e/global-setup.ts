import { test as setup } from '@playwright/test';

import { run } from './utils';

setup('global setup', async () => {
  run('npm run build');
});
