<p align="center">
  <img src="https://github.com/kevinchatham/tressi/blob/main/images/tressi-logo.png?raw=true" alt="tressi-logo" width="150px" height="150px"/>
  <br/>
  <em>Stress less, test more.</em>
  <br/><br/>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-MIT%20%2B%20Commons%20Clause-orange" alt="Source Available"/>
  </a>
</p>

> **TL;DR**
>
> ```bash
> npx tressi serve
> ```

![./images/0.0.13-test-details.png](https://github.com/kevinchatham/tressi/blob/main/images/0.0.13-test-details.png?raw=true)

`tressi` is a **modern load testing tool** that brings professional API analysis to your workspace. It combines a **multithreaded execution engine** with a beautiful web interface, providing the power of **parallel execution** through both an interactive dashboard and a **headless CLI**.

## ⚡ Get Started

To run `tressi`, you need **[Node.js 20 LTS or higher](https://nodejs.org/en/download)** installed on one of the following supported operating systems:

- **MacOS**
- **Windows** (x64 only, ARM not supported)
- **Linux** (x64 and ARM)

### Installation

You can run `tressi` instantly without installation using `npx`:

```bash
npx tressi@latest serve
```

Or install it globally to use the `tressi` command anywhere:

```bash
npm install -g tressi
tressi serve
```

### Docker

You can also run `tressi` using Docker. This is recommended if you don't want to install Node.js locally.

#### Using Docker Run

To persist your data, mount a volume to `/home/node/.tressi`:

```bash
docker run -p 3108:3108 -v tressi-data:/home/node/.tressi ghcr.io/kevinchatham/tressi serve
```

#### Using Docker Compose

Create a `docker-compose.yml` file:

```yaml
services:
  tressi:
    image: ghcr.io/kevinchatham/tressi:latest
    ports:
      - '3108:3108'
    volumes:
      - tressi-data:/home/node/.tressi
volumes:
  tressi-data:
```

Then run:

```bash
docker compose up -d
```

## 📖 Documentation

For detailed guides, configuration references, and advanced usage, please explore the [docs/](./docs/) directory.
