/**
 * Generates a safe directory name that is compatible with Windows, macOS, and Linux file systems.
 *
 * This function sanitizes input strings to ensure they can be used as directory names
 * across all major operating systems by removing or replacing invalid characters
 * and handling reserved names. Path separators (forward slashes and backslashes)
 * are preserved in the output as they may be part of nested directory structures.
 *
 * @param input - The input string to convert to a safe directory name
 * @returns A safe directory name compatible with Windows, macOS, and Linux
 *
 * @example
 * // Basic usage
 * getSafeDirectoryName("My Project v1.0")
 * // Returns: "My_Project_v1_0"
 *
 * @example
 * // Handling special characters while preserving path separators
 * getSafeDirectoryName("folder/subfolder:name:with:colons")
 * // Returns: "folder/subfolder-name-with-colons"
 *
 * @example
 * // Handling Windows reserved names
 * getSafeDirectoryName("CON")
 * // Returns: "_CON"
 *
 * @example
 * // Handling leading/trailing spaces and dots
 * getSafeDirectoryName("  spaced folder  ")
 * // Returns: "spaced_folder"
 *
 * @example
 * // Preserving path separators in nested structures
 * getSafeDirectoryName("path/to/folder:with:colons")
 * // Returns: "path/to/folder-with-colons"
 */
export function getSafeDirectoryName(input: string): string {
  if (!input || typeof input !== 'string') {
    return '_unnamed';
  }

  // Windows reserved names (case-insensitive)
  const windowsReserved = [
    'CON',
    'PRN',
    'AUX',
    'NUL',
    'COM1',
    'COM2',
    'COM3',
    'COM4',
    'COM5',
    'COM6',
    'COM7',
    'COM8',
    'COM9',
    'LPT1',
    'LPT2',
    'LPT3',
    'LPT4',
    'LPT5',
    'LPT6',
    'LPT7',
    'LPT8',
    'LPT9',
  ];

  // Characters invalid on Windows: < > : " | ? * \
  // Characters invalid on macOS/Linux: /
  // Additional problematic characters: \0 (null)
  let safeName = input
    // Remove or replace invalid characters
    .replace(/[<>:"|?*\x00-\x1f]/g, '-') // Windows invalid chars and control chars
    .replace(/:/g, '-') // Colons (mainly for Windows)

    // Trim leading/trailing spaces and dots
    .trim()
    .replace(/^\.+|\.+$/g, '')

    // Replace multiple spaces/dashes with single underscore
    .replace(/[\s-]+/g, '_')

    // Replace multiple underscores with single underscore
    .replace(/_+/g, '_')

    // Remove any remaining invalid characters
    .replace(/[^a-zA-Z0-9._\-\/\\]/g, '_');

  // Handle empty result
  if (!safeName) {
    return '_unnamed';
  }

  // Check if it's a Windows reserved name
  const upperName = safeName.toUpperCase();
  if (windowsReserved.includes(upperName)) {
    safeName = '_' + safeName;
  }

  // Ensure it doesn't end with a dot or space (Windows issue)
  safeName = safeName.replace(/[. ]+$/, '');

  // Handle names that are too long (Windows has 260 character limit, but we'll be more conservative)
  if (safeName.length > 200) {
    safeName = safeName.substring(0, 200);
  }

  // Ensure we still have a valid name after truncation
  if (!safeName || safeName === '_' || safeName === '-') {
    return '_unnamed';
  }

  return safeName;
}

/**
 * Checks if a given string is a valid directory name across all platforms.
 *
 * @param name - The directory name to validate
 * @returns True if the name is valid on all platforms, false otherwise
 *
 * @example
 * isValidDirectoryName("my-folder")
 * // Returns: true
 *
 * @example
 * isValidDirectoryName("CON")
 * // Returns: false
 */
export function isValidDirectoryName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }

  const safeName = getSafeDirectoryName(name);
  return safeName === name;
}

/**
 * Sanitizes a file name to be safe across all platforms.
 * This is similar to getSafeDirectoryName but optimized for files rather than directories.
 *
 * @param filename - The file name to sanitize
 * @returns A sanitized file name safe for all platforms
 */
export function getSafeFileName(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return '_unnamed_file';
  }

  // Start with directory name sanitization
  let safeName = getSafeDirectoryName(filename);

  // Additional file-specific sanitizations
  safeName = safeName
    // Remove path separators for files (they're allowed for directories)
    .replace(/[\/\\]/g, '_')

    // Ensure it has some kind of extension marker if it looks like it should
    .replace(/\.+$/, '')

    // Handle multiple dots
    .replace(/\.{2,}/g, '.');

  // Ensure we still have a valid name
  if (!safeName || safeName === '_' || safeName === '-') {
    return '_unnamed_file';
  }

  return safeName;
}

/**
 * Extracts the file extension from a file name, handling edge cases.
 *
 * @param filename - The file name to extract extension from
 * @returns The file extension (including the dot) or empty string if no extension
 */
export function getFileExtension(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return '';
  }

  const lastDotIndex = filename.lastIndexOf('.');

  // No dot found, or dot is at the beginning (hidden file)
  if (lastDotIndex <= 0) {
    return '';
  }

  // Dot is at the end (file ends with dot)
  if (lastDotIndex === filename.length - 1) {
    return '';
  }

  return filename.substring(lastDotIndex);
}

/**
 * Removes the file extension from a file name.
 *
 * @param filename - The file name to remove extension from
 * @returns The file name without extension
 */
export function removeFileExtension(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return '';
  }

  const lastDotIndex = filename.lastIndexOf('.');

  // No dot found, or dot is at the beginning (hidden file)
  if (lastDotIndex <= 0) {
    return filename;
  }

  return filename.substring(0, lastDotIndex);
}

/**
 * Combines a base name with an extension to create a safe file name.
 *
 * @param baseName - The base name (without extension)
 * @param extension - The file extension (with or without leading dot)
 * @returns A safe file name with extension
 */
export function combineSafeFileName(
  baseName: string,
  extension: string,
): string {
  const safeBase = getSafeFileName(baseName);
  const cleanExtension = extension.startsWith('.')
    ? extension
    : `.${extension}`;

  // Remove any existing extension from base name
  const baseWithoutExt = removeFileExtension(safeBase);

  return `${baseWithoutExt}${cleanExtension}`;
}
