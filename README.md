# Tressi

`tressi` is a lightweight, easy-to-use load testing tool for your APIs. It allows you to define a series of HTTP requests in a configuration file and run them concurrently to simulate load, providing you with key performance metrics.

## Features

- **Declarative Configuration**: Define your tests in a simple TypeScript or JSON file.
- **Concurrent Workers**: Simulate multiple users making requests simultaneously.
- **Rate Limiting**: Control the request rate (RPM) to test different load scenarios.
- **Interactive UI**: A terminal-based dashboard shows live metrics for latency and status codes.
- **CSV Export**: Save detailed test results to a CSV file for further analysis.
- **Programmatic API**: Integrate `tressi` into your own scripts and applications.

## Installation

To use `tressi` in your project, you can install it via npm:

```bash
npm install tressi
```

Or, if you want to use it as a standalone CLI tool, you can clone this repository:

```bash
git clone https://github.com/kevinchatham/tressi.git
cd tressi
npm install
npm run build
```

You can then run the CLI from the project root.

## Usage

`tressi` can be used both as a command-line tool and as a library in your own code.

### As a CLI

1.  **Initialize a config file**

    The easiest way to get started is by running the `init` command. This will generate a boilerplate `tressi.config.ts` or `tressi.config.json` in your current directory.

    ```bash
    npx tressi init
    ```

    It will prompt you to choose between TypeScript and JSON formats.

2.  **Customize your config file**

    Once generated, you can customize the configuration file for your specific needs. The `defineConfig` function provides type-safety and autocompletion for TypeScript files.

    ```typescript
    import { defineConfig } from 'tressi';

    export default defineConfig({
      headers: {
        'Content-Type': 'application/json',
        'X-Powered-By': 'tressi',
      },
      requests: [
        {
          url: 'https://jsonplaceholder.typicode.com/posts/1',
          method: 'GET',
        },
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

    Alternatively, you can use a standard JSON file (e.g., `tressi.config.json`). This is useful for environments where you can't execute TypeScript.

    ```json
    {
      "headers": {
        "Content-Type": "application/json",
        "X-Powered-By": "tressi"
      },
      "requests": [
        {
          "url": "https://jsonplaceholder.typicode.com/posts/1",
          "method": "GET"
        },
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

3.  **Run the test**

    Execute the `tressi` CLI, pointing to your configuration file.

    ```bash
    npx tressi --config tressi.config.ts --concurrency 10 --duration 30
    ```

### CLI Commands

| Command | Description                                      |
| ------- | ------------------------------------------------ |
| `init`  | Creates a boilerplate tressi configuration file. |

### CLI Options

| Option              | Alias | Description                               | Default |
| ------------------- | ----- | ----------------------------------------- | ------- |
| `--config <path>`   | `-c`  | Path or URL to config file (.ts or .json) |         |
| `--concurrency <n>` |       | Number of concurrent workers              | `10`    |
| `--duration <s>`    |       | Duration of the test in seconds           | `10`    |
| `--rpm <n>`         |       | Requests per minute limit for all workers |         |
| `--csv <path>`      |       | Path to save results in a CSV file        |         |
| `--no-ui`           |       | Disable the interactive terminal UI       | `false` |

### As a Library

You can also use `tressi` programmatically within your own TypeScript or JavaScript projects.

```typescript
import { runLoadTest } from 'tressi';

async function main() {
  try {
    await runLoadTest({
      config: {
        requests: [{ url: 'https://api.example.com/health', method: 'GET' }],
      },
      concurrency: 5,
      durationSec: 10,
      useUI: false, // Disable UI for non-interactive environments
    });
    console.log('Load test completed successfully.');
  } catch (err) {
    console.error('Load test failed:', err);
  }
}

main();
```

## Configuration

The `tressi.config.ts` (or `.json`) file is the heart of your load test.

- **`headers`** (optional): A record of HTTP headers to be sent with every request.
- **`requests`**: An array of request objects to be executed by the workers. Each worker will randomly pick a request from this array for each iteration.

Each request object has the following properties:

- **`url`**: The URL to send the request to.
- **`method`**: The HTTP method (e.g., `GET`, `POST`, `PUT`).
- **`payload`** (optional): The body of the request, which will be JSON-stringified.

### Loading from a URL

In addition to local files, `tressi` can fetch a JSON configuration from a remote URL. This is useful for centralizing test configurations or running tests in CI/CD pipelines without including the config file in your repository.

```bash
npx tressi --config https://example.com/my-test-config.json
```

## Development

To contribute to `tressi`, clone the repository and install the dependencies:

```bash
git clone https://github.com/kevinchatham/tressi.git
cd tressi
npm install
```

### Important Scripts

- `npm run dev`: Run the CLI in development mode with `tsx`.
- `npm run build`: Build the project with `tsup`.
- `npm run lint`: Lint and fix the codebase with ESLint.
  -- `npm run format`: Format the code with Prettier.

## License

`tressi` is licensed under the [MIT License](LICENSE).
