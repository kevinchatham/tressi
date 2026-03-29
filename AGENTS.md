# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Build/Test Commands

- Run single CLI test: `cd projects/cli && npx vitest run src/core/test-executor.spec.ts`
- E2E single test: `cd projects/e2e && npx playwright test tests/cli.spec.ts`
- Lint/format check: `npm run check` (runs Biome + Prettier)
- `npm run cli:serve` uses nodemon for hot-reload (not `npm run start`)
- Coverage thresholds are 80% for branches, functions, lines, statements in [`vitest.config.ts`](projects/cli/vitest.config.ts:17)

## Code Style

- Biome linter enforces `noConsole: "error"` - use `process.stderr.write()` for debug output instead of `console.log`
- Private class fields use underscore prefix: `_fieldName`
- Import order: external packages → `@tressi/shared/*` → relative paths
- TypeScript `strict: true` with `noUnusedLocals: true` and `noUnusedParameters: true` in production builds
- Tests use separate [`tsconfig.tests.json`](projects/cli/tsconfig.tests.json:8) which disables `noUnusedLocals` and `noUnusedParameters`

## Architecture Patterns

- Worker threads use `SharedArrayBuffer` for zero-copy metrics aggregation (see `src/workers/shared-memory/`)
- [`RequestExecutor`](projects/cli/src/http/request-executor.ts) uses object pooling for headers/result objects to reduce GC pressure
- `NODE_ENV !== 'test'` check at line 52 of `request-executor.ts` - production uses per-endpoint HTTP agents, tests use global dispatcher
- Server routes are Hono-based with middleware in `src/server/middleware/`

## Project Structure

- `projects/shared/src/` exports: `cli`, `common`, `ui` (see `exports` in `package.json`)
- TypeScript path aliases: `@tressi/shared/cli`, `@tressi/shared/common`, `@tressi/shared/ui`
- UI project copies LICENSE to `docs/06-community/02-license.md` during build (`package.json` line 20)

## Documentation Style

- Avoid subjective adjectives ("modern", "powerful", "easy")
- Use developer-centric vocabulary (industry standard terms preferred)
- Headings should be functional, not abstract marketing terms
