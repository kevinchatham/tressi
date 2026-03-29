# Project Documentation Rules (Non-Obvious Only)

- Documentation style guide in [`docs/style-guide.md`](docs/style-guide.md) - avoid subjective adjectives, use developer-centric vocabulary
- `projects/shared/src/` exports three packages: `cli`, `common`, `ui` via TypeScript path aliases
- Server routes are Hono-based with middleware in `src/server/middleware/` (not Express)
- UI project is Angular-based with signals, located in `projects/ui/`
- Coverage thresholds are 80% for branches, functions, lines, statements in [`vitest.config.ts`](projects/cli/vitest.config.ts:17)
