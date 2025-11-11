// Export main CLI runner
export { TressiCli, runCli } from './cli-main';

// Export commands
export { InitCommand } from './commands/init-command';
export { ConfigCommand } from './commands/config-command';
export { RunCommand } from './commands/run-command';

// Export display utilities
export { displayConfig } from './display/config-display';

// Export validators - now handled by unified validator
// export { ConfigValidator } from './validators/config-validator'; // Removed
