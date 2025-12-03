import { sValidator } from '@hono/standard-validator';
import type { TypedResponse } from 'hono';
import { createFactory } from 'hono/factory';
import {
  ConfigMetadataApiResponse,
  ConfigRecordApiResponse,
  ErrorApiResponse,
  SaveConfigRequestSchema,
  ValidationErrorApiResponse,
} from 'tressi-common/api';

import { validateAndMergeConfig } from '../../core/config';
import { configStorage } from '../../core/config-storage';
import { ConfigValidationError } from '../../types';
import {
  createApiErrorResponse,
  createConfigMergeErrorResponse,
  createZodValidationErrorResponse,
} from '../utils/error-response-generator';

const factory = createFactory();

/**
 * GET /api/configs - Get all configuration metadata
 */
export const getAllConfigMetadataHandler = factory.createHandlers(
  async (
    c,
  ): Promise<
    TypedResponse<ConfigMetadataApiResponse[]> | TypedResponse<ErrorApiResponse>
  > => {
    try {
      const configs = await configStorage.getAllMetadata();
      return c.json(configs);
    } catch (error) {
      return c.json(
        createApiErrorResponse(
          'Failed to load configurations',
          'INTERNAL_ERROR',
          error instanceof Error ? [error.message] : undefined,
        ),
        500,
      );
    }
  },
);

/**
 * GET /api/configs/:id - Get a specific configuration
 */
export const getConfigHandler = factory.createHandlers(
  async (
    c,
  ): Promise<
    TypedResponse<ConfigRecordApiResponse> | TypedResponse<ErrorApiResponse>
  > => {
    try {
      const id = c.req.param('id');

      if (!id) {
        return c.json(
          createApiErrorResponse('Configuration ID is required', 'MISSING_ID'),
          400,
        );
      }

      const config = await configStorage.getById(id);

      if (!config) {
        return c.json(
          createApiErrorResponse('Configuration not found', 'NOT_FOUND'),
          404,
        );
      }

      return c.json(config);
    } catch (error) {
      return c.json(
        createApiErrorResponse(
          'Failed to load configuration',
          'INTERNAL_ERROR',
          error instanceof Error ? [error.message] : undefined,
        ),
        500,
      );
    }
  },
);

/**
 * DELETE /api/configs/:id - Delete a configuration
 */
export const deleteConfigHandler = factory.createHandlers(
  async (
    c,
  ): Promise<
    TypedResponse<{ success: boolean }> | TypedResponse<ErrorApiResponse>
  > => {
    try {
      const id = c.req.param('id');

      if (!id) {
        return c.json(
          createApiErrorResponse('Configuration ID is required', 'MISSING_ID'),
          400,
        );
      }

      const success = await configStorage.delete(id);

      if (!success) {
        return c.json(
          createApiErrorResponse('Configuration not found', 'NOT_FOUND'),
          404,
        );
      }

      return c.json({ success: true });
    } catch (error) {
      return c.json(
        createApiErrorResponse(
          'Failed to delete configuration',
          'INTERNAL_ERROR',
          error instanceof Error ? [error.message] : undefined,
        ),
        500,
      );
    }
  },
);

export const saveConfigHandler = factory.createHandlers(
  sValidator('json', SaveConfigRequestSchema),
  async (
    c,
  ): Promise<
    | TypedResponse<ConfigRecordApiResponse>
    | TypedResponse<ValidationErrorApiResponse>
    | TypedResponse<ErrorApiResponse>
  > => {
    try {
      const { name, config } = c.req.valid('json');

      const validationResult = validateAndMergeConfig(config);

      if (validationResult.success === false) {
        if (validationResult.error instanceof ConfigValidationError) {
          return c.json(
            createZodValidationErrorResponse(
              validationResult.error,
              c.req.path,
            ),
            400,
          );
        }

        // ConfigMergeError
        return c.json(
          createConfigMergeErrorResponse(validationResult.error, c.req.path),
          400,
        );
      }

      // Success path - TypeScript knows validationResult.data is SafeTressiConfig
      const saved = await configStorage.save(name, validationResult.data);
      return c.json(saved, 201);
    } catch (error) {
      return c.json(
        createApiErrorResponse(
          'Failed to save configuration',
          'INTERNAL_ERROR',
          error instanceof Error ? [error.message] : undefined,
        ),
        500,
      );
    }
  },
);
