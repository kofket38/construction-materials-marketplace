# Construction Materials Marketplace Frontend

React frontend for the Construction Materials Marketplace API.

## Requirements

- Node.js 24 or newer
- npm 11 or newer
- Backend API available at `http://localhost:3000` by default

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
| `VITE_API_BASE_URL` | Existing backend API base URL | `http://localhost:3000/api` |
| `VITE_API_TIMEOUT_MS` | HTTP request timeout in milliseconds | `15000` |

## Verification

```powershell
npm run typecheck
npm run lint
npm run build
```
