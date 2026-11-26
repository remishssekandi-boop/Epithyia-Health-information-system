# EPITHYIA GROUP — Hybrid Web-SMS/USSD Health Information Platform

EPITHYIA GROUP is a Node.js/Express health-information website with a MySQL production database, an opt-in persistent SQLite demonstration mode, JWT authentication, and role-based content/account workflows. Community members can submit appointment requests for administrator review, and administrators can add hospital directory entries. Requests are not confirmed bookings and do not notify hospital staff; users must call the hospital to confirm. The responsive frontend also includes a hospital information directory and a USSD simulator backed by the same menu/session service as its provider webhook. This is not a clinical-record or emergency-response system.

Frontend pages use standard `.html` files. The public health library, hospital directory, and browser USSD simulator are available on static hosting. Sign-in, registration, appointments, and administration need the Express API and are not available on GitHub Pages.

## Requirements

- Node.js 18.18 or newer and npm
- MySQL 8.x or compatible MariaDB 10.4+ for `DATABASE_MODE=mysql` (the included XAMPP MariaDB 10.4 is supported)
- A database account permitted to create/use the configured database and its tables when using MySQL mode
- A strong random `JWT_SECRET` of at least 32 characters before using authentication endpoints

## Database setup

The configured database name is `epithyia_health`. The local root `.env` file is ignored by Git; set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` to match your database server. To prepare a local XAMPP MariaDB installation on Windows, start MySQL from the XAMPP Control Panel or run:

```powershell
Start-Process -FilePath 'C:\xampp\mysql\bin\mysqld.exe' -ArgumentList '--defaults-file="C:\xampp\mysql\bin\my.ini" --standalone'
```

From the `backend` directory, install dependencies and initialize the database:

```powershell
npm install
npm run db:setup
npm run db:verify
```

`db:setup` creates the configured database if needed, applies `backend/database/schema.sql`, and inserts repeatable demonstration data from `backend/database/seed.sql`. To run each part separately, use `npm run db:schema` and `npm run db:seed`. The seed is safe to rerun; it stores only bcrypt password hashes. See [`docs/DATABASE.md`](docs/DATABASE.md) for table relationships and details.

### Persistent fake database for demonstrations

MySQL is optional for local demonstrations. Set `DATABASE_MODE=demo` in the project-root `.env` to use a local SQLite database. The application creates `backend/data/demo.sqlite` on first start, seeds safe sample accounts and clearly labelled demonstration content, and saves account and content changes across restarts. This mode does not fall back automatically from MySQL; set `DATABASE_MODE=mysql` to use the normal MySQL database. The local SQLite file is ignored by Git and should not be used for production or sensitive data.

The demo accounts and passwords are listed in [`DEMO_CREDENTIALS.md`](DEMO_CREDENTIALS.md). Configure a strong `JWT_SECRET` before using authentication. Demo content is not medical advice and should be replaced with qualified, locally approved health information before a real service is launched.

### Demonstration accounts

These accounts are for local demonstrations only. Their known passwords are intentionally documented here (not stored as plaintext in SQL); change/remove them before any shared or production deployment.

| Role | Email | Demonstration password |
| --- | --- | --- |
| ADMIN | `admin.demo@epithyia.local` | `EpithyiaAdminDemo!2026` |
| CONTENT_MANAGER | `content.demo@epithyia.local` | `EpithyiaContentDemo!2026` |
| HEALTH_WORKER | `worker.demo@epithyia.local` | `EpithyiaWorkerDemo!2026` |
| USER | `user.demo@epithyia.local` | `EpithyiaUserDemo!2026` |

The database seed contains draft-only `[DEMO ONLY]` article placeholders, not medical advice. They make no health claims and must be replaced with content reviewed and approved by qualified local health authorities before publication or community use.

## Start the API

From the `backend` directory, start the development server (it serves the `frontend/` folder on the same origin for local use):

```powershell
npm run dev
```

The API and database scripts load environment variables from the project-root `.env`. A development `.env` is local and ignored by Git. Set `JWT_SECRET` to a randomly generated secret before using auth endpoints; for a one-session PowerShell run, you can set it without printing the secret:

```powershell
$rng = [Security.Cryptography.RandomNumberGenerator]::Create(); $secretBytes = New-Object byte[] 48; $rng.GetBytes($secretBytes); $rng.Dispose(); $env:JWT_SECRET = [Convert]::ToBase64String($secretBytes); npm run dev
```

Authentication API details, permissions, and request examples are in [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md).

## Verify the database and API

- `GET http://localhost:3000/api/health` — confirms Express is running.
- `GET http://localhost:3000/api/health/db` — checks the configured MySQL or demo database.
- `npm run db:verify` — checks the connection, all nine required tables, four roles, demonstration sample data, and bcrypt hashes.
- `npm test` — runs the database-backed authentication, authorization, health-category, and article integration tests (initialize the database first).
- `npm run test:demo` — tests the persistent SQLite demo mode without requiring MySQL.
- `GET /api/health/categories` and `GET /api/health/articles` — public health-information read endpoints.

The health endpoint response follows the project's `{ "success": true, "data": ... }` response convention.

See [`docs/HEALTH_INFORMATION.md`](docs/HEALTH_INFORMATION.md) for category/article APIs, roles, search filters, draft/publish/archive behavior, and examples.

Open the public site at `http://localhost:3000/`. Alongside the public health library, the site includes a sourced hospital directory and profiles, login/registration, a role-specific dashboard, appointment requests, and a USSD simulator. The ADMIN dashboard can add hospitals and review requests; demo mode also provides reset/session controls for the local SQLite database. Hospital listings use externally hosted images and provide a separate Google Maps directions link. See [`HOSPITALS.md`](HOSPITALS.md), [`USSD_SETUP.md`](USSD_SETUP.md), and [`DEMO_GUIDE.md`](DEMO_GUIDE.md) for scope and deployment requirements. Real provider credentials, an authorized shortcode, and provider verification are required before live USSD can be claimed.

## Deploy the public site to GitHub Pages

The repository includes a GitHub Actions workflow at `.github/workflows/pages.yml`. Push to `main` or `master` (or run the workflow manually from the Actions tab), then set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The workflow publishes the `frontend/` directory and supports a repository subpath such as `https://<account>.github.io/<repository>/`.

The checked-in `frontend/data/site-data.json` is a public snapshot used by GitHub Pages; it contains published health articles and active hospital listings only. To refresh it, start the local API and run `npm run export:pages-data` from `backend/` (set `API_BASE_URL` if the API is not at `http://localhost:3000/api`). Review the generated public content before committing. GitHub Pages cannot run the Express API or database: account authentication, appointment requests, admin tools, and persistent USSD sessions require a separately hosted backend. The browser USSD simulator on Pages is temporary and uses only the published snapshot.
