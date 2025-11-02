/* eslint-disable no-console */
import chalk from 'chalk';

import { defaultTressiOptions } from './config';
import type {
  DisplayOptions,
  SafeTressiConfig,
  TressiOptionsConfig,
} from './types';

export function displayConfig(
  config: SafeTressiConfig,
  options: DisplayOptions,
): void {
  if (options.json) {
    console.log(JSON.stringify(formatConfigAsJson(config, options), null, 2));
    return;
  }

  displayHumanReadable(config, options);
}

function displayHumanReadable(
  config: SafeTressiConfig,
  options: DisplayOptions,
): void {
  console.log(chalk.bold('\n📋 Current Tressi Configuration'));
  console.log(
    chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'),
  );

  console.log(
    `${chalk.blue('🔧 Configuration Source:')} ${options.source || 'defaults'}`,
  );
  console.log(`${chalk.blue('📄 Schema:')} ${config.$schema}\n`);

  console.log(chalk.bold('🎯 Options:'));
  displayOptionsWithDefaults(config.options);

  console.log(chalk.bold(`\n🌐 Requests (${config.requests.length} total):`));
  config.requests.forEach((request, index) => {
    displayRequest(index + 1, request);
  });
}

function displayOptionsWithDefaults(options: TressiOptionsConfig): void {
  const entries = [
    {
      key: 'workers',
      value: options.workers,
      default: defaultTressiOptions.workers,
    },
    {
      key: 'durationSec',
      value: options.durationSec,
      default: defaultTressiOptions.durationSec,
    },
    {
      key: 'rampUpTimeSec',
      value: options.rampUpTimeSec,
      default: defaultTressiOptions.rampUpTimeSec,
    },
    { key: 'rps', value: options.rps, default: undefined },
    { key: 'useUI', value: options.useUI, default: defaultTressiOptions.useUI },
    {
      key: 'silent',
      value: options.silent,
      default: defaultTressiOptions.silent,
    },
    { key: 'exportPath', value: options.exportPath, default: undefined },
    {
      key: 'earlyExitOnError',
      value: options.earlyExitOnError,
      default: defaultTressiOptions.earlyExitOnError,
    },
    {
      key: 'errorRateThreshold',
      value: options.errorRateThreshold,
      default: undefined,
    },
    {
      key: 'errorCountThreshold',
      value: options.errorCountThreshold,
      default: undefined,
    },
    {
      key: 'errorStatusCodes',
      value: options.errorStatusCodes,
      default: defaultTressiOptions.errorStatusCodes,
    },
    {
      key: 'headers',
      value: options.headers,
      default: defaultTressiOptions.headers,
    },
  ];

  entries.forEach(({ key, value, default: defaultValue }) => {
    const isDefault = JSON.stringify(value) === JSON.stringify(defaultValue);
    const marker = isDefault
      ? chalk.gray('(default)')
      : chalk.green('(explicit)');
    const displayValue =
      value === undefined
        ? 'null'
        : typeof value === 'object'
          ? JSON.stringify(value)
          : value;
    console.log(`  • ${key}: ${displayValue} ${marker}`);
  });
}

function displayRequest(
  index: number,
  request: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    payload?: unknown;
  },
): void {
  console.log(`  ${index}. ${request.method || 'GET'} ${request.url}`);
  if (request.headers && Object.keys(request.headers).length > 0) {
    console.log(
      `     Headers: ${JSON.stringify(request.headers, null, 2).replace(/\n/g, '\n            ')}`,
    );
  }
  if (request.payload) {
    console.log(
      `     Payload: ${JSON.stringify(request.payload, null, 2).replace(/\n/g, '\n            ')}`,
    );
  }
}

function formatConfigAsJson(
  config: SafeTressiConfig,
  options: DisplayOptions,
): Record<string, unknown> {
  return {
    source: options.source || 'defaults',
    config: {
      $schema: config.$schema,
      options: config.options,
      requests: config.requests,
    },
    defaults: defaultTressiOptions,
  };
}
