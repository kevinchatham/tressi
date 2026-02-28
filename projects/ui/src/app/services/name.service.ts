import { Injectable } from '@angular/core';
import {
  animals,
  colors,
  Config,
  uniqueNamesGenerator,
} from 'unique-names-generator';

@Injectable({
  providedIn: 'root',
})
export class NameService {
  private readonly _config: Config = {
    dictionaries: [colors, animals],
    separator: ' ',
    length: 2,
    style: 'capital',
  };

  /**
   * Generates a fun random name.
   */
  generate(): string {
    return uniqueNamesGenerator(this._config);
  }
}
