import { inject, Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';

import {
  GetAllConfigsResponse,
  GetConfigByIdResponse,
  ModifyConfigRequest,
  RPCService,
} from './rpc.service';

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private readonly rpc = inject(RPCService);

  getAllConfigMetadata(): Observable<GetAllConfigsResponse> {
    return from(this.rpc.client.config.$get().then((r: Response) => r.json()));
  }

  getConfig(id: string): Observable<GetConfigByIdResponse> {
    return from(
      this.rpc.client.config[':id']
        .$get({
          param: { id },
        })
        .then((r: Response) => r.json()),
    );
  }

  saveConfig(config: ModifyConfigRequest): Observable<ModifyConfigRequest> {
    return from(
      this.rpc.client.config
        .$post({
          json: config,
        })
        .then((r: Response) => r.json()),
    );
  }

  deleteConfig(id: string): Observable<void> {
    return from(
      this.rpc.client.config[':id']
        .$delete({
          param: { id },
        })
        .then(() => undefined),
    );
  }
}
