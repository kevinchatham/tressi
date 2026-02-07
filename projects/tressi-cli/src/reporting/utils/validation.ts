/**
 * Validates export file paths to ensure they meet requirements
 */

/**
 * Validates that a file path has the expected extension
 * @param path - The file path to validate
 * @param expectedExtension - The expected file extension (e.g., '.json', '.xlsx')
 * @throws Error if the path is invalid or has wrong extension
 */
function validateExportPath(path: string, expectedExtension: string): void {
  if (!path || typeof path !== 'string') {
    throw new Error('Invalid file path provided');
  }
  if (!path.endsWith(expectedExtension)) {
    throw new Error(`File path must have ${expectedExtension} extension`);
  }
}

/**
 * Validates JSON export path
 * @param path - The file path to validate
 */
export function validatePath(path: string): void {
  validateExportPath(path, '.json');
}
