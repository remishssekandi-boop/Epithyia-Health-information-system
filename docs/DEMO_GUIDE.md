# Demonstration guide

## Start

For a local persistent demo database, use `DATABASE_MODE=demo` in the project-root `.env` and set a random `JWT_SECRET` of at least 32 characters. From `backend`, run `npm run dev`, then open `http://localhost:3000/`. The demo database file is `backend/data/demo.sqlite` and is ignored by Git. This mode is for local demonstration only, not production or sensitive data.

For the MySQL environment, initialize it with the existing database setup and seed commands. The four existing application roles and demo credentials are listed in [DEMO_CREDENTIALS.md](./DEMO_CREDENTIALS.md).

## Suggested walkthrough

1. Browse the public health library and open one of its clearly marked sample articles.
2. Open the hospital directory, search by hospital name or address, and inspect a profile. Published contact numbers, services, hours, and emergency details link to their sources in [HOSPITALS.md](./HOSPITALS.md). Confirm current availability by phone. Hospital photos use externally hosted URLs, and each listing has a separate Google Maps directions link.
3. Open the USSD simulator and try `1 → 1 → 1` for Mengo phone numbers, `1 → 5 → 5` for Mulago emergency contacts, or `4 → 5` to open emergency contacts and select Mulago. Use `0` to go back, `00` for the main menu, and `9` to end. The displayed `*123#` is an example dial string only; the simulator has no live shortcode or mobile-network connection.
4. Log in using the accounts in [DEMO_CREDENTIALS.md](./DEMO_CREDENTIALS.md). As a USER, submit a preferred hospital date/time from the dashboard and check its status. Requests are not reservations or hospital notifications; call the facility to confirm.
5. Sign in as ADMIN to add a hospital, review and confirm/decline appointment requests, administer accounts, and manage demo records. New hospitals are listed publicly but marked unverified.

The application does not include separate hospital-staff, patient, finance, records, or clinical-workflow roles, so these are not simulated as if they were functional.

## Reset

In `DATABASE_MODE=demo`, an ADMIN can use the dashboard's **Reset demo records** control. It removes only rows explicitly marked `is_demo = 1`, clears demo USSD history and sessions, and reseeds the sample accounts and hospitals. Accounts added through registration and records created by non-demo accounts are marked non-demo and preserved; content and appointment requests created by a seeded demo account are marked demo. If a non-demo record depends on a demo record, the reset is rejected without deleting anything. Reset signs the administrator out.

The dashboard also provides **Clear demo USSD sessions**, which removes session/event history without changing accounts, hospitals, or content. These controls are unavailable in MySQL mode and require an authenticated ADMIN account. Do not remove database files or run demo seed/reset operations against a production database.
