/** biome-ignore-all lint/nursery/useExplicitType: hono */

import { sValidator } from '@hono/standard-validator';
import { type TressiConfig, validateConfig } from '@tressi/shared/common';
import { Hono } from 'hono';
import z from 'zod';

import { configStorage } from '../../collections/config-collection';
import { createApiErrorResponse } from '../utils/error-response-generator';

/**
 * Configuration management routes for handling CRUD operations on load test configurations.
 * Provides endpoints for listing, retrieving, creating, and deleting configurations.
 */
const app = new Hono()
  /**
   * GET / - Retrieves all configurations
   * @returns {Promise<Response>} JSON array of configurations
   */
  .get('/', async (c) => {
    try {
      const configs = await configStorage.getAll();
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
  })
  /**
   * GET /:id - Retrieves a specific configuration by ID
   * @param {string} id - The configuration ID from URL parameter
   * @returns {Promise<Response>} JSON configuration data or error response
   */
  .get('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      if (!id) {
        return c.json(createApiErrorResponse('Configuration ID is required', 'MISSING_ID'), 400);
      }
      const config = await configStorage.getById(id);
      if (!config) {
        return c.json(createApiErrorResponse('Configuration not found', 'NOT_FOUND'), 404);
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
  })
  /**
   * POST / - Creates a new configuration
   * Validates the configuration before saving
   * @param {SaveConfigRequest} body - Configuration data from request body
   * @returns {Promise<Response>} Created configuration with 201 status or error response
   */
  .post(
    '/',
    sValidator(
      'json',
      z.object({
        config: z.custom<TressiConfig>(),
        id: z.string().optional(),
        name: z.string(),
      }),
    ),
    async (c) => {
      try {
        const model = c.req.valid('json');
        const validationResult = validateConfig(model.config);
        if (validationResult.success === false) {
          return c.json(validationResult.error, 400);
        }

        const saved = model.id
          ? await configStorage.edit({
              config: model.config,
              id: model.id,
              name: model.name,
            })
          : await configStorage.create({
              config: model.config,
              name: model.name,
            });
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
  )
  /**
   * DELETE /:id - Deletes a configuration by ID
   * @param {string} id - The configuration ID from URL parameter
   * @returns {Promise<Response>} Success response or error if not found
   */
  .delete('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      if (!id) {
        return c.json(createApiErrorResponse('Configuration ID is required', 'MISSING_ID'), 400);
      }
      const success = await configStorage.delete(id);
      if (!success) {
        return c.json(createApiErrorResponse('Configuration not found', 'NOT_FOUND'), 404);
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
  });

export default app;
