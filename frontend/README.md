# Construction Materials Marketplace Frontend

React frontend for the Construction Materials Marketplace API.

## Requirements

- Node.js 24 or newer
- npm 11 or newer
- Backend API running (default development URL: `http://localhost:3055`)

## Setup

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

The browser application runs at `http://localhost:5173`.

## Environment

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Backend API base URL including `/api` path | `http://localhost:3055/api` |
| `VITE_API_TIMEOUT_MS` | HTTP request timeout in milliseconds | `15000` |

> **Important:** `VITE_API_BASE_URL` is baked into the frontend bundle at
> build time by Vite. It is **not** read at runtime. You must set it to the
> correct value **before** running `npm run build`. If the variable is not
> set, the build uses the default `http://localhost:3055/api`, which will
> not work in production.

## Development

```bash
npm run dev
```

Starts the Vite development server with hot module replacement at
`http://localhost:5173`.

## Production Build

```bash
# Set the production API URL before building
VITE_API_BASE_URL=https://api.your-domain.com/api npm run build
```

On Windows (PowerShell):

```powershell
$env:VITE_API_BASE_URL = "https://api.your-domain.com/api"
npm run build
```

Or set `VITE_API_BASE_URL` in your `.env` file before running `npm run build`.

The production bundle is written to `dist/`. Serve the contents of `dist/`
from any static file host, CDN, or reverse proxy (Nginx, Caddy, etc.).

## Local Production Build Verification

To verify the production build locally before deploying:

```bash
npm run preview
```

This serves the `dist/` directory at `http://localhost:4173`. It is a
quick sanity check only — it does not replicate your production environment.

## Verification

```powershell
npm run typecheck
npm run lint
npm run build
```
