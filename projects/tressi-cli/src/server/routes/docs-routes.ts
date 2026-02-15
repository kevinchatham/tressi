import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { Hono } from 'hono';

import { createApiErrorResponse } from '../utils/error-response-generator';

/**
 * The default section name used for root-level documentation files and the primary landing section.
 * This corresponds to the directory named '01-home' or similar in the docs folder.
 */
const DEFAULT_SECTION_NAME = 'Home' as const;

type MarkdownSlugs = Record<
  string,
  {
    path: string;
    realPath: string;
    docs: { slug: string; sectionSlug?: string; realPath: string }[];
  }
>;

/**
 * Recursively scans the docs directory to build a structured map of documentation.
 *
 * @param {string} dir - The directory to scan
 * @returns {Promise<Record<string, string[]>>} A map of section names to file names
 */
async function scanDocs(dir: string): Promise<MarkdownSlugs> {
  const results: MarkdownSlugs = {};
  const entries = await readdir(dir, { withFileTypes: true });

  // Sort entries by name to derive section order from directory names (e.g., 01-getting-started)
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const getNiceName = (name: string): string => name.replace(/^\d+-/, '');

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      const sectionName = getNiceName(entry.name)
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const subDocs = await readdir(fullPath);
      subDocs.sort();

      const docs = subDocs
        .filter((file) => file.endsWith('.md'))
        .map((file) => {
          const name = file.replace('.md', '');
          return {
            slug: getNiceName(name),
            sectionSlug: getNiceName(entry.name),
            realPath: join(entry.name, name),
          };
        });

      if (docs.length > 0) {
        if (!results[sectionName]) {
          results[sectionName] = {
            path: getNiceName(entry.name),
            realPath: entry.name,
            docs: [],
          };
        }
        results[sectionName].docs.push(...docs);
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const name = entry.name.replace('.md', '');
      if (!results[DEFAULT_SECTION_NAME]) {
        results[DEFAULT_SECTION_NAME] = {
          path: '',
          realPath: '',
          docs: [],
        };
      }
      results[DEFAULT_SECTION_NAME].docs.push({
        slug: getNiceName(name),
        sectionSlug: undefined, // Root files don't have a section slug
        realPath: name,
      });
    }
  }

  return results;
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
