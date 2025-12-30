/**
 * Scans TypeScript files and adds/fixes JSDoc comments using a locally running
 * llama.cpp server via its OpenAI-compatible HTTP API.
 *
 * Uses ts-morph for targeted AST manipulation - processes individual elements
 * rather than entire files to avoid defects from whole-file LLM processing.
 *
 * @example
 * # Scan current directory and generate JSDocs
 * npx tsx scripts/documenter-ts-morph.ts
 *
 * @example
 * # Scan a specific directory
 * npx tsx scripts/documenter-ts-morph.ts ./src
 *
 * @example
 * # Scan and target a specific file
 * npx tsx scripts/documenter-ts-morph.ts ./src/cli.ts
 *
 * @example
 * # Run with debug mode
 * npx tsx scripts/documenter-ts-morph.ts ./src --debug
 */

import { copyFile, readdir, readFile, stat, writeFile } from 'fs/promises';
import { join, relative } from 'path';
import { JSDocableNode, Project, SourceFile } from 'ts-morph';

const root = process.argv[2] ?? '.';
const llama = 'http://desktop:8080/v1/chat/completions';
const key = '1234';
const model = 'ggml-gpt-oss-20b-mxfp4';

// Request timeout (5 minutes for large files)
const REQUEST_TIMEOUT = 300000;

// Enable verbose logging for debugging
const DEBUG = process.argv.includes('--debug') || process.argv.includes('-d');

const ignore = new Set(['node_modules', 'dist', '.git']);

// Statistics tracking
const stats = {
  filesProcessed: 0,
  filesUpdated: 0,
  filesUnchanged: 0,
  elementsUpdated: 0,
  elementsSkipped: 0,
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
/* ts-morph utilities                                  */
/* -------------------------------------------------- */

/**
 * Interface representing a documentable element in the AST.
 */
interface DocumentableElement {
  kind: string;
  name: string;
  node: JSDocableNode;
  code: string;
  hasJsDoc: boolean;
}

/**
 * Checks if an element name indicates it should be private/protected.
 * Elements starting with underscore are considered private.
 */
function isPrivateElement(name: string): boolean {
  return name.startsWith('_');
}

/**
 * Finds all documentable elements in a source file that don't have JSDoc.
 */
function findDocumentableElements(
  sourceFile: SourceFile,
): DocumentableElement[] {
  const elements: DocumentableElement[] = [];

  // Helper function to check if a node has JSDoc
  const hasJsDoc = (node: JSDocableNode): boolean => {
    return node.getJsDocs().length > 0;
  };

  // Get all functions
  const functions = sourceFile.getFunctions();
  for (const func of functions) {
    const name = func.getName();
    if (name && !isPrivateElement(name)) {
      elements.push({
        kind: 'function',
        name,
        node: func,
        code: func.getText(),
        hasJsDoc: hasJsDoc(func),
      });
    }
  }

  // Get all classes
  const classes = sourceFile.getClasses();
  for (const cls of classes) {
    const name = cls.getName();
    if (name && !isPrivateElement(name)) {
      elements.push({
        kind: 'class',
        name,
        node: cls,
        code: cls.getText(),
        hasJsDoc: hasJsDoc(cls),
      });
    }
  }

  // Get all interfaces
  const interfaces = sourceFile.getInterfaces();
  for (const iface of interfaces) {
    const name = iface.getName();
    if (name && !isPrivateElement(name)) {
      elements.push({
        kind: 'interface',
        name,
        node: iface,
        code: iface.getText(),
        hasJsDoc: hasJsDoc(iface),
      });
    }
  }

  // Get all type aliases
  const typeAliases = sourceFile.getTypeAliases();
  for (const typeAlias of typeAliases) {
    const name = typeAlias.getName();
    if (name && !isPrivateElement(name)) {
      elements.push({
        kind: 'type alias',
        name,
        node: typeAlias,
        code: typeAlias.getText(),
        hasJsDoc: hasJsDoc(typeAlias),
      });
    }
  }

  // Get all methods in classes (excluding constructors)
  for (const cls of classes) {
    const methods = cls.getMethods();
    for (const method of methods) {
      const name = method.getName();
      // Skip constructors and private members
      if (name === 'constructor' || isPrivateElement(name)) {
        continue;
      }
      elements.push({
        kind: 'method',
        name,
        node: method,
        code: method.getText(),
        hasJsDoc: hasJsDoc(method),
      });
    }

    // Get properties/signatures with type annotations
    const properties = cls.getProperties();
    for (const prop of properties) {
      const name = prop.getName();
      if (isPrivateElement(name)) {
        continue;
      }
      // Only include properties with explicit type annotations
      const type = prop.getTypeNode();
      if (type) {
        elements.push({
          kind: 'property',
          name,
          node: prop,
          code: prop.getText(),
          hasJsDoc: hasJsDoc(prop),
        });
      }
    }
  }

  // Get methods in interfaces
  for (const iface of interfaces) {
    const methods = iface.getMethods();
    for (const method of methods) {
      const name = method.getName();
      if (isPrivateElement(name)) {
        continue;
      }
      elements.push({
        kind: 'interface method',
        name,
        node: method,
        code: method.getText(),
        hasJsDoc: hasJsDoc(method),
      });
    }

    // Get properties in interfaces
    const properties = iface.getProperties();
    for (const prop of properties) {
      const name = prop.getName();
      if (isPrivateElement(name)) {
        continue;
      }
      elements.push({
        kind: 'interface property',
        name,
        node: prop,
        code: prop.getText(),
        hasJsDoc: hasJsDoc(prop),
      });
    }
  }

  return elements;
}

/* -------------------------------------------------- */
/* llama.cpp call                                      */
/* -------------------------------------------------- */

async function generateJsDoc(
  element: DocumentableElement,
  filePath: string,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
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
            content: `
You are a TypeScript documentation assistant. Add or update JSDoc comments for code elements.

Context:
- File: ${filePath}
- Element type: ${element.kind}
- Element name: ${element.name}
- Element code: ${element.code}

Rules:
- Always output valid JSDoc comment blocks using /** ... */ syntax.
- Add JSDoc comments where they are completely missing.
- Correct existing JSDoc if it is incorrect or misleading.
- JSDoc comments must contain description text only.
- Do NOT add any JSDoc tags by default.
- The ONLY allowed JSDoc tags are @example and @remarks.
- Add an @example or @remarks tag ONLY when the behavior of the code is not obvious
  from the name, signature, or types.
- Do NOT add @example or @remarks for simple data structures, enums, or straightforward
  getters/setters.
- Remove any existing JSDoc tags other than @example or @remarks.
- Wrap description lines if they exceed approximately 80 characters.
- NEVER add JSDoc comments to constructor methods.
- If constructor methods have JSDoc comments, remove them.
- Constructors are methods named "constructor" inside classes.
- Do NOT add, remove, or modify any non-JSDoc code.
- Preserve all existing code exactly.
- The output MUST be valid JSDoc comment text only.
- If no JSDoc is needed, return "SKIP".
- Output ONLY the JSDoc comment text or "SKIP".
- Do NOT include explanations, markdown, or code fences.
- Do NOT include the element code in your response.
`,
          },
          {
            role: 'user',
            content: `Generate JSDoc for this ${element.kind} named "${element.name}":\n\n${element.code}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`API request failed: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    const result = json.choices[0].message.content.trim();

    // Check if we should skip
    if (result === 'SKIP') {
      return 'SKIP';
    }

    // Remove markdown code block wrapper if present
    const codeMatch = result.match(/```(?:typescript|ts)?\n?([\s\S]*?)\n?```$/);
    const cleanedResult = codeMatch ? codeMatch[1] : result;

    // Ensure it starts with /** and ends with */
    const jsDoc = cleanedResult.trim();
    if (!jsDoc.startsWith('/**')) {
      return `/** ${jsDoc} */`;
    }

    return jsDoc;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT}ms`);
    }
    throw error;
  }
}

/* -------------------------------------------------- */
/* validation                                          */
/* -------------------------------------------------- */

/**
 * Validates that only JSDoc comments were added by comparing AST structure.
 * Returns true if only JSDoc nodes were added/modified.
 */
function validateOnlyJsDocChanged(
  originalContent: string,
  newContent: string,
): boolean {
  // Basic validation: check that non-JSDoc code hasn't changed
  // Remove all JSDoc comments from both and compare
  const removeJsDocs = (content: string): string => {
    return content.replace(/\/\*\*[\s\S]*?\*\//g, '').trim();
  };

  const originalNoJsDoc = removeJsDocs(originalContent);
  const newNoJsDoc = removeJsDocs(newContent);

  return originalNoJsDoc === newNoJsDoc;
}

/* -------------------------------------------------- */
/* main logic                                          */
/* -------------------------------------------------- */

async function processFile(
  file: string,
  current: number,
  total: number,
): Promise<void> {
  logDebug(`Processing file: ${file}`);

  // Create backup
  const backupPath = `${file}.backup`;
  await copyFile(file, backupPath);

  // Read original content
  const originalContent = await readFile(file, 'utf8');

  // Create ts-morph project and add source file
  const project = new Project({
    useInMemoryFileSystem: true,
  });

  const sourceFile = project.createSourceFile(file, originalContent);

  // Find documentable elements without JSDoc
  const elements = findDocumentableElements(sourceFile);
  const elementsNeedingJsDoc = elements.filter((el) => !el.hasJsDoc);

  if (elementsNeedingJsDoc.length === 0) {
    logDebug(`No elements need JSDoc in: ${file}`);
    stats.filesUnchanged++;
    stats.filesProcessed++;
    return;
  }

  logDebug(
    `Found ${elementsNeedingJsDoc.length} elements needing JSDoc in: ${file}`,
  );

  let elementsUpdated = 0;
  let elementsSkipped = 0;

  // Process each element
  for (const element of elementsNeedingJsDoc) {
    try {
      const jsDocText = await generateJsDoc(element, relative(root, file));

      if (jsDocText === 'SKIP') {
        elementsSkipped++;
        continue;
      }

      // Add JSDoc using ts-morph
      element.node.addJsDoc(jsDocText);
      elementsUpdated++;
      logDebug(`Added JSDoc to ${element.kind} "${element.name}"`);
    } catch (error) {
      logDebug(`Error processing ${element.kind} "${element.name}":`, error);
      elementsSkipped++;
    }
  }

  // Check if any changes were made
  const newContent = sourceFile.getFullText();

  if (newContent === originalContent) {
    logDebug(`No changes made to: ${file}`);
    stats.filesUnchanged++;
  } else {
    // Validate that only JSDoc was added
    if (!validateOnlyJsDocChanged(originalContent, newContent)) {
      // eslint-disable-next-line no-console
      console.error(
        `❌ Validation failed - non-JSDoc code changed, restoring backup: ${file}`,
      );
      await writeFile(file, originalContent, 'utf8');
      stats.filesUnchanged++;
    } else {
      // Save the modified file
      await sourceFile.save();
      stats.filesUpdated++;
      stats.elementsUpdated += elementsUpdated;
      // eslint-disable-next-line no-console
      console.log(
        `[${current}/${total}] ${file} (${elementsUpdated} JSDoc added, ${elementsSkipped} skipped)`,
      );
    }
  }

  stats.filesProcessed++;
}

async function main(): Promise<void> {
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
  // eslint-disable-next-line no-console
  console.log(`  Elements updated: ${stats.elementsUpdated}`);
  // eslint-disable-next-line no-console
  console.log(`  Elements skipped: ${stats.elementsSkipped}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error:', error);
  process.exit(1);
});
