# Authentication and access control (Stage 3)

## Strategy

The API uses stateless JWT bearer tokens. On successful login, it returns a signed HS256 token; clients send it as `Authorization: Bearer <token>`. The token expires after `JWT_EXPIRES_IN` (default `1h`). It contains only the user subject, issuer, and audience—no password, email, or role claims.

Every authenticated request verifies the signature and then reloads the account, active status, and current role from MySQL. Role changes, deactivation, or account deletion therefore take effect on the next request, even if an old token has not yet expired. `POST /api/auth/logout` records an audit event and tells the client to discard its token; because tokens are stateless, logout does **not** revoke that token server-side, and it remains valid until expiry unless the account is disabled/deleted.

Passwords are hashed with bcryptjs at cost 12. The database also rejects values that do not have a bcrypt hash prefix. Password hashes are never returned by any API endpoint.

## Configure environment

Set these in the ignored project-root `.env` (or the deployment environment):

| Variable | Purpose | Default/example |
| --- | --- | --- |
| `JWT_SECRET` | Signing key. Use a cryptographically random secret, at least 32 characters; placeholder values are rejected. | Required for auth; do not commit it. |
| `JWT_EXPIRES_IN` | `jsonwebtoken` token lifetime. | `1h` |
| `RATE_LIMIT_WINDOW_MS` | Auth request limit window in milliseconds. | `900000` (15 minutes) |
| `RATE_LIMIT_MAX` | Maximum requests per IP in the window across the auth limiter. | `20` |
| `CORS_ORIGIN` | Comma-separated allowed browser origins. Requests without an Origin (such as curl) are allowed. | `http://localhost:5500,http://127.0.0.1:5500` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Existing MySQL/MariaDB connection settings. | Set for your database. |
| `NODE_ENV`, `PORT` | Runtime mode and HTTP port. | `development`, `3000` |

For a one-session PowerShell development run that creates a secret without displaying it:

```powershell
$rng = [Security.Cryptography.RandomNumberGenerator]::Create(); $secretBytes = New-Object byte[] 48; $rng.GetBytes($secretBytes); $rng.Dispose(); $env:JWT_SECRET = [Convert]::ToBase64String($secretBytes); npm run dev
```

For persistent local development, generate a random secret with a trusted password manager or cryptographic generator and place it in the ignored root `.env`. Never use the `.env.example` placeholder in production.

## Registration

`POST /api/auth/register` accepts `name`, `email`, `phone`, and `password`. Names must be 2–150 characters; emails must be valid; phone values accept E.164 or common Ugandan local forms (local numbers are normalized to `+256...`). Passwords must be 12–72 UTF-8 bytes and include lowercase, uppercase, numeric, and symbol characters. Public registration always assigns the `USER` role; attempts to provide `role`, `role_id`, `status`, or `password_hash` are rejected.

Example request:

```http
POST /api/auth/register
Content-Type: application/json

{"name":"Demo Community Member","email":"member@example.test","phone":"0700123456","password":"LocalDemo!Password27"}
```

Success (`201`):

```json
{"success":true,"data":{"user":{"id":123,"name":"Demo Community Member","email":"member@example.test","phone":"+256700123456","role":"USER"}}}
```

Duplicate email or phone returns `409`; validation failures return `400`. Registration does not return a token; sign in after registration.

## Login and current user

`POST /api/auth/login` takes `email` and `password`. It returns the token and safe user data (`id`, `name`, `email`, `phone`, `role`) on success; invalid credentials return a generic `401`, and a valid password for an inactive account returns `403`.

```http
POST /api/auth/login
Content-Type: application/json

{"email":"admin.demo@epithyia.local","password":"EpithyiaAdminDemo!2026"}
```

Response (`200`):

```json
{"success":true,"data":{"token":"<JWT>","user":{"id":1,"name":"Demo Administrator","email":"admin.demo@epithyia.local","phone":"+256700000001","role":"ADMIN"}}}
```

Use the token on protected routes:

```http
GET /api/auth/me
Authorization: Bearer <JWT>
```

Response includes safe identity fields and `status`; it never includes `password_hash`. Missing, malformed, invalid, or expired bearer tokens return `401`.

`POST /api/auth/logout` requires authentication. Discard the token client-side; no server-side blacklist is implemented. `PUT /api/auth/change-password` requires `currentPassword` and a policy-compliant `newPassword`. The client should discard its current token and sign in again; as a stateless JWT it is not revoked server-side before expiry.

## Middleware and permissions

- `requireAuth` verifies JWT signature, issuer, audience, and expiry; re-queries the user and active state/role from the database.
- `requireRole(...roles)` denies authenticated users outside the allowed role set with `403`.
- `ADMIN` only: all user-management endpoints (`GET /api/users`, `/api/users/:id`, `PUT /api/users/:id`, `DELETE /api/users/:id`, `PATCH /api/users/:id/status`, `PATCH /api/users/:id/role`). `DELETE` deactivates rather than physically deleting the account. The last active administrator cannot be deactivated, demoted, or deleted.
- Any active role: `GET /api/users/me` and `PUT /api/users/me`; users can change only their own name and phone there.
- A regular profile edit cannot alter email, role, status, or password. Admin account edits cannot change role/status/password; those have dedicated protected operations (password is changed by its owner via `/api/auth/change-password`).
- Published health information permissions will be applied in Stage 4; no health-content routes are added in Stage 3.

Administrative changes and authentication events (`REGISTER`, `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `PASSWORD_CHANGED`, `PROFILE_UPDATED`, `USER_UPDATED`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `ROLE_CHANGED`) are recorded in `audit_logs`. Passwords and tokens are not logged.

## User-management API examples

```http
GET /api/users
Authorization: Bearer <ADMIN_JWT>
```

```http
PATCH /api/users/123/role
Authorization: Bearer <ADMIN_JWT>
Content-Type: application/json

{"role":"HEALTH_WORKER"}
```

```http
PATCH /api/users/123/status
Authorization: Bearer <ADMIN_JWT>
Content-Type: application/json

{"status":"INACTIVE"}
```

User listing and records expose identity, role, and status only—never password hashes. User deletion is a soft deactivation to preserve audit and foreign-key relationships.

## Rate limits and HTTP security

Registration, login, and password change share an IP-based limiter configured with `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX`. `helmet` sets standard security headers. CORS permits only configured origins for browser clients; command-line/API clients without an `Origin` header work normally. Authorization is enforced by the backend, not by frontend visibility.

## Testing

From `backend`, with MariaDB running and Stage 2 tables/seed installed:

```powershell
npm test
```

The Node test suite starts the Express app on an ephemeral port, exercises validation and duplicate handling, login failures/success, missing/invalid/expired tokens, current-user/profile/password routes, all four roles, admin-only operations, status/role refresh, last-admin protection, and audit events. It creates and removes a uniquely named test account. To run manually, start the API with a strong `JWT_SECRET`, then try the register/login examples, copy the returned token to `/api/auth/me`, and call `GET /api/users` first with the admin token (200) and then a `USER` token (403). Health routes remain available at `/api/health` and `/api/health/db`.