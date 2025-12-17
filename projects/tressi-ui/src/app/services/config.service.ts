import { inject, Injectable } from '@angular/core';

import { ConfigDocument, ModifyConfigRequest, RPCService } from './rpc.service';

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private readonly rpc = inject(RPCService);

  async getAll(): Promise<ConfigDocument[]> {
    const response = await this.rpc.client.config.$get();
    return (await response.json()) as ConfigDocument[];
  }

  async getOne(id: string): Promise<ConfigDocument | undefined> {
    const response = await this.rpc.client.config[':id'].$get({
      param: { id },
    });
    return (await response.json()) as ConfigDocument | undefined;
  }

  async saveConfig(config: ModifyConfigRequest): Promise<ConfigDocument> {
    const response = await this.rpc.client.config.$post({ json: config });
    const savedConfig = (await response.json()) as ConfigDocument;
    return savedConfig;
  }

  async deleteConfig(id: string): Promise<void> {
    await this.rpc.client.config[':id'].$delete({
      param: { id },
    });
  }
}
