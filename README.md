# LiveSafe

LiveSafe is a public-safety web app for India. It shows crime-risk hotspots built from National Crime Records Bureau (NCRB) district data, lets citizens report incidents and send SOS alerts with their location, and gives police and administrators the tools to act on those alerts. A super admin can route each SOS to the nearest regional police station and log the call or email.

Everything the app displays comes from a database or from a trained model's output file. There is no demo or placeholder data in the running app. Hotspots appear only after the NCRB data is loaded, and incidents and SOS alerts appear only after people use the app.

---

## Contents

- [What the app does](#what-the-app-does)
- [Repository layout](#repository-layout)
- [Requirements](#requirements)
- [Quick start (local)](#quick-start-local)
- [Environment variables](#environment-variables)
- [Loading the data](#loading-the-data)
- [Running the app](#running-the-app)
- [Accounts and roles](#accounts-and-roles)
- [Using the main features](#using-the-main-features)
- [API overview](#api-overview)
- [Data, model and limitations](#data-model-and-limitations)
- [Troubleshooting](#troubleshooting)
- [Security notes](#security-notes)
- [Development checks](#development-checks)

---

## What the app does

| Area | What it does | Who |
|---|---|---|
| Hotspot map | Shows 387 districts with NCRB-derived risk levels, colour-coded by severity | Everyone signed in |
| Dashboard | Totals for hotspots, critical zones, incidents and active SOS alerts, plus the model's holdout R² | Everyone signed in |
| Report incident | Submit a crime report with type, description, severity and location | Citizens |
| SOS | One-tap emergency alert with the device location and optional live tracking, sent to saved emergency contacts over WhatsApp when configured | Citizens |
| SOS alerts | View, acknowledge and resolve alerts | Police and admins |
| Analytics | Charts built from recorded incidents (status, severity, type, hour of day) | Police and admins |
| Live public signals | Searches public web sources for high-risk districts through the TinyFish API. Each result is reviewed by a person before it is marked verified | Police review; admins run searches |
| ML dashboard | Model metrics and the naive baseline they are compared with | Admins |
| User management | Lists registered users | Admins |
| Access requests | Approve or reject requests for police and admin accounts | Super admin |
| SOS dispatch | For an active SOS, shows the nearest regional police station with Call and Email actions, and logs each contact | Super admin |

---

## Repository layout

```
LiveSafe/
├── artifacts/
│   ├── api-server/        Express 5 API (auth, incidents, SOS, hotspots, dispatch, ML endpoints)
│   ├── livesafe/          React 19 + Vite frontend (the web app)
│   └── mockup-sandbox/    Design preview sandbox. Not needed to run the app
├── lib/
│   ├── db/                Drizzle ORM schema and database push command
│   ├── api-zod/           Shared request and response schemas
│   └── api-client-react/  Shared client helpers
├── ml-pipeline/           Python pipeline that builds the hotspot data and trains the model
├── scripts/
│   ├── src/               Seed and import scripts
│   └── data/              Bundled police station directory (CSV) and README
├── attached_assets/       Archived files. Not used by the app at runtime
└── README.md
```

---

## Requirements

Install these first. The versions below are the ones this project was run with.

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22 LTS (20.19 or newer also works) | Vite 7 needs a recent Node. Download from nodejs.org |
| pnpm | 11 | `npm install -g pnpm@11` |
| PostgreSQL | 16 or newer | Tested with 18. Default port 5432 |
| Git | any recent version | To clone the repository |

Optional, for regenerating the ML data only: Python 3.11+ with `pandas`, `numpy` and `scikit-learn`. See [`ml-pipeline/README.md`](ml-pipeline/README.md).

---

## Quick start (local)

Commands are shown for Windows (cmd) and macOS/Linux (bash). Where they differ, the Windows command comes first.

### 1. Clone the repository

```bash
git clone https://github.com/abhay1923/LiveSafe.git
cd LiveSafe
```

### 2. Install dependencies

```bash
pnpm install
```

If pnpm reports `ERR_PNPM_IGNORED_BUILDS` for `esbuild`, approve it and install again:

```bash
pnpm approve-builds
pnpm install
```

Choose `esbuild` when prompted.

### 3. Create the database

Create an empty database called `livesafe`. Using `psql` (you will be asked for the `postgres` password you set during install):

```bash
psql -U postgres -h localhost -c "CREATE DATABASE livesafe;"
```

On Windows the `psql` program is usually at `"C:\Program Files\PostgreSQL\18\bin\psql.exe"`. If you get `already exists`, the database is ready.

### 4. Create the environment files

Copy the templates and fill in your values (see [Environment variables](#environment-variables)):

```bash
cp artifacts/api-server/.env.example artifacts/api-server/.env
cp artifacts/livesafe/.env.example artifacts/livesafe/.env.local
```

Windows cmd:

```cmd
copy artifacts\api-server\.env.example artifacts\api-server\.env
copy artifacts\livesafe\.env.example artifacts\livesafe\.env.local
```

### 5. Create the tables

Set the database URL for this terminal session and push the schema:

```bash
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/livesafe"
pnpm --filter @workspace/db run push
```

Windows cmd:

```cmd
set DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/livesafe
pnpm --filter @workspace/db run push
```

If your password contains special characters, encode them in the URL (for example `@` becomes `%40`). See [Environment variables](#environment-variables).

### 6. Load the data

```bash
pnpm --filter @workspace/scripts run seed-hotspots
pnpm --filter @workspace/scripts run import-police-directory
```

Expected output: `Upserted 387 hotspot rows` and `Imported 59 station records and 36 State/UT coverage rows`. Both scripts are safe to run again.

### 7. Start the API

Terminal 1:

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

Wait for `Server listening`. On the first start, the super admin account is created. Its email is logged, and if `SUPER_ADMIN_PASSWORD` was not set, the generated password is logged once. Save it.

Check it is up:

```bash
curl http://localhost:3000/api/healthz
```

You should see `{"status":"ok"}`.

### 8. Start the frontend

Terminal 2:

```bash
pnpm --filter @workspace/livesafe run dev
```

Open **http://localhost:5173** in your browser.

---

## Environment variables

### API server: `artifacts/api-server/.env`

| Variable | Required | Example | Purpose |
|---|---|---|---|
| `PORT` | Yes | `3000` | Port the API listens on |
| `DATABASE_URL` | Yes | `postgresql://postgres:pass%40word@localhost:5432/livesafe` | PostgreSQL connection. Encode special characters in the password |
| `CORS_ORIGIN` | Recommended | `http://localhost:5173` | Frontend origin allowed to call the API |
| `SUPER_ADMIN_EMAIL` | No | `superadmin@livesafe.local` | Email for the super admin account created on first start |
| `SUPER_ADMIN_PASSWORD` | Recommended | a strong password | Password for that account. If it is unset on first start, a random one is generated and logged once |
| `TINYFISH_API_KEY` | Optional | your key | Enables the live public signals search. Without it, the search returns "TinyFish is not configured" |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | Optional | | WhatsApp notifications to emergency contacts when an SOS is sent |
| `LOG_LEVEL` | No | `info` | Logging level |

### Frontend: `artifacts/livesafe/.env.local`

| Variable | Value for local use | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000/api` | Where the browser sends API requests |
| `VITE_API_PROXY_TARGET` | `http://localhost:3000` | Used by the Vite dev server to forward `/api` requests |

The frontend template also lists `VITE_SUPABASE_*` variables. The app does not use them and they can be deleted.

---

## Loading the data

| Step | Command | What it does |
|---|---|---|
| Schema | `pnpm --filter @workspace/db run push` | Creates or updates all tables. Run after pulling new code |
| Hotspots | `pnpm --filter @workspace/scripts run seed-hotspots` | Loads the 387 NCRB-derived districts from `ml-pipeline/hotspots_real.json` |
| Police directory | `pnpm --filter @workspace/scripts run import-police-directory` | Loads station contacts and State/UT portal links from `scripts/data/police-directory/` |

To regenerate the hotspot data from the NCRB CSV files, see [`ml-pipeline/README.md`](ml-pipeline/README.md).

---

## Running the app

### Development (recommended for local use)

Two terminals, as in the quick start:

```bash
# Terminal 1: API on http://localhost:3000
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start

# Terminal 2: frontend on http://localhost:5173
pnpm --filter @workspace/livesafe run dev
```

Stop either server with `Ctrl+C`.

### Production build

```bash
pnpm --filter @workspace/livesafe run build      # writes static files to artifacts/livesafe/dist
pnpm --filter @workspace/livesafe run serve      # previews the built frontend
```

For a real deployment, serve the built frontend over HTTPS from a web server or hosting platform, run the API behind a reverse proxy that uses HTTPS, set `CORS_ORIGIN` to your frontend's address, and set `VITE_API_URL` to the API's public URL before building. This setup has not been tested in this repository.

---

## Accounts and roles

On first start, the API creates the super admin account from `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`. Other accounts are created in one of two ways:

- **Citizens** sign up on the login page. No approval is needed.
- **Police and admin** accounts are requested on the login page with a badge number. A super admin approves or rejects the request on the **Access Requests** page. Until approved, sign-in is refused and the app says the request is pending.

| Role | Can do |
|---|---|
| Citizen | View the map and dashboard, report incidents, send SOS alerts, manage emergency contacts |
| Police | Everything citizens can do, plus view and act on SOS alerts, view analytics, review live signals |
| Admin | Everything police can do, plus run live-signal searches, view the ML dashboard and user list |
| Super admin | Approve or reject access requests, open the SOS Dispatch page |

Use a fresh database for any real deployment. Do not reuse the local super admin password anywhere else.

---

## Using the main features

**Report an incident (citizen):** open **Report Incident**, choose the type, add a description, and use the location button. The browser asks for permission. If location is unavailable, enter coordinates manually.

**Send an SOS (citizen):** on the map, press the SOS button. The app requests a fresh high-accuracy location. It never sends a guessed or cached position. If location fails, the app shows the reason and tells you to call 112. After a successful send, the app shows the location accuracy in metres. Accuracy above 100 m is flagged. Laptops often locate using Wi-Fi, which can be inaccurate by hundreds of metres. A phone with GPS gives better results.

**Acknowledge an SOS (police):** open **SOS Alerts**, select an alert, and acknowledge or resolve it.

**Dispatch an SOS (super admin):** open **Access Requests** and press **SOS Dispatch**. Select an active alert. The app finds the nearest mapped district and lists the compiled police stations for it:

- **Routed:** the station list is shown. Confirm the closest station on a map before calling.
- **State contacts not compiled** or **District not in directory:** the app shows the official state police portal and asks you to use 112.
- **Outside routing area:** the nearest mapped district is more than 50 km away, so no station is suggested.

**Call** and **Email** open your phone or mail app. The email is pre-filled with the reference, reporter name, coordinates and a map link. Each action is recorded in the dispatch log. The app never places calls or sends email by itself.

**Live public signals (optional):** requires `TINYFISH_API_KEY`. On the Analytics page, an admin presses **Check sources** to search public web results for the highest-risk districts. Results are saved as pending. A police officer or admin marks each one as verified or rejected. Only verified items are counted as verified. Nothing from these searches changes risk scores.

---

## API overview

All endpoints are under `/api`. Most require a session token in the `Authorization: Bearer <token>` header, obtained from `POST /auth/login`.

| Method and path | Access | Purpose |
|---|---|---|
| `GET /healthz`, `GET /healthz/db` | Public | Health checks |
| `GET /public/stats` | Public | Mapped district and state counts for the landing page |
| `POST /auth/signup-citizen`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | Public / signed in | Accounts and sessions |
| `POST /auth/request-access` | Public | Request a police or admin account |
| `GET /hotspots` | Signed in | NCRB-derived districts |
| `GET /dashboard/stats` | Signed in | Dashboard totals |
| `GET /ml/metrics` | Signed in | Holdout accuracy, R² and baseline figures |
| `POST /ml/predict` | Signed in | Risk estimate for a location |
| `POST /incidents`, `GET /incidents` | Citizen create; signed in read | Incident reports |
| `GET /incidents/stats` | Police, admin | Aggregates for analytics |
| `POST /sos`, `GET /sos` | Citizen create; police, admin, super admin read | SOS alerts |
| `POST /sos/:id/location` | Owner | Live location updates |
| `PATCH /sos/:id/acknowledge`, `PATCH /sos/:id/resolve` | Police, admin | Handle alerts |
| `GET /sos/contacts`, `POST /sos/contacts` | Citizen | Emergency contacts |
| `GET /dispatch/sos/:id`, `POST /dispatch/sos/:id/log` | Super admin | Regional station routing and dispatch log |
| `GET /live-signals`, `PATCH /live-signals/:id/review`, `POST /live-signals/refresh` | Police / admin | Public signals review; refresh needs TinyFish |
| `GET /admin/access-requests`, `POST /admin/access-requests/:id/approve`, `POST /admin/access-requests/:id/reject` | Super admin | Access requests |
| `GET /admin/users` | Admin, super admin | User list |

---

## Data, model and limitations

**Sources**
- NCRB district-year crime data, 2010 to 2024, as supplied in `ml-pipeline/`. Five crime heads are covered: IPC offences, Special and Local Laws, crimes against women, crimes against children, and cyber crime.
- Census 2011 district population, used where a district matched.
- Geographic coordinates from an open city dataset ([Vynex/indian-cities-geodata](https://github.com/Vynex/indian-cities-geodata)).
- Police station contacts from official police pages. The sources are listed on each row in `scripts/data/police-directory/`.

**Coverage**
- 1,231 district reporting units after de-duplication. 387 are placed on the map, because only those could be matched to a coordinate. All 1,231 contribute to the state summaries.
- 29 states have at least one mapped district.
- The police directory covers 59 stations: Faridabad and Jind (Haryana) and parts of West Bengal (Asansol Durgapur and Alipurduar). Every other State and UT has only its official portal link. Missing numbers do not mean a station has no phone.

**Model** (GradientBoostingRegressor, trained on 2010 to 2022, tested on 2023 to 2024)
- Holdout R² 0.886 for severity. A naive "same as last year" baseline scores 0.929 on the same test. The model does not beat this baseline, and the app reports both numbers.
- Risk-class accuracy 77.7%, against 82.5% for the baseline.
- The data is annual. It does not show live crime.

**Other limits**
- Incidents and SOS alerts are only what people report in the app.
- SOS location accuracy depends on the device, as described above.
- Police station phone numbers and emails were copied from official pages and must be confirmed before use.
- WhatsApp alerts and live public signals only work after you add the relevant keys.
- There is no automated test suite. Use the typecheck and build commands below.
- `artifacts/livesafe/src/utils/supabase/` is unused.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `password authentication failed for user "postgres"` | Wrong password, or the URL was typed incorrectly. Test with `psql -U postgres -h localhost -d livesafe` |
| `No schema files found` when pushing | Use the current code. `lib/db/drizzle.config.ts` must point to `./src/schema/index.ts` as a relative path |
| `relation "..." does not exist` | The schema push has not been run. Run it, then rerun the failing script |
| `ERR_PNPM_IGNORED_BUILDS` (esbuild) | Run `pnpm approve-builds`, select `esbuild`, then `pnpm install` |
| `drizzle-kit is not recognized` | Dependencies are not installed. Run `pnpm install` from the repository root |
| Map shows 0 hotspots | Run the hotspot seed command |
| Dispatch page shows "Outside routing area" for a known place | The nearest mapped district may be far away, or the place is outside India's mapped districts |
| `TinyFish is not configured` | Expected unless `TINYFISH_API_KEY` is set |
| Frontend loads but shows red errors | Check the API is running on port 3000 and `VITE_API_URL` is correct. Press F12 and read the Console tab |
| Port already in use | Stop the other process, or change `PORT` (API) or `PORT` (frontend `.env.local`) |

---

## Security notes

- `.env` and `.env.local` files contain secrets. They are excluded from git by `.gitignore`. Never commit them.
- Rotate any key or password that has been shared in chat, email or screenshots.
- Set `SUPER_ADMIN_PASSWORD` to a strong value. Do not use the same password as your database.
- Use HTTPS in any deployment. The app's login tokens are sent in headers, so plain HTTP exposes them.
- SOS and dispatch data contain personal and location information. Restrict database and dashboard access accordingly.

---

## Development checks

From the repository root:

```bash
pnpm run typecheck                                 # type-checks the libraries, API, frontend and scripts
pnpm --filter @workspace/api-server run build      # builds the API
pnpm --filter @workspace/livesafe run build        # builds the frontend for production
```

---

## Acknowledgements

- NCRB for the published crime data.
- Census of India for district population.
- Vynex for the open city geodata.
- The official state police portals linked in the police directory.

License: not specified yet. Add a `LICENSE` file before reusing or redistributing this code.
