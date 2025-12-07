import { promises as fs } from 'fs';
import * as path from 'path';
import { type TressiConfig, validateConfig } from 'tressi-common/config';
import { request } from 'undici';

class TressiConfigLoader {
  /**
   * Loads and validates configuration from file, URL, or object
   */
  async load(
    potentialConfig?: string | TressiConfig,
  ): Promise<{ config: TressiConfig; path: string }> {
    if (!potentialConfig)
      potentialConfig = path.resolve(process.cwd(), 'tressi.config.json');

    // Handle direct object input
    if (typeof potentialConfig === 'object') {
      const result = validateConfig(potentialConfig);
      if (!result.success) {
        // Convert to error for backward compat at this boundary
        throw new Error(result.error.message);
      }
      return {
        config: result.data,
        path: '[object]',
      };
    }

    // Handle URL input
    if (this.isUrl(potentialConfig)) {
      const rawContent = await this.fetchRemoteConfig(potentialConfig);
      const result = validateConfig(rawContent);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return {
        config: result.data,
        path: potentialConfig,
      };
    }

    // Handle file input
    const rawContent = await this.loadFileConfig(potentialConfig);
    const result = validateConfig(rawContent);
    if (!result.success) {
      throw new Error(result.error.message);
    }
    return {
      config: result.data,
      path: potentialConfig,
    };
  }

  private isUrl(input: string): boolean {
    return input.startsWith('http://') || input.startsWith('https://');
  }

  private async fetchRemoteConfig(url: string): Promise<unknown> {
    try {
      const { statusCode, body } = await request(url);
      if (statusCode >= 400) {
        throw new Error(`Remote config fetch failed with status ${statusCode}`);
      }
      return await body.json();
    } catch (error) {
      if (error instanceof Error && error.message.includes('fetch failed')) {
        throw error;
      }
      throw new Error(
        `Failed to fetch remote configuration: ${error instanceof Error ? error.message : 'Network error'}`,
      );
    }
  }

  private async loadFileConfig(filePath: string): Promise<unknown> {
    const absolutePath = path.resolve(filePath);

    // Check if file exists and is readable
    try {
      await fs.access(absolutePath, fs.constants.R_OK);
    } catch {
      throw new Error(
        `Configuration file not found or not readable: ${absolutePath}`,
      );
    }

    const fileContent = await fs.readFile(absolutePath, 'utf-8');

    if (!fileContent.trim()) {
      throw new Error(`Configuration file is empty: ${absolutePath}`);
    }

    try {
      return JSON.parse(fileContent);
    } catch (parseError) {
      throw new Error(
        `Invalid JSON in configuration file ${absolutePath}: ${parseError instanceof Error ? parseError.message : 'JSON parsing failed'}`,
      );
    }
  }
}

const loader = new TressiConfigLoader();

export async function loadConfig(
  configInput?: string | TressiConfig,
): Promise<{ config: TressiConfig; path: string }> {
  return await loader.load(configInput);
}
