# Project Architecture Rules (Non-Obvious Only)

- Worker threads use `SharedArrayBuffer` for zero-copy metrics aggregation (see `src/workers/shared-memory/`)
- [`RequestExecutor`](projects/cli/src/http/request-executor.ts) uses object pooling for headers/result objects to reduce GC pressure in high-throughput scenarios
- Per-endpoint HTTP agents in production (`NODE_ENV !== 'test'`) vs global dispatcher in tests - architectural choice for performance isolation
- Server routes are Hono-based with middleware in `src/server/middleware/` - not Express-based
- UI project copies LICENSE to `docs/06-community/02-license.md` during build - must maintain both copies
- Test files use separate `tsconfig.tests.json` which disables `noUnusedLocals` and `noUnusedParameters` (production builds enforce strict unused checks)
