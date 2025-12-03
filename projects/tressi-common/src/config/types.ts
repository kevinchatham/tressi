import type { z } from 'zod';

import type {
  TressiConfigSchema,
  TressiOptionsConfigSchema,
  TressiRequestConfigSchema,
} from './schemas.js';

/**
 * Type representing the Tressi configuration.
 */
export type TressiConfig = z.infer<typeof TressiConfigSchema>;

/**
 * Type representing the options configuration.
 */
export type TressiOptionsConfig = z.infer<typeof TressiOptionsConfigSchema>;

/**
 * Type representing a single request configuration.
 */
export type TressiRequestConfig = z.infer<typeof TressiRequestConfigSchema>;

/**
 * Strict version of TressiConfig where all fields (including nested ones) are required.
 * Use this type for internal APIs where you want to ensure all configuration values are present.
 *
 * This type is derived from {@link TressiConfig} using {@link RequiredDeep} to recursively
 * remove all optional modifiers, making every field required at every level of nesting.
 */
export type SafeTressiConfig = RequiredDeep<TressiConfig>;

/**
 * Strict version of TressiOptionsConfig where all fields (including nested ones) are required.
 * Use this type when you need to ensure all options configuration values are present.
 *
 * This type is derived from {@link TressiOptionsConfig} using {@link RequiredDeep} to recursively
 * remove all optional modifiers, making every field required at every level of nesting.
 *
 * @see {@link SafeTressiConfig} for the main configuration type
 */
export type SafeTressiOptionsConfig = RequiredDeep<TressiOptionsConfig>;

/**
 * Strict version of TressiRequestConfig where all fields are required.
 * Use this type when you need to ensure all request configuration values are present.
 *
 * This type is derived from {@link TressiRequestConfig} using {@link RequiredDeep} to recursively
 * remove all optional modifiers, making every field required.
 *
 * @see {@link SafeTressiConfig} for the main configuration type
 */
export type SafeTressiRequestConfig = RequiredDeep<TressiRequestConfig>;

/**
 * Recursively makes all properties of a type and its nested object properties required.
 *
 * This utility type traverses through an object type and removes the optional modifier (`?`)
 * from every property at every level of nesting. It's particularly useful for creating
 * strict internal types where you want to ensure all values are present, while keeping
 * the original schema flexible for external consumers.
 *
 * @template T - The type to make deeply required
 *
 * @example
 * // Given a type with optional fields:
 * type Config = {
 *   name?: string;
 *   settings?: {
 *     timeout?: number;
 *     retries?: number;
 *   };
 * };
 *
 * // RequiredDeep makes everything required:
 * type StrictConfig = RequiredDeep<Config>;
 * // Result: {
 * //   name: string;
 * //   settings: {
 * //     timeout: number;
 * //     retries: number;
 * //   };
 * // }
 *
 * @see {@link TressiConfig} for the base configuration type with optional fields
 * @see {@link SafeTressiConfig} for the strict version used internally
 */
type RequiredDeep<T> = {
  [P in keyof T]-?: T[P] extends object ? RequiredDeep<T[P]> : T[P];
};
