import { runCli } from './cli/cli-main';
import { clearTerminal } from './utils/cli-utils';

clearTerminal();
runCli().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('CLI Error:', error);
  process.exit(1);
});
