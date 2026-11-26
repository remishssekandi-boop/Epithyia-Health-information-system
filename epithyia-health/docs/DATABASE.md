# Database design and initialization

The platform uses MySQL 8.x or compatible MariaDB 10.4+. The configured default database is `epithyia_health`; connection settings come from the project-root `.env` and are consumed by the existing `mysql2/promise` connection pool.

## Tables

| Table | Purpose and important fields |
| --- | --- |
| `roles` | Unique role names (`ADMIN`, `CONTENT_MANAGER`, `HEALTH_WORKER`, `USER`) and descriptions. |
| `users` | Account profile, unique email and phone, bcrypt `password_hash`, required role, and `ACTIVE`/`INACTIVE` status. No plaintext passwords are seeded. |
| `health_categories` | Unique category name, description, and `ACTIVE`/`INACTIVE` status. |
| `health_articles` | Category, title, summary, content, language (defaults to English), creator, optional publish time, and `DRAFT`/`PUBLISHED`/`ARCHIVED` status. |
| `sms_messages` | Phone, message, `INCOMING`/`OUTGOING` direction, delivery status, optional provider ID, and timestamps. |
| `ussd_sessions` | Provider session ID, phone, latest input/menu/response, status, and timestamps. |
| `ussd_session_events` | Idempotency-keyed USSD menu selections and public responses for simulator/provider replay and session history. |
| `ussd_menu_configs` | Provider-independent USSD menu text. |
| `hospitals` | Hospital directory entries, image URL, verification status, and demo marker. The database is seeded with six facilities; administrators can add more. |
| `hospital_services` | Hospital service names with explicit verification and source URL; unverified services are never shown as available. |
| `appointments` | Community member's hospital, requested date/time, optional service, request status, and demo marker. Requests are not confirmed bookings until reviewed. |
| `notifications` | User-owned title/message and `UNREAD`/`READ`/`ARCHIVED` status. |
| `audit_logs` | Optional actor, action, entity, optional entity ID, JSON details, and creation time. |
| `system_settings` | Unique setting key and value with creation/update timestamps. |

All tables use InnoDB and `utf8mb4`. Tables with updateable records use automatic `created_at` and `updated_at` timestamps; audit records are append-oriented and have `created_at` only.

## Relationships and delete rules

- `users.role_id` references `roles.id`; deleting a role still used by a user is restricted.
- `health_articles.category_id` references `health_categories.id`; category deletion is restricted while any article references it, including published articles. Archive or reassign those articles before deleting the category.
- `health_articles.created_by` references `users.id`; a creator cannot be deleted while their articles remain.
- `notifications.user_id` references `users.id`; notifications are deleted with their user.
- `appointments.user_id` and `appointments.hospital_id` reference their owners; deletion is restricted while requests exist so reset or cleanup cannot silently remove non-demo appointment data.
- `audit_logs.user_id` references `users.id`; user deletion preserves the audit record and sets the actor reference to `NULL`.
- Foreign keys use `ON UPDATE CASCADE` so ID updates remain consistent.

## Indexes

Unique indexes enforce role names, user email/phone, category names, and setting keys. Additional indexes support user role lookups; article category, status, creation date, creator, and category/status filtering; SMS phone/status/date/provider lookups; USSD session ID, phone/status/date lookup; appointment user/date and status/date lookups; notification user/status lookup; and audit actor/date/entity lookup. Foreign-key indexes are supplied explicitly where MySQL does not already have a suitable leading index.

## Initialize from the backend directory

1. Configure the project-root `.env` values `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`. The default database name is `epithyia_health`.
2. Start MySQL/MariaDB. For the existing local XAMPP MariaDB installation on Windows, start MySQL in the XAMPP Control Panel or run:

   ```powershell
   Start-Process -FilePath 'C:\xampp\mysql\bin\mysqld.exe' -ArgumentList '--defaults-file="C:\xampp\mysql\bin\my.ini" --standalone'
   ```

3. From `backend`, install packages and apply schema plus sample rows:

   ```powershell
   npm install
   npm run db:setup
   ```

   Setup creates the configured database if absent, then applies `database/schema.sql` and `database/seed.sql`. Schema tables are created with `CREATE TABLE IF NOT EXISTS`; the seed uses unique keys and can be rerun. Existing installations can apply `database/migrations/20261126_appointments.sql` to add appointment-request storage.

4. To apply one part only, run `npm run db:schema` or `npm run db:seed`.
5. Verify the database with `npm run db:verify`. Expected success markers include `DATABASE CONNECTION: OK`, `TABLES: OK`, `ROLES: OK`, and `SAMPLE DATA: OK`.

The seed data is explicitly for local demonstration. It creates four demo accounts with bcrypt hashes, nine sample categories, draft-only article placeholders labelled `[DEMO ONLY]`, six hospital directory entries with source-backed public contact/service information, USSD menu text, and demo settings. Hospital listings link to their published sources; hours and availability can change, so users should confirm them directly. Administrators may add unverified directory entries, and community members may request appointments; these requests are reviewed in the admin dashboard and do not notify hospitals. Externally hosted image URLs and a separate Google Maps directions link are documented in [`HOSPITALS.md`](../HOSPITALS.md). Article placeholders contain no medical claims or advice. Demonstration passwords are listed in [`DEMO_CREDENTIALS.md`](../DEMO_CREDENTIALS.md) and must not be used in production. See [`HOSPITALS.md`](../HOSPITALS.md) for directory sources and details.

## Database helper

`backend/src/services/database.js` exports `query(sql, parameters)` backed by `mysql2` prepared execution and `withTransaction(callback)` for pooled transactions. The optional `DATABASE_MODE=demo` adapter uses a persistent local SQLite file and implements the same query/transaction surface for local demonstration only. Pass user-provided values as parameters; never concatenate them into SQL. For transactional work, use the provided connection's `execute(sql, parameters)` method.