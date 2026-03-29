# Project Debug Rules (Non-Obvious Only)

- Worker thread logs go to stderr with prefix format: `Worker ${id} error: ${message}` or `Worker ${id} exited with code ${code}`
- Worker completion timeout warning at 5 seconds: `Warning: Worker ${i} failed to reach ready state`
- Use `process.stderr.write()` for debug output - `console.log` triggers Biome linter error
- `NODE_ENV !== 'test'` check at line 52 of `request-executor.ts` affects HTTP agent selection - tests skip per-endpoint agent setup
- Worker pool uses SharedArrayBuffer for inter-thread communication - state changes visible via shared memory, not console
