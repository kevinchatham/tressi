# Project Coding Rules (Non-Obvious Only)

- Use `process.stderr.write()` for debug output instead of `console.log` - Biome linter errors on console usage
- Private class fields MUST use underscore prefix: `_fieldName` (not `#fieldName`)
- [`RequestExecutor`](projects/cli/src/http/request-executor.ts) uses object pooling - do not create new headers/result objects in hot paths
- `NODE_ENV !== 'test'` check at line 52 of `request-executor.ts` - production uses per-endpoint HTTP agents, tests use global dispatcher
- UI project copies LICENSE to `docs/06-community/02-license.md` during build - if modifying LICENSE, update both locations
