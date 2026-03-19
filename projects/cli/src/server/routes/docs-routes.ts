/** biome-ignore-all lint/nursery/useExplicitType: hono */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { DocSearchResult, MarkdownSlugs } from '@tressi/shared/common';
import Fuse from 'fuse.js';
import { Hono } from 'hono';

import { createApiErrorResponse } from '../utils/error-response-generator';

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
            realPath: join(entry.name, name),
            sectionSlug: getNiceName(entry.name),
            slug: getNiceName(name),
          };
        });

      if (docs.length > 0) {
        if (!results[sectionName]) {
          results[sectionName] = {
            docs: [],
            path: getNiceName(entry.name),
            realPath: entry.name,
          };
        }
        results[sectionName].docs.push(...docs);
      }
    }
  }

  return results;
}

/**
 * Creates a Hono application for documentation-related routes.
 * Provides an endpoint to list available documentation files.
 */
const docs = new Hono()
  .get('/list', async (c) => {
    try {
      // Path relative to the server's execution context (dist/server)
      // The browser assets are in dist/browser/docs
      const docsPath = join(__dirname, 'browser', 'docs');
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
  })
  .get('/search', async (c) => {
    const query = c.req.query('q');
    if (!query) {
      return c.json([]);
    }

    try {
      const docsPath = join(__dirname, 'browser', 'docs');
      const structuredDocs = await scanDocs(docsPath);

      const allDocs: DocSearchResult[] = [];

      for (const [sectionName, section] of Object.entries(structuredDocs)) {
        for (const doc of section.docs) {
          const filePath = join(docsPath, `${doc.realPath}.md`);
          const content = await readFile(filePath, 'utf-8');
          allDocs.push({
            content,
            // If it's an index file, the path is just the section path
            // Otherwise, append the slug to the section path
            path: doc.slug === 'index' ? section.path : `${section.path}/${doc.slug}`,
            section: sectionName,
            slug: doc.slug,
            title: doc.slug,
          });
        }
      }

      const fuse = new Fuse(allDocs, {
        includeScore: true,
        keys: ['title', 'content'],
        threshold: 0.4,
      });

      const results = fuse.search(query).map((result) => ({
        ...result.item,
        score: result.score,
      }));

      return c.json(results);
    } catch (error) {
      return c.json(
        createApiErrorResponse(
          'Could not perform search',
          'DOCS_SEARCH_ERROR',
          [error instanceof Error ? error.message : String(error)],
          c.req.path,
        ),
        500,
      );
    }
  });

export default docs;
