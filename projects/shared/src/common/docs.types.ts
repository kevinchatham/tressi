/**
 * Represents the structure of documentation sections and their documents.
 */
export type MarkdownSlugs = Record<
  string,
  {
    path: string;
    realPath: string;
    docs: { slug: string; sectionSlug: string; realPath: string }[];
  }
>;

/**
 * Represents a single search result from the documentation.
 */
export type DocSearchResult = {
  title: string;
  content: string;
  slug: string;
  section?: string;
  path: string;
  score?: number;
};
