import { Injectable } from '@angular/core';
import { animals, type Config, colors, uniqueNamesGenerator } from 'unique-names-generator';

@Injectable({
  providedIn: 'root',
})
export class NameService {
  private readonly _config: Config = {
    dictionaries: [colors, animals],
    length: 2,
    separator: ' ',
    style: 'capital',
  };

  /**
   * Generates a fun random name.
   */
  generate(): string {
    return uniqueNamesGenerator(this._config);
  }
}
