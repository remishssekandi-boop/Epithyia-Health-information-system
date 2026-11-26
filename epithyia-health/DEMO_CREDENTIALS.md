# Demonstration accounts

These are development-only accounts for this application’s existing four roles. They do not represent hospital staff categories, and they must not be used in production. Passwords are stored as bcrypt hashes; the values below are supplied only for local demonstrations.

| Role | Email | Password | Existing permissions demonstrated |
| --- | --- | --- | --- |
| Administrator | `admin.demo@epithyia.local` | `EpithyiaAdminDemo!2026` | Account and health-content administration, adding hospitals, and reviewing appointment requests. |
| Content manager | `content.demo@epithyia.local` | `EpithyiaContentDemo!2026` | Create, update, publish, and archive health articles and manage categories. |
| Health worker | `worker.demo@epithyia.local` | `EpithyiaWorkerDemo!2026` | Read published health information; content administration is denied. |
| Community user | `user.demo@epithyia.local` | `EpithyiaUserDemo!2026` | Read public health information, use the directory/USSD simulator, and submit appointment requests. |

## Login

1. Start the application with the configured database.
2. Open `/login.php` and enter one of the accounts above.
3. Open the dashboard to submit appointment requests (community account) or add hospitals and review requests (administrator).
4. Open the hospital directory or USSD simulator to browse published facility information.

The login page exposes a convenience account selector only when `DATABASE_MODE=demo`. Login sessions use the existing JWT implementation and each account is checked against its stored role on every authenticated request.

## Limitations

Appointment requests store only the selected hospital, preferred date/time, optional service, and requesting account. They are not confirmed bookings and do not notify hospital staff; administrators can review and update their status, and community members should call the hospital to confirm arrangements. This project does not provide clinical records, billing, hospital staff accounts, or emergency response.

The directory starts with six hospital entries and administrators can add more. New entries are visible in the public directory but are marked unverified until independently checked. Hospital image URLs are externally hosted. Details and availability can change; confirm them directly with each hospital before travelling.
