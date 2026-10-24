# Password recovery

`POST /auth/forgot-password` accepts `{ "email": "customer@example.com" }`.
Valid email requests return the same HTTP 200 message for eligible, unknown,
unverified, account-throttled, and delivery-failed addresses. Only verified
customer emails with an existing password are eligible. An IP limit returns 429
independently of account existence. Responses are padded to the configured email
timeout (capped at five seconds) plus three seconds to reduce delivery timing
differences. Monitor database latency so it stays within this response window.

`POST /auth/reset-password` accepts:

```json
{
  "token": "opaque token from the email link",
  "newPassword": "a unique passphrase of 15–128 characters",
  "verificationMethod": "totp",
  "code": "123456"
}
```

`verificationMethod` also accepts `recovery_code` with a saved one-time code.
The token determines customer identity; email/customer IDs cannot override it.
Email alone cannot reset an enrolled authenticator. Customers without access to
either factor must use the existing dual-control operator recovery process.
Reset preserves the active MFA configuration and all account restrictions, clears
pending authenticator enrollment/challenges, and requires full login afterward.

The web routes are `/auth/forgot-password` and `/auth/reset-password`. The login
page links to recovery. Links carry the token in a fragment, never a query string.
The application clears the fragment before session restoration and telemetry,
retains the token only in memory, and submits it only in the reset POST body.
Refreshing the reset page requires reopening the email link. GET requests and
email-scanner visits never consume a token.

## Database and security

No migration, dependency, or database schema change is needed. Recovery reuses
`CustomerAuthFlow` with purpose `password_recovery`; its `id` is the
domain-separated HMAC-SHA256 hash of a random 32-byte token, rather than a login
flow ID. Tokens expire in 15 minutes. Customer row locks serialize issuance and
reset. New issuance invalidates all previous reset flows. A conditional update
claims a live token exactly once inside the same transaction as the password
update, recovery-code consumption/TOTP replay protection, credential revocation,
pre-authentication flow invalidation, and a credential-free audit record.
Argon2id hashing and password policy are the existing shared implementation.

Reset increments `authTokenVersion`, revokes all customer auth sessions (including
web, mobile refresh families, legacy, and remembered/trusted sessions), and clears
session/refresh/CSRF hashes and trust challenges. Outstanding notification socket
tickets are deleted. Open customer notification connections check authentication
version before delivery, replay, and heartbeats, including across API instances.
Credential-version checks also reject stale password verifications and prevent
in-flight legacy rehashes, password changes, or password upgrades from overwriting
a completed reset.

Persistent HMAC-keyed rate-limit buckets atomically reserve every attempt:

| Operation    | Subject                         | Limit per 15-minute window |
| ------------ | ------------------------------- | -------------------------- |
| Request link | IP                              | 10                         |
| Request link | Normalized email, across IPs    | 3, silently suppressed     |
| Reset        | IP                              | 20                         |
| Reset        | Customer, across tokens and IPs | 5                          |

Existing MFA lockout policy remains enforced. Failed MFA counters persist even
when reset is rejected. Tokens, passwords, and MFA codes never enter application
audit records or recovery telemetry; provider errors are replaced with fixed
errors. API recovery logs discard URL queries. Disable request-body capture for
these endpoints in any infrastructure/APM product as well.

## Email and deployment setup

Recovery uses `CustomerMfaEmailDeliveryService` and its existing configuration:

```dotenv
CUSTOMER_MFA_EMAIL_DELIVERY_MODE=resend
RESEND_API_KEY=<server-side secret>
CUSTOMER_MFA_EMAIL_DELIVERY_FROM_EMAIL=security@your-verified-domain.example
CUSTOMER_MFA_EMAIL_DELIVERY_FROM_NAME=Stealth Trails Bank Security
PASSWORD_RECOVERY_APP_URL=https://your-customer-app.example
PASSWORD_RECOVERY_ALLOWED_ORIGINS=https://your-customer-app.example
```

The application URL must be a bare origin in the exact allow list; production
requires HTTPS. Neither request Host nor Origin headers influence links. Local
HTTP is allowed only for explicitly allow-listed loopback origins outside
production. Existing HMAC and encryption secrets and hardened authentication
tables must already be configured.

For the existing webhook mode, configure
`CUSTOMER_MFA_EMAIL_DELIVERY_WEBHOOK_URL` and optionally
`CUSTOMER_MFA_EMAIL_DELIVERY_BEARER_TOKEN`. The adapter sends
`type: customer_password_recovery`, sender/recipient, `message.subject`,
`message.text`, `recovery.link`, `recovery.expiresAt`, and
`tracking: { clicks: false, opens: false }`. The HTTPS webhook must actually send
the email, honor the `Idempotency-Key` header, and return a successful status only
when accepted for delivery. Redirects are disabled. Raw provider payloads and
errors must not be logged by the webhook.

Disable email-provider click/open tracking for recovery mail and do not install
third-party scripts/session replay on recovery pages. Resend delivery uses its
existing [send-email API](https://resend.com/docs/api-reference/emails/send-email)
with a plain-text security message. These controls follow the
[OWASP password recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

Preview mode is intentionally unavailable for recovery: it exposes no token and
invalidates any undelivered token. Missing/invalid link configuration also returns
the generic response and records only a fixed operational failure event.
Monitor `password_recovery_request_unavailable`,
`password_recovery_delivery_failed`, and `password_recovery_reset_unavailable`.

Set `AUTH_TRUSTED_PROXY_CIDRS` only to actual ingress proxy addresses or networks
if running behind a proxy that sanitizes forwarding headers. By default IP limits
use the socket peer; client-supplied `X-Forwarded-For` is ignored. Never trust all
proxies. Set platform request timeouts above the padded recovery response window
and maintain existing HTTPS, no-referrer, no-store, and CSP headers.

No real mail has been sent or verified during implementation. Before declaring
end-to-end delivery working, obtain approval to send to a controlled mailbox,
configure a verified sender, check inbox/spam delivery and link integrity, and
verify expiry, replay rejection, MFA, and old-session rejection in staging.

## Tests

HTTP, configuration, email-adapter, frontend, and existing auth regression tests
use mocked providers. Database tests use real isolated local PostgreSQL and real
Argon2id; they do not use the application's `DATABASE_URL`.

To run database tests, prepare a disposable loopback PostgreSQL database named
`password_recovery_test...` with the existing Prisma schema and pgvector extension,
then run:

```sh
PASSWORD_RECOVERY_TEST_DATABASE_URL=postgresql://USER@127.0.0.1:PORT/password_recovery_test_017 \
  pnpm --filter @stealth-trails-bank/api exec jest --config ./jest.config.ts \
  --runInBand --testPathPattern=password-recovery.integration.spec
```

The integration suite is opt-in and rejects remote or differently named databases.
Dispose of the test database afterward. It covers token hashes/expiry,
replacement and concurrent issuance, single use under concurrent requests,
transaction rollback, enumeration responses, customer isolation, shared password
policy, MFA lockout/TOTP replay/recovery codes, revocation, and atomic throttling.
