# Quickstart

Get Tressi up and running in less than 5 minutes.

## 1. Install Tressi

```bash
npm install -g @tressi/cli
```

## 2. Create a simple config

Create a file named `tressi.json`:

```json
{
  "requests": [
    {
      "url": "https://api.example.com/health",
      "method": "GET",
      "rps": 10
    }
  ],
  "options": {
    "durationSec": 30
  }
}
```

## 3. Run the test

```bash
tressi run tressi.json
```

## 4. View results

Open the dashboard at `http://localhost:3000` to see real-time metrics.
