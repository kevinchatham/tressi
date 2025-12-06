import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import type { TressiConfig } from 'tressi-common/config';

import {
  client,
  CreateConfig,
  GetAllConfigs,
  GetConfigById,
} from './rpc-client';

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  getAllConfigMetadata(): Observable<GetAllConfigs> {
    return from(client.config.$get().then((r: Response) => r.json()));
  }

  getConfig(id: string): Observable<GetConfigById> {
    return from(
      client.config[':id']
        .$get({
          param: { id },
        })
        .then((r: Response) => r.json()),
    );
  }

  saveConfig(name: string, config: TressiConfig): Observable<CreateConfig> {
    return from(
      client.config
        .$post({
          json: { name, config },
        })
        .then((r: Response) => r.json()),
    );
  }

  deleteConfig(id: string): Observable<void> {
    return from(
      client.config[':id']
        .$delete({
          param: { id },
        })
        .then(() => undefined),
    );
  }
}
