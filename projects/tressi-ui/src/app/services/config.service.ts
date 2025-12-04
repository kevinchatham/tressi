import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ConfigMetadataApiResponse,
  ConfigRecordApiResponse,
} from 'tressi-common/api';
import { serverRoutes } from 'tressi-common/api';
import { TressiConfig } from 'tressi-common/config';

import { HttpService } from './http.service';

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private readonly http = inject(HttpService);

  /**
   * Get all configuration metadata (without full config data)
   */
  getAllConfigMetadata(): Observable<ConfigMetadataApiResponse[]> {
    return this.http.request<ConfigMetadataApiResponse[]>(serverRoutes.configs);
  }

  /**
   * Get a specific configuration by ID
   */
  getConfig(id: string): Observable<ConfigRecordApiResponse> {
    return this.http.request<ConfigRecordApiResponse>({
      route: serverRoutes.configById.route.replace(':id', id),
      method: serverRoutes.configById.method,
    });
  }

  /**
   * Save a configuration (creates new or updates existing by name)
   */
  saveConfig(
    name: string,
    config: TressiConfig,
  ): Observable<ConfigRecordApiResponse> {
    return this.http.request<
      { name: string; config: TressiConfig },
      ConfigRecordApiResponse
    >(serverRoutes.saveConfig, { name, config });
  }

  /**
   * Delete a configuration by ID
   */
  deleteConfig(id: string): Observable<void> {
    return this.http.request<void>({
      route: serverRoutes.deleteConfig.route.replace(':id', id),
      method: serverRoutes.deleteConfig.method,
    });
  }
}
