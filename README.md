<p align="center">
  <img src="artifacts/livesafe/public/favicon.svg" width="88" alt="LiveSafe logo" />
</p>

<h1 align="center">LiveSafe AI</h1>

<p align="center">
  A real-data public safety dashboard for mapping crime risk, emergency SOS response, and transparent NCRB-based forecasting across India.
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=0B1020" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-ready-3ECF8E?style=for-the-badge&logo=supabase&logoColor=0B1020" />
  <img alt="NCRB data" src="https://img.shields.io/badge/NCRB-2010--2024-0EA5E9?style=for-the-badge" />
</p>

<p align="center">
  <a href="#why-livesafe">Why</a>
  |
  <a href="#features">Features</a>
  |
  <a href="#quick-start">Quick Start</a>
  |
  <a href="#data-and-model">Data</a>
  |
  <a href="#project-map">Project Map</a>
</p>

---

## Why LiveSafe

LiveSafe AI turns public safety data into an operational interface: citizens can report incidents and trigger SOS alerts, police teams can monitor response workflows, and administrators can inspect hotspot and model performance without hiding the uncertainty in the data.

The hotspot layer is built from real National Crime Records Bureau district-year data instead of fabricated demo values. The app currently ships with 445 real geocoded districts, Census-backed population fields where available, and a reproducible ML pipeline that reports both model performance and the naive baseline it is measured against.

## Product Snapshot

| Area | What it does |
| --- | --- |
| Hotspot map | Leaflet map of Indian districts with risk bands, safety warnings, trend labels, and nearest-zone location support. |
| SOS response | Citizen SOS flow with live location updates, police acknowledgement, resolution status, and navigation handoff. |
| Incident reporting | Structured reports with severity, coordinates, evidence fields, and lifecycle states. |
| Dashboards | Recharts views for public safety trends, incident mix, response statistics, and model health. |
| Access control | Citizen, police, admin, and super-admin roles with scoped screens and actions. |
| Real-data pipeline | Python pipeline for NCRB normalization, geocoding, feature engineering, model training, and hotspot export. |

## Features

- Real NCRB district-year hotspot data for 2010 to 2024.
- 445 mapped districts with real coordinates from an open geodata source.
- Risk bands: low, medium, high, and critical.
- Express API with Drizzle ORM and PostgreSQL/Supabase support.
- Vite frontend with React, TypeScript, Tailwind CSS, shadcn/ui patterns, Leaflet, and Recharts.
- Local mock mode for running the frontend without a database.
- Supabase browser client helper and environment examples.
- Reproducible ML scripts under `ml-pipeline/`.

## Tech Stack

| Layer | Tools |
| --- | --- |
| Frontend | React 19, Vite 7, TypeScript, Tailwind CSS, Radix UI, Leaflet, Recharts |
| Backend | Node.js, Express 5, Zod, Pino |
| Database | PostgreSQL, Supabase, Drizzle ORM |
| ML pipeline | Python, pandas, NumPy, scikit-learn |
| Workspace | pnpm monorepo |

## Quick Start

### Prerequisites

- Node.js 22 or newer
- pnpm 10 or newer
- PostgreSQL or Supabase for full backend mode

### Install

```powershell
cd "C:\path\to\LiveSafe"
pnpm install
```

### Run Frontend Only

Use mock mode when you want the UI, real bundled hotspot data, and demo workflows without a database.

```powershell
$env:VITE_USE_MOCK="true"
$env:PORT="5173"
pnpm --filter @workspace/livesafe run dev
```

Open `http://localhost:5173`.

### Run With API And Database

Create `artifacts/api-server/.env`:

```env
PORT=3000
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://postgres.project-ref:YOUR_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.project-ref:YOUR_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-secret-key
SUPABASE_JWKS_URL=https://your-project.supabase.co/auth/v1/.well-known/jwks.json
```

Create `artifacts/livesafe/.env.local`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_API_PROXY_TARGET=http://localhost:3000
VITE_USE_MOCK=false
PORT=5173
BASE_PATH=/
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Push the database schema:

```powershell
$env:DATABASE_URL="postgresql://postgres.project-ref:YOUR_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
pnpm --filter @workspace/db run push
```

Seed hotspots after schema setup:

```powershell
$env:DATABASE_URL="postgresql://postgres.project-ref:YOUR_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
pnpm --filter @workspace/scripts run seed-hotspots
```

Start the API:

```powershell
pnpm --filter @workspace/api-server run dev
```

Start the frontend in another shell:

```powershell
pnpm --filter @workspace/livesafe run dev
```

## Data And Model

The ML layer is intentionally transparent. Earlier demo claims were removed and replaced with a reproducible pipeline built from NCRB district-year CSVs.

| Metric | Result |
| --- | --- |
| Model | GradientBoostingRegressor |
| Holdout window | 2023 to 2024 |
| Holdout R2 | 0.886 |
| Naive persistence R2 | 0.929 |
| Risk-class accuracy | 77.7% |
| Naive persistence accuracy | 82.5% |
| Geocoded districts | 445 of 1,326 reported districts |
| Critical districts | 40 |

The model is useful as a transparent forecasting experiment, but it does not decisively beat a simple "next year equals this year" baseline. That finding is reported in the product and docs because district-level severity is highly persistent year over year.

Read the full methodology in [`ml-pipeline/README.md`](./ml-pipeline/README.md).

## Project Map

```text
LiveSafe
|-- artifacts
|   |-- livesafe              React + Vite frontend
|   |   |-- src
|   |   |   |-- app            hooks and API service
|   |   |   |-- components     UI, dashboards, map components
|   |   |   |-- pages          route-level screens
|   |   |   |-- types          shared frontend types
|   |   |   `-- utils          Supabase client helpers
|   |   `-- public            static assets and hotspot JSON
|   `-- api-server            Express API
|       `-- src
|           |-- routes         auth, incidents, SOS, hotspots, ML
|           |-- lib            auth, logger, seed helpers
|           `-- middlewares
|-- lib
|   |-- db                    Drizzle schema and database client
|   |-- api-spec              OpenAPI specification
|   |-- api-zod               runtime validation schemas
|   `-- api-client-react      generated API client
|-- ml-pipeline               NCRB processing and model training
`-- scripts                   seed and workspace utilities
```

## API Surface

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Server health check |
| `POST` | `/api/auth/register` | Create a user |
| `POST` | `/api/auth/login` | Start a session |
| `GET` | `/api/auth/me` | Read current user |
| `GET` | `/api/hotspots` | Read hotspot data |
| `POST` | `/api/sos` | Trigger SOS alert |
| `GET` | `/api/sos` | List SOS alerts |
| `POST` | `/api/sos/:id/acknowledge` | Acknowledge an alert |
| `POST` | `/api/sos/:id/resolve` | Resolve an alert |
| `POST` | `/api/incidents` | Report an incident |
| `GET` | `/api/incidents` | List incidents |
| `GET` | `/api/dashboard/stats` | Dashboard metrics |
| `GET` | `/api/ml/metrics` | Model metrics |

## Useful Commands

```powershell
pnpm run typecheck
pnpm --filter @workspace/livesafe run typecheck
pnpm --filter @workspace/livesafe run build
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/db run push
pnpm --filter @workspace/scripts run seed-hotspots
```

## Security Notes

- Keep `.env` and `.env.local` out of git.
- Never commit Supabase secret keys or database passwords.
- Use the publishable Supabase key in the browser only.
- Use the database password only for server-side API, schema, and seed commands.

## Acknowledgements

- National Crime Records Bureau for the source crime data.
- OpenStreetMap and CARTO for map tiles.
- Vynex Indian cities geodata for open coordinate matching.
- Census of India 2011 for population references.
- scikit-learn, pandas, Drizzle, Supabase, React, and Vite.

---

<p align="center">
  <strong>LiveSafe AI</strong><br />
  Built for clearer public safety decisions, with real data and honest uncertainty.
</p>
