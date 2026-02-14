import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { Hono } from 'hono';

import { createApiErrorResponse } from '../utils/error-response-generator';

/**
 * Recursively scans the docs directory to build a structured map of documentation.
 *
 * @param {string} dir - The directory to scan
 * @returns {Promise<Record<string, string[]>>} A map of section names to file names
 */
async function scanDocs(dir: string): Promise<Record<string, string[]>> {
  const results: Record<string, string[]> = {};
  const entries = await readdir(dir, { withFileTypes: true });

  // Define the desired order of sections
  const sectionOrder = [
    'Getting Started',
    'Usage',
    'Results',
    'Internals',
    'General',
  ];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      const sectionName = entry.name
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const subDocs = await readdir(fullPath);
      const docs = subDocs
        .filter((file) => file.endsWith('.md'))
        .map((file) => {
          const name = file.replace('.md', '');
          return join(entry.name, name);
        });

      if (docs.length > 0) {
        results[sectionName] = docs;
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      if (!results['General']) results['General'] = [];
      results['General'].push(entry.name.replace('.md', ''));
    }
  }

  // Sort the results object based on the defined order
  const sortedResults: Record<string, string[]> = {};
  sectionOrder.forEach((section) => {
    if (results[section]) {
      sortedResults[section] = results[section];
    }
  });

  // Add any sections that weren't in the explicit order
  Object.keys(results).forEach((section) => {
    if (!sortedResults[section]) {
      sortedResults[section] = results[section];
    }
  });

  return sortedResults;
}

/**
 * Creates a Hono application for documentation-related routes.
 * Provides an endpoint to list available documentation files.
 *
 * @returns {Hono} Hono app configured for documentation routes
 */
const docs = new Hono().get('/list', async (c) => {
  try {
    // Path relative to the server's execution context (dist/server)
    // The browser assets are in dist/browser/public/docs
    const docsPath = join(__dirname, 'browser', 'public', 'docs');
    const structuredDocs = await scanDocs(docsPath);

    return c.json(structuredDocs);
  } catch (error) {
    return c.json(
      createApiErrorResponse(
        'Could not read docs directory',
        'DOCS_READ_ERROR',
        [error instanceof Error ? error.message : String(error)],
        c.req.path,
      ),
      500,
    );
  }
});

export default docs;
