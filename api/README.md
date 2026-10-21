# Secure API and frontend integration

This is a runnable implementation and review baseline, not a security certification. The published Sites origin remains a private frontend preview. Python, PostgreSQL, SMTP, Google and Stripe are not provisioned by uploading static files.

## Folder structure

```text
engineering-studio/
  dist/
    app.js, advanced.js, pages.js       existing engineering and product UI
    server-mode.js                     server guards, forms, profiles, billing, admin
  api/
    app.py                             API endpoints, middleware and authorization
    config.py                          environment configuration, startup checks
    models.py                          relational schema and seed plans
    security.py                        hashing, cookies, tokens, quotas, audit/outbox
    project_data.py                    project import/storage validation
    billing.py                         Stripe adapter and webhook state transitions
    money.py                           provider charge-unit formatting
    cli.py                             schema/dev init, admin, mail, reconciliation
    dev_setup.py                       ignored local secrets generation
    generate_schema.py                 initial PostgreSQL migration compiler
    migrations/0001_initial.sql         initial PostgreSQL DDL and plan seeds
    requirements.txt                   dependency ranges
    requirements.lock                  resolved versions tested here
    tests/test_security.py             executable security integration tests
    tests/test_edge_cases.py           races, refunds, malformed imports, money/MFA
    REFINED_BRIEF.md                    revised requirements and policies
    SECURITY_REVIEW.md                  risks, fixes, checklist and edge cases
  .env                                 ignored; never commit or publish
```

## Local start (PowerShell)

Run from the `engineering-studio` directory with Python 3.12+:

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r api/requirements.lock
.venv/Scripts/python.exe -m api.dev_setup
.venv/Scripts/python.exe -m api.cli init-db
.venv/Scripts/python.exe -m uvicorn api.app:run_app --factory --host 127.0.0.1 --port 8000 --no-access-log
```

This session's bundled Python lacks `ensurepip`; the isolated interpreter was created and dependencies installed using the bundled pip's `--python .venv/Scripts/python.exe` option instead. That is an environment workaround, not a requirement of the app.

Open `http://127.0.0.1:8000`. The frontend detects `/api/config` and changes from preview mode to server-backed account/project flows. Never point a static frontend at an unrelated cross-site API by simply weakening cookie/CORS settings; deploy behind one HTTPS origin with `/api` routed to the API.

Copy settings from `api/.env.example`. `api.dev_setup` generates fresh development keys without printing them. Set SMTP before using sign-up and recovery. Start a trusted local SMTP service or configure a test mailbox; then run:

```powershell
.venv/Scripts/python.exe -m api.cli send-mail
```

The API queues encrypted email records transactionally. It never prints password-reset or verification links into application logs. Configure a scheduler to execute the mail command repeatedly. SMTP is at-least-once delivery; retries carry stable Message-ID values, but a crash after SMTP acceptance and before DB commit may still produce a duplicate email.

## Configuration and deployment

| Variable | Meaning |
|---|---|
| APP_ENV | `development`, `test`, or `production` |
| APP_ORIGIN | Exact externally visible origin; HTTPS in production |
| DATABASE_URL | PostgreSQL production DSN; SQLite local only |
| JWT_SECRET | Cryptographically random secret of at least 48 characters |
| ENCRYPTION_KEY | Fernet key for TOTP secrets, OAuth state and email outbox |
| SMTP_* / MAIL_FROM | Verified TLS SMTP transport and sender |
| BILLING_ENABLED | Defaults false; explicit release gate for paid checkout |
| STRIPE_SECRET_KEY | Stripe test key first; live key only after readiness checks |
| STRIPE_WEBHOOK_SECRET | Signing secret for this exact endpoint |
| STRIPE_MONTHLY_PRICE_ID / STRIPE_ANNUAL_PRICE_ID | Allowlisted recurring Price IDs |
| TRIAL_DAYS | 0 by default, maximum 30; eligibility enforced per account |
| GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET | Server-side OIDC credentials |

Production startup rejects HTTP origins, SQLite and missing key/mail configuration. It cannot verify that your SMTP credentials, database backups, gateway account or DNS are operational: those require staging acceptance tests.

Apply `api/migrations/0001_initial.sql` once to a fresh PostgreSQL database. It creates the `schema_migrations` record `0001`; application startup does not create or alter production tables. Future changes need reviewed, versioned SQL migrations, backup/restore testing and a rollback plan. Do not repeatedly run the initial migration against existing data.

Run the API using a production process supervisor behind a TLS reverse proxy. Trust forwarded headers **only from that proxy's addresses**. For example, set Uvicorn `--proxy-headers --forwarded-allow-ips <trusted-proxy-addresses>`; never trust arbitrary client X-Forwarded-For headers. Disable or redact access-log query strings: OAuth callback authorization codes must not enter request logs. Set request-body and connection limits at the proxy, including chunked uploads. The app does not accept uploaded attachments and does not mount its source directory.

Use separate least-privilege database roles for runtime and migrations. Store secrets in the deployment secret store; restrict DB/network access; rotate secrets using an operational runbook. Changing the JWT key invalidates existing access tokens. Fernet key rotation must retain the old decryption key until existing encrypted records are migrated; never discard it casually.

## Authentication and profiles

Sign up, receive verification mail, verify, then log in. Passwords require 12–128 characters and preserve whitespace. JWTs last five minutes. Refresh cookies have a 30-day absolute expiry and rotate once per successful refresh. Replaying a used refresh token revokes that session; logout-everywhere increments an account epoch so existing access cookies also fail immediately.

Use Profile & security to add/switch profiles, enroll TOTP, save the recovery codes shown once, inspect sessions, reauthenticate, export data or delete an account. A downgrade retains extra profiles/projects but makes them unavailable until the plan permits them again. Profile deletion removes that profile's stored projects; account deletion removes all account projects. The browser asks for explicit deletion confirmation.

Google callback URL: `${APP_ORIGIN}/api/auth/google/callback`. Register that exact URL in Google Cloud. OAuth access/refresh tokens are not stored. A verified Google email does not automatically take over an existing password account; account linking is deliberately rejected until a separate authenticated linking flow is implemented.

## Stripe setup and lifecycle

1. Confirm the actual Premium feature set, prices, currency, tax policy, trial terms, merchant eligibility and cancellation/refund policy. Paid billing remains disabled until this is done.
2. Create recurring monthly/annual prices and configure the customer billing portal. Promotion codes/coupons are created and restricted in Stripe; Studio lets Stripe validate them in hosted checkout.
3. Register a **snapshot** webhook endpoint at `/api/payments/webhook`. Pin that endpoint to API version `2024-06-20`, matching the adapter. Upgrade SDK/API versions together with adapter tests. Configure events: `customer.subscription.created/updated/deleted/paused/resumed`, `checkout.session.completed/async_payment_succeeded/async_payment_failed`, `invoice.paid/payment_failed/finalized`, `charge.refunded`, and `charge.dispute.created`.
4. Supply test keys and the endpoint's signing secret. Deliver signed test events through Stripe CLI. Verify portal operations, taxes, authentication-required payments, async payments, refunds, trials, renewals and expiry.
5. Schedule `python -m api.cli reconcile` frequently (for example every five minutes) to recover missed subscription updates. Reconciliation does not manufacture missing invoice/refund events: replay undelivered events from Stripe and monitor webhook failures. Disputes remain suspended until a reviewed operator resolution; automatic dispute-win restoration is not implemented.
6. Schedule `python -m api.cli cleanup` daily. Audit logs are pruned at 90 days by this command; change and approve the retention policy before production. Financial records are retained and require an explicit merchant/jurisdiction-specific policy.

The checkout key is saved before remote session creation. After a crash, a retry reuses that attempt and the provider's idempotency behavior. Existing live/past-due subscriptions go to the portal. Provider-generated hosted invoices are exposed only through account-scoped billing responses. Monetary values remain integer minor units, and admin revenue is grouped by currency without pretending it is an accounting ledger.

Full refund policy: the latest invoiced period is suspended; partial refunds preserve access; a refund of an older invoice does not revoke a newer period. Canceled-at-period-end subscriptions retain access until their recorded expiry. Past-due status has no grace access in this implementation. Subscription status is derived from server records refreshed from Stripe; browser confirmation pages only display it.

## Admin and operational commands

Create a normal account, verify it, and enable TOTP. An operator can then run:

```powershell
.venv/Scripts/python.exe -m api.cli create-admin --email operator@example.com
```

Admin navigation appears only after `/api/me` confirms the role. `/api/admin` and ban actions additionally require MFA and authentication within the last five minutes. Role promotion is an operator-only command and must be logged in your deployment change system. Ban actions revoke all target sessions. Refund execution is intentionally delegated to the Stripe dashboard/portal and appropriate merchant controls rather than exposed as an unrestricted app-admin button.

## Tests

```powershell
.venv/Scripts/python.exe -m pytest api/tests -q --basetemp=tmp/api-tests
node tests/calculations.cjs
```

Create `tmp/` first if your platform does not create the parent. Use a disposable test DB. Tests verify real Argon2 hashing, actual cookies/JWTs, signed webhook verification, database access checks and state transitions. Provider API responses and email delivery are mocked: no customer is charged and no email is sent by tests. PostgreSQL concurrency, real Google exchanges, SMTP delivery and Stripe test-mode lifecycles still require staging validation.
