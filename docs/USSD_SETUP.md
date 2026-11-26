# USSD service setup

## Architecture and menu

`backend/src/services/ussdService.js` owns the provider-independent session state machine. Both the browser simulator and the Africa’s Talking-compatible webhook call this service. The route/controller is an adapter boundary; provider request parsing can be extended without duplicating menu logic.

The menu is public-information-only:

1. Hospital directory
2. Hospital details
3. Health guides on the website
4. Emergency contacts
5. About this guide
6. Help
0. End

Choose a hospital, then select 1 for phone, 2 for address, 3 for services, 4 for hours, or 5 for emergency information. Published contact details and service lists are backed by the sources in [HOSPITALS.md](./HOSPITALS.md). Operating hours and availability can change; confirm directly with the hospital. Appointment requests are available only in the signed-in web dashboard; this USSD menu does not accept or check appointment requests.

## Local simulator

Start the application and open `/ussd.html`. The page gives example selection sequences, including `1 → 1 → 1` for Mengo phone numbers and `4 → 5` for Mulago emergency contacts. `*123#` is shown as an example dial string for the walkthrough only; it is not an active shortcode and must not be dialled on a phone. Enter a demonstration phone number, start a browser session, and submit one menu selection at a time. Session state and event history are stored in SQL (`ussd_sessions` and `ussd_session_events`); replaying an identical session/input pair returns the previous response. Sessions expire after five minutes of inactivity. The simulator does not send mobile-network traffic.

## Webhook configuration

The adapter endpoint is `POST /api/ussd/providers/africas-talking`. It accepts an Africa’s Talking-style form body containing `sessionId`, `phoneNumber`, `serviceCode`, and cumulative `text`, and returns the provider-compatible `CON ...` or `END ...` response.

1. Configure a random `USSD_PROVIDER_TOKEN` in the server environment.
2. Configure the provider or an authenticated HTTPS gateway in front of it to send that secret in the `X-USSD-Provider-Token` header.
3. Set `PUBLIC_BASE_URL` and `USSD_CALLBACK_URL` to the externally reachable HTTPS callback URL.
4. If TLS terminates at a reverse proxy, set `TRUST_PROXY` only to the correct proxy hop count/address so Express can enforce the HTTPS requirement.
5. Register the callback and shortcode with the provider and complete its authorization and sandbox procedures.

Never put provider secrets in frontend files or source control. The webhook rejects requests when the token is unset or invalid, and production requests must be secure. The integration does not claim that a shortcode, provider account, network route, or provider signature is configured. The gateway token is an application-level shared-secret check; configure provider-native signature validation at the gateway if the selected provider supports it.

## Deployment requirements not included

Live operation needs a provider-authorized shortcode/account, public HTTPS endpoint, a verified callback path, provider-side request authentication/signature details, network reachability, and sandbox/real-device testing. No credentials or approvals are supplied with this project; live USSD is not currently operational.
