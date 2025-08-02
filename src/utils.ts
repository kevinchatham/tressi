/**
 * Generates a safe directory name that is compatible with Windows, macOS, and Linux file systems.
 *
 * This function sanitizes input strings to ensure they can be used as directory names
 * across all major operating systems by removing or replacing invalid characters
 * and handling reserved names. Path separators (forward slashes and backslashes)
 * are preserved in the output as they may be part of nested directory structures.
 *
 * @param {string} input - The input string to convert to a safe directory name
 * @returns {string} A safe directory name compatible with Windows, macOS, and Linux
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
 * @param {string} name - The directory name to validate
 * @returns {boolean} True if the name is valid on all platforms, false otherwise
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
