import { Injectable } from '@angular/core';
import {
  adjectives,
  animals,
  Config,
  uniqueNamesGenerator,
} from 'unique-names-generator';

@Injectable({
  providedIn: 'root',
})
export class NameService {
  private readonly config: Config = {
    dictionaries: [adjectives, animals],
    separator: ' ',
    length: 2,
    style: 'capital',
  };

  /**
   * Generates a fun random name.
   * Example: "brave-red-wolf"
   */
  generate(): string {
    return uniqueNamesGenerator(this.config);
  }

  /**
   * Allows generating a name with custom overrides.
   */
  generateCustom(config: Partial<Config>): string {
    return uniqueNamesGenerator({ ...this.config, ...config });
  }
}
