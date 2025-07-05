# ⚡ Tressi

> Stress less, test more.

`tressi` is a **lightweight, declarative load testing tool** built for modern developers. Define your HTTP workflows in a simple config file and unleash them with blazing concurrency, live terminal metrics, and full CSV exports. Use it as a CLI or embed it into your own tooling.

## 🚀 Features

- 📝 **Declarative Config** — Define tests in TypeScript or JSON with full type safety.
- 👥 **Concurrent Workers** — Simulate realistic multi-user load with ease.
- ⏱️ **Rate Limiting** — Control RPS for accurate throttling scenarios.
- 📊 **Interactive Terminal UI** — View live RPS, latency stats, and status codes.
- 📁 **CSV Export** — Export all results for offline analysis.
- 🧩 **Programmatic API** — Import and use in your own scripts.

## 📦 Installation

You can install and use `tressi` in three different ways:

### 1. As a Package (for local development or programmatic use)

```bash
npm install tressi
```

### 2. As a CLI Tool (without installing)

Run directly using `npx`:

```bash
npx tressi init
```

### 3. Global Installation (for CLI use everywhere)

Install globally to run `tressi` from anywhere:

```bash
npm install -g tressi
```

## 🛠️ Usage

`tressi` can be run directly from the command line **or** used as a library in your own app.

### 🧪 CLI: Quick Start

1. **Generate a config file**

```bash
npx tressi init
```

2. **Edit your config (TypeScript example)**

```ts
import { defineConfig } from 'tressi';

export default defineConfig({
  headers: {
    'Content-Type': 'application/json',
    'X-Powered-By': 'tressi',
  },
  requests: [
    { url: 'https://jsonplaceholder.typicode.com/posts/1', method: 'GET' },
    {
      url: 'https://jsonplaceholder.typicode.com/posts',
      method: 'POST',
      payload: {
        title: 'tressi_test',
        body: 'This is a test post from tressi.',
        userId: 1,
      },
    },
  ],
});
```

Or use `.json` instead for maximum portability:

```json
{
  "headers": {
    "Content-Type": "application/json",
    "X-Powered-By": "tressi"
  },
  "requests": [
    { "url": "https://jsonplaceholder.typicode.com/posts/1", "method": "GET" },
    {
      "url": "https://jsonplaceholder.typicode.com/posts",
      "method": "POST",
      "payload": {
        "title": "tressi_test",
        "body": "This is a test post from tressi.",
        "userId": 1
      }
    }
  ]
}
```

3. **Run the test**

```bash
npx tressi --config tressi.config.ts --concurrency 10 --duration 30
```

### 📚 CLI Commands

| Command | Description                       |
| ------- | --------------------------------- |
| `init`  | Create a new `tressi` config file |

### ⚙️ CLI Options

| Option               | Alias  | Description                                         | Default |
| -------------------- | ------ | --------------------------------------------------- | ------- |
| `--config <path>`    | `-c`   | Path or URL to config file (.ts or .json)           |         |
| `--concurrency <n>`  |        | Number of concurrent workers                        | `10`    |
| `--duration s`       |        | Duration of the test in seconds                     | `10`    |
| `--rps <n>`          |        | Target requests per second (ramps up to this value) |         |
| `--ramp-up-time <s>` | `-rut` | Time in seconds to ramp up to the target RPS        |         |
| `--csv <path>`       |        | Save results as CSV                                 |         |
| `--no-ui`            |        | Disable the interactive terminal UI                 | `false` |

### 🧬 Programmatic Usage

```ts
import { runLoadTest } from 'tressi';

await runLoadTest({
  config: {
    requests: [{ url: 'https://api.example.com/health', method: 'GET' }],
  },
  concurrency: 5,
  durationSec: 10,
  rps: 100, // Target 100 requests/second
  rampUpTimeSec: 10, // Ramp up to 100 RPS over 10 seconds
  useUI: false,
});
```

## ⚙️ Configuration Reference

Your `
