/**
 * Scans TypeScript files and adds/fixes JSDoc comments using a locally running
 * llama.cpp server via its OpenAI-compatible HTTP API.
 *
 * Takes a whole-file approach - sends the entire file to the LLM and gets
 * the complete file back with JSDoc added or updated.
 *
 * @example
 * # Scan current directory and generate JSDocs
 * npx tsx scripts/documenter.ts
 *
 * @example
 * # Scan a specific directory
 * npx tsx scripts/documenter.ts ./src
 *
 * @example
 * # Scan and target a specific file
 * npx tsx scripts/documenter.ts ./src/cli.ts
 */

import { readdir, readFile, stat, writeFile } from 'fs/promises';
import { join } from 'path';

const root = process.argv[2] ?? '.';
const llama = 'http://desktop:8080/v1/chat/completions';
const key = '1234';
const model = 'ggml-gpt-oss-20b-mxfp4';

// Enable verbose logging for debugging
const DEBUG = process.argv.includes('--debug') || process.argv.includes('-d');

const ignore = new Set(['node_modules', 'dist', '.git']);

// Statistics tracking
const stats = {
  filesProcessed: 0,
  filesUpdated: 0,
  filesUnchanged: 0,
};

function logDebug(...args: unknown[]): void {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('[DEBUG]', ...args);
  }
}

/* -------------------------------------------------- */
/* filesystem                                          */
/* -------------------------------------------------- */

async function findTsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];

  for (const e of entries) {
    const full = join(dir, e.name);

    if (e.isDirectory()) {
      if (!ignore.has(e.name)) {
        out.push(...(await findTsFiles(full)));
      }
    } else if (e.isFile() && e.name.endsWith('.ts')) {
      out.push(full);
    }
  }

  return out;
}

/* -------------------------------------------------- */
/* llama.cpp call                                      */
/* -------------------------------------------------- */

async function generateJsDoc(content: string): Promise<string> {
  const res = await fetch(llama, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a TypeScript documentation assistant. Add or update JSDoc comments for functions, methods, and classes.',
        },
        {
          role: 'user',
          content: `
Rules:
- Always output valid JSDoc comment blocks using /** ... */ syntax.
- Add JSDoc comments where they are completely missing.
- Correct existing JSDoc if it is incorrect or misleading.
- JSDoc comments must contain description text only.
- Do NOT add any JSDoc tags by default.
- The ONLY allowed JSDoc tags are @example and @remarks.
- Add an @example or @remarks tag ONLY when the behavior of the code is not obvious from
  the name, signature, or types.
- Do NOT add @example or @remarks for simple data structures, enums, or straightforward
  getters/setters.
- If existing JSDoc contains tags other than @example or @remarks, remove them.
- Wrap description lines if they exceed approximately 80 characters.
- NEVER add JSDoc comments to constructor methods.
- If constructor methods have JSDoc comments, remove them.
- Constructors are methods named "constructor" inside classes.
- If no changes are needed, return the file unchanged.
- Output ONLY the TypeScript source code.
- The output MUST be valid, syntactically correct TypeScript.
- Preserve all existing imports, exports, statements, and punctuation exactly
  unless a change is required to add, update, or remove JSDoc comments.
- Do NOT refactor, reorder, or rewrite code.
- Do NOT add, remove, or modify any non-JSDoc code.
- Do NOT include explanations, markdown, or code fences.

File content:
${content}
`,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const result = json.choices[0].message.content.trim();

  // Remove markdown code block wrapper if present
  const codeMatch = result.match(/```(?:typescript|ts)?\n([\s\S]*?)\n```$/);
  return codeMatch ? codeMatch[1] : result;
}

/* -------------------------------------------------- */
/* main logic                                          */
/* -------------------------------------------------- */

async function processFile(
  file: string,
  current: number,
  total: number,
): Promise<void> {
  const content = await readFile(file, 'utf8');

  logDebug(`Processing file: ${file}`);

  const documentedContent = await generateJsDoc(content);

  // Check if content changed
  if (documentedContent === content) {
    logDebug(`No changes needed for: ${file}`);
    stats.filesUnchanged++;
  } else {
    await writeFile(file, documentedContent, 'utf8');
    stats.filesUpdated++;
    // eslint-disable-next-line no-console
    console.log(`[${current}/${total}] ${file}`);
  }

  stats.filesProcessed++;
}

(async (): Promise<void> => {
  let files: string[];

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('[DEBUG] Starting documenter with debug mode enabled');
    // eslint-disable-next-line no-console
    console.log(`[DEBUG] Root path: ${root}`);
  }

  const rootStat = await stat(root);
  if (rootStat.isFile()) {
    files = [root];
  } else {
    files = await findTsFiles(root);
  }

  // eslint-disable-next-line no-console
  console.log(`Found ${files.length} TypeScript file(s) to process`);

  for (let i = 0; i < files.length; i++) {
    await processFile(files[i], i + 1, files.length);
  }

  // eslint-disable-next-line no-console
  console.log('\n📊 Statistics:');
  // eslint-disable-next-line no-console
  console.log(`  Files processed: ${stats.filesProcessed}`);
  // eslint-disable-next-line no-console
  console.log(`  Files updated: ${stats.filesUpdated}`);
  // eslint-disable-next-line no-console
  console.log(`  Files unchanged: ${stats.filesUnchanged}`);
})();
