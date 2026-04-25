# LiveSafe

LiveSafe is a PNPM monorepo for a crime-safety web app with:

- a React + Vite frontend in `artifacts/livesafe`
- a Node/Express API server in `artifacts/api-server`
- shared packages in `lib/*`

The current frontend is able to run even when the API server is missing:

- hotspots can load from Supabase or the generated local hotspot JSON
- reports, ML metrics, prediction, and SOS screens fall back to local/demo behavior when `/api` is unavailable

## Current data/model state

- The hotspot map is wired to the v5 NCRB-based model output.
- The generated hotspot file lives at `artifacts/livesafe/public/india_hotspots_v5.json`.
- The current retrained dataset used in the app is based on the published NCRB `2020-2023` window.
- If Supabase `hotspots` has fewer than `100` rows, the frontend falls back to the local generated hotspot file instead of trusting incomplete remote data.

## Monorepo layout

- `artifacts/livesafe` - frontend app
- `artifacts/api-server` - Express backend
- `lib/api-client-react` - shared frontend API helpers
- `lib/api-spec` / `lib/api-zod` - shared contracts
- `lib/db` - DB schema utilities

## Prerequisites

- Node.js 22+
- PNPM 10+

## Install

```bash
pnpm install
```

## Frontend environment

The Vite config requires these environment variables:

- `PORT`
- `BASE_PATH`

The frontend also supports:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_USE_MOCK`

`VITE_USE_MOCK` behavior:

- `true` -> always use local/demo data
- `false` -> prefer real services, but still fall back locally when the backend returns HTML / non-JSON / unavailable responses
- unset -> auto mode based on whether Supabase is configured

## Run the frontend

### Windows PowerShell

```powershell
$env:PORT='5173'
$env:BASE_PATH='/'
pnpm --filter @workspace/livesafe dev
```

### cmd.exe

```bat
set PORT=5173
set BASE_PATH=/
pnpm --filter @workspace/livesafe dev
```

Then open:

- `http://localhost:5173/`
- `http://localhost:5173/map`
- `http://localhost:5173/ml`

## Run the API server

```bash
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/api-server start
```

Note: the current `dev` script in `artifacts/api-server/package.json` uses shell syntax that is Unix-oriented. On Windows, `build` + `start` is the safer path unless you replace that script.

## Build

The frontend build also requires `PORT` and `BASE_PATH`.

### Windows PowerShell

```powershell
$env:PORT='5173'
$env:BASE_PATH='/'
pnpm --filter @workspace/livesafe build
```

### Full workspace build

```bash
pnpm run build
```

## Typecheck

```bash
pnpm run typecheck
```

## What works without the backend

If `/api` is not running, the frontend now degrades gracefully for:

- hotspot map
- reports and analytics summaries
- ML dashboard metrics
- prediction models
- SOS pages

This lets the UI remain usable for local review and demos while the backend is offline.

## Notes for Supabase

- Supabase is currently used directly by the frontend for some reads.
- The `hotspots` table may contain incomplete data unless it has been fully populated.
- Anonymous-key writes may be blocked by row-level security, so uploading retrained hotspot rows usually requires a proper backend/admin path.

## Useful commands

- frontend dev: `pnpm --filter @workspace/livesafe dev`
- frontend build: `pnpm --filter @workspace/livesafe build`
- backend build: `pnpm --filter @workspace/api-server build`
- backend start: `pnpm --filter @workspace/api-server start`
- workspace typecheck: `pnpm run typecheck`
- workspace build: `pnpm run build`
