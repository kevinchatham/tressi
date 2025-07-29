This file tracks potential new features and improvements for `tressi`

## Future Features

- [ ] **Request Scenarios**: Allow users to define an ordered sequence of requests to simulate realistic user journeys. This could include passing data from one response to subsequent requests (e.g., auth tokens).

- [ ] **Dynamic Payloads**: Integrate a library like `Faker.js` to allow for the generation of dynamic data (e.g., random usernames, emails) in request payloads.

- [ ] **Response Assertions**: Allow users to define custom assertions on responses, such as checking for specific body content or headers, to provide a more accurate measure of success.

- [ ] **HTML Reports**: Add a feature to generate a standalone HTML report with interactive charts and a detailed breakdown of test results.

- [ ] **Load Ramping**: Implement a "ramp-up" period where the number of concurrent workers gradually increases over time to better identify performance degradation points.

- [x] **`init` Command**: Create a new CLI command (`npx tressi init`) to generate a boilerplate `tressi.config.ts` file in the user's current directory, improving the initial setup experience.

## Performance

## 🔍 High-Impact Areas to Improve

### 1. **Avoid per-request `Date.now()`**

Your code does this on every request:

```ts
const start = Date.now();
// ...
const latencyMs = Math.max(0, Date.now() - start);
```

📉 `Date.now()` is relatively expensive under heavy load.

✅ Replace with:

```ts
const start = performance.now();
```

✅ Use [`perf_hooks`](https://nodejs.org/api/perf_hooks.html) for microsecond-level timing:

```ts
import { performance } from 'perf_hooks';
```

> You'll get better latency resolution and less GC pressure.

---

### 2. **Avoid JSON.stringify for undefined payloads**

You're doing this:

```ts
body: req.payload ? JSON.stringify(req.payload) : undefined,
```

✅ Better:

```ts
body: req.payload === undefined ? undefined : JSON.stringify(req.payload);
```

Why? Because `JSON.stringify(undefined)` returns `undefined`, but checking explicitly avoids extra call overhead.

---

### 3. **Minimize object allocations inside `runWorker`**

Every loop creates:

- Headers object: `{ ...this.headers, ...req.headers }`
- A new result object
- A new latency Set/map entry

✅ Pre-allocate where possible or reuse:

- Use a **shared `Headers` instance** if static
- Cache endpoint histogram maps/sets outside the loop
- Avoid repeatedly creating identical `endpointKey` strings — use a string cache or interned lookup if you’re testing few URLs

---

### 4. **Throttle or remove `sampledEndpointResponses` logic**

You're doing this logic:

```ts
if (!sampledCodesForEndpoint.has(res.status)) {
  body = await res.text();
  sampledCodesForEndpoint.add(res.status);
} else {
  await res.text().catch(() => {});
}
```

📉 This check and storage can create bottlenecks under thousands of URLs or status codes.

✅ Option: Make this sampling optional (`--sample-bodies` flag), or limit to `N endpoints` total with a fast-path guard.

---

### 5. **Use Agent reuse for HTTP**

Currently you're using `fetch`, which by default opens a **new TCP connection per request**.

📉 This destroys performance under load.

✅ Use `undici` or Node’s native `http.Agent` for persistent connections:

```ts
import { fetch, Agent } from 'undici';

const agent = new Agent({
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 30_000,
});

const res = await fetch(req.url, {
  method: req.method,
  headers,
  body,
  dispatcher: agent,
});
```

This alone can **5x–10x your throughput**.

---

### 6. **Avoid `Array.prototype.push()` in tight loops**

e.g., in:

```ts
this.recentLatenciesForSpinner.push(result.latencyMs);
```

📉 Push with bounds checks adds GC pressure.

✅ Use a `CircularBuffer` (which you already have for timestamps) for all bounded history tracking.

---

### 7. **Avoid setInterval/setTimeout if ramp-up is disabled**

You're always setting:

```ts
this.rampUpInterval = setInterval(...);
```

✅ Skip that entirely if `rampUpTimeSec === 0`.

Even an idle `setInterval` adds a timer check to every loop of the event loop.

---

## 🧪 Optional: Advanced Optimizations

| Optimization                              | Benefit                                 |
| ----------------------------------------- | --------------------------------------- |
| Reuse precompiled headers                 | Avoids cloning object per req           |
| Switch from `fetch` to raw `http.request` | Lower-level control, less overhead      |
| Consider using `undici`'s `Pool`          | Efficient connection reuse across hosts |
| Preallocate result objects                | Reduce GC churn                         |
| Move histogram updates to async queue     | Reduces blocking in the hot path        |

---

## ✅ TL;DR: Top 5 Easy Wins

1. **Use `performance.now()`** instead of `Date.now()`
2. **Switch from `fetch` to `undici`** for persistent connections
3. **Avoid dynamic object spreads** (`{ ...headers }`) in tight loops
4. **Skip `sampledEndpointResponses` unless explicitly enabled**
5. **Disable unused timers (`rampUpInterval`, etc.) early**
