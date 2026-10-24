# Security review and release checklist

## Current follow-up

Latest v15.5: [25 October submitted-audit review](SECURITY_AUDIT_2026-10-25.md). Includes verified fixes, per-finding verdicts, 186 passing API tests and 132 passing browser checks with two expected skips. Backend rollout and real-provider/PostgreSQL acceptance remain outstanding.

The latest [residual-risk review](RESIDUAL_RISK_REVIEW.md) covers v15.2 resource recovery, local privacy controls, public-file guards and configurable login-link expiry.

See [the submitted threat-report audit](THREAT_REPORT_AUDIT.md) for the v15.1 fixes and current verification. Historical test counts below describe the original milestone.

## Review result

The prior version was explicitly a browser-local prototype. Its email matching, local session flag, project storage and demo receipts were not account security, authorization or payment evidence. Those screens remain previews on the static Sites host. `dist/server-mode.js` switches to real API calls only when the same origin exposes `/api/config` in server mode. The Python API is the enforceable boundary. See `VALIDATION.md` for the 25 passing tests, browser checks and 44-package advisory audit.

### 1. Authentication: account takeover and replay

**Risk:** Plaintext/fast-hashed passwords, leaked reset links, enumerable accounts, reusable refresh tokens, unrevocable JWTs and unbounded login attempts permit account takeover.

**Fix/code:** `security.py` uses Argon2id (64 MiB, three iterations, one lane), hashes random action/refresh tokens, checks expirations, rotates refresh values and detects replay. `app.py` verifies email, implements reset/reauthentication, and checks a live DB session plus user epoch for every authenticated request. Cookies are `HttpOnly`, `SameSite=Lax`, `Secure` and `__Host-` prefixed in production; tokens never enter localStorage. Per-IP persistent quotas and five failed passwords trigger an account-wide step-up period. A correct password during that period requires existing MFA or a ten-minute, single-use email confirmation; it does not leave the owner with an unavoidable password lockout. Unknown users still perform a dummy Argon2 verification. Signup/forgot responses are generic.

TOTP secrets and OAuth state are encrypted with Fernet. OTP steps cannot be replayed; recovery codes are hashed and consumed once. MFA enrollment revokes other sessions. Google validates state, PKCE, nonce, issuer, audience, signature and verified email. Existing-email auto-linking is rejected. Login alerts are queued, not sent inside the authentication transaction.

**Limits:** Rate limits also need proxy-level protections and load testing. The step-up path mitigates targeted account lockout; real SMTP delivery, edge request controls and challenge support still need operational acceptance. Credential-stuffing detection, breached-password checks and stronger MFA recovery/support procedures are production follow-ups. SMTP/Google integrations require real configuration and tests.

Reference: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect).

### 2. Multiple profiles: quota races and ownership confusion

**Risk:** A browser-supplied profile ID can expose another account's data. Concurrent profile creation can bypass a plan limit. Downgrading can accidentally delete data or leave an unauthorized profile active.

**Fix/code:** `models.py` separates users, profiles, plans, projects and subscriptions. API principal resolution locks the account row before quota decisions. Profile switch/edit/delete and project reads/writes query both ownership and current profile eligibility. Creation has plan limits of one/five. Profiles use stable creation ordering; downgrades retain extra data and block its use. Project imports are recursively validated in `project_data.py`.

**Limits:** SQLite tests serialize writes but do not prove PostgreSQL race behavior. Run parallel profile-create/downgrade/switch tests against PostgreSQL before release. Future shared-team projects need a separate membership model; account ownership is not team collaboration.

### 3. Authorization: browser state cannot grant privileges

**Risk:** Client flags, JWT role claims or stale subscriptions can become privilege escalation. Hiding a route does not protect its API.

**Fix/code:** `principal`, `require_profile`, `require_premium` and `require_admin` enforce DB-backed permissions. Admin role and paid plan are distinct. Recognized subscription prices, status and end times determine Premium; price/role/user ownership cannot be supplied in request schemas. Bans, deletion and session revocation take effect on the next request. Frontend guards call `/me`, `/workspace`, `/premium` or `/admin` and display server denial.

**Limits:** Existing local preview engineering files are not automatically migrated. In server mode projects are read from the selected account/profile; import a local export deliberately. Do not add an engineering API without the same ownership/entitlement dependencies.

### 4. Payments: forged success, duplicate upgrades and stale events

**Risk:** Trusting return URLs, client prices, unsigned callbacks, duplicate events or delivery ordering can grant access without payment or create multiple subscriptions.

**Fix/code:** `billing.py` verifies original webhook bytes with Stripe's signing secret and timestamp tolerance. Checkout chooses server-configured Price IDs, keeps a durable attempt key, and checks for an existing subscription. Webhook event IDs and invoice IDs are unique. Effects and event receipt commit atomically. Account locks serialize changes; handlers retrieve current provider state rather than trusting stale event status. The return page waits for server-confirmed entitlement.

Subscriptions grant access only while active/trialing, unexpired, recognized, undisputed and not suspended by a current-period full refund. Failed/pending/async payment, cancellations, refunds and invoices are represented separately. Coupons are validated by Stripe-hosted checkout. Trial length defaults to zero; a consumed trial cannot be regained by local plan changes. Receipts use encrypted email outbox records and provider-hosted invoices, not fabricated local documents.

**Limits:** The provider adapter has only been exercised with signed synthetic events and mocked remote responses here. Test actual Stripe account availability, credentials, API version, coupons, tax/invoice requirements and payment lifecycle in test mode. No application test proves your merchant configuration. Dispute resolution and financial reconciliation need operator procedures. Provider API outages return errors and cause webhook retry; monitor them. Do not treat the revenue summary as financial accounting.

Reference: [Stripe webhooks](https://docs.stripe.com/webhooks), [subscription events](https://docs.stripe.com/billing/subscriptions/webhooks).

### 5. Hardening: request forgery, injection and secret exposure

**Risk:** Cross-site requests, dynamic SQL/HTML, unbounded payloads, broad CORS/proxy trust or leaked tokens can compromise accounts and data.

**Fix/code:** Pydantic rejects extra fields and validates inputs; SQLAlchemy binds query parameters. Existing `esc` and new frontend renderers escape user text. Revision imports strip dangerous prototype keys before storage or restore. Invoice and checkout redirects enforce HTTPS provider hostnames. Mutation requests require the exact Origin plus a signed cookie/header CSRF token bound to the session. CORS/Host are exact allowlists. Middleware caps both declared and streamed API bodies at 1 MiB and sets CSP, no-sniff, frame denial, no-referrer, permissions policy and production HSTS; authenticated API responses are no-store. The server serves only `dist/`, never `.env`, API sources or the DB. Secrets are environment-only and ignored by Git. Audit events omit passwords, tokens and raw IP addresses.

**Limits:** CSP permits inline styles to support the existing UI; inline scripts and eval remain blocked. A proxy must enforce hard upload/stream/body limits and trusted-forwarded-header rules. Add centralized alerting, log retention, TLS checks, backup tests, secret rotation and dependency advisories to operations. No attachment-upload surface is implemented. SQLAlchemy model creation is not a production migration strategy; apply reviewed migration SQL.

Reference: [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

### 6. Admin, notifications and data rights

**Risk:** Admin self-promotion, silent account renewal after deletion, duplicate mail and incomplete exports create security and operational failures.

**Fix/code:** Admin promotion is operator-only; API admin access requires role, MFA and recent authentication. Ban actions revoke sessions. User-scoped notifications are separated from the encrypted mail outbox. Billing uses provider promotion codes and optional configured trials. Export includes account profiles, projects, notifications and payment summaries without password hashes or session/token material. Deletion requires recent authentication, password/second factor and confirmation in the UI; provider cancellation must succeed before the database deletes account data. The account row is pseudonymized and sessions revoked. Financial/audit records are retained according to an explicit deployment policy.

**Limits:** The retention policy must be finalized for the business and deployment jurisdiction. Backups, provider-held personal information, external mail archives and deletion workflows need documented retention/erasure procedures. Deletion does not purport to erase Stripe's regulated records or browser files already exported. SMTP is at-least-once; consumers must tolerate duplicate delivery. Automatic Google-account linking and dispute-win restoration are intentionally not implemented.

## Release security checklist

- [ ] Apply and review the PostgreSQL migration; run all integration/concurrency tests on PostgreSQL.
- [ ] Configure one HTTPS origin, correct proxy trust, request limits and non-wildcard CORS/Host values.
- [ ] Provision independent random secrets; verify cookie `Secure`, `HttpOnly`, `__Host-`, path and SameSite attributes in staging.
- [ ] Verify SMTP delivery, sender identity, reset/verify link origin and outbox retry/monitoring.
- [ ] Register exact Google callback; test nonce/state/issuer/audience rejection and existing-email collision.
- [ ] Define Premium engineering features, prices, tax, trial, cancellation and refund terms.
- [ ] Keep BILLING_ENABLED=false until Stripe test-mode acceptance and provider eligibility are confirmed.
- [ ] Pin matching Stripe webhook API version; test original-body signatures and event replay after worker failure.
- [ ] Schedule mail delivery, subscription reconciliation and cleanup; monitor dead letters and failed webhooks.
- [ ] Test password reset, token theft/replay, logout-everywhere, bans and deleted accounts across devices.
- [ ] Require MFA for operators; review admin changes and least-privilege database/network access.
- [ ] Verify tenant/profile/project isolation and downgrade behavior with simultaneous requests.
- [ ] Complete dependency advisory scanning and lockfile review; run external penetration testing before public paid release.
- [ ] Test backup restoration, secret rotation, incident response and provider-outage recovery.
- [ ] Approve financial/audit retention, export, account deletion and backup/provider data handling.

## Edge cases to test

**Identity:** duplicate and case-variant signup; whitespace/unicode passwords; invalid/expired/reused verification/reset tokens; reset racing with login/refresh; changing password after MFA challenge issuance; locked and unknown accounts; generic forgot responses; email flood limits; invalid old access JWT signatures, issuer, audience or epoch; expired refresh; parallel same-token refresh and multiple tabs; refresh replay after revocation; logout all while another session is active.

**MFA/OIDC:** reused TOTP step; server clock drift; recovery-code reuse/race; disable MFA from an old session; unfinished enrollment expiry; Google state/cookie mismatch, reused state, nonce mismatch, wrong issuer/audience, unverified email, missing consent, provider outage and existing-account email collisions; Google-only deletion/reauthentication.

**Profiles/data:** free second profile; premium sixth; parallel creation; switch/delete another user's profile; downgrade while the fifth profile is active; profiles created in the same instant; upgrade again restores availability; active profile deletion; cross-profile project read/write; malicious imports/revision nesting; account switch while a save is queued; lost connection, expired session and failed save; 1 MB/oversized/streamed payloads.

**Payments:** canceled checkout; repeated clicks; process failure before/after provider creation and before DB commit; same-key retry with a changed billing period; existing past-due subscription; missing/forged/stale webhook signatures; duplicate IDs and multiple IDs for one invoice; out-of-order paid/failed/canceled/refund events; async success/failure; payment authentication required; partial/full/old-period refunds; refund after renewal; dispute; trial cancellation/restart/expiry; cancellation-at-period-end; paused/unpaid state; new/unrecognized Price ID; coupon abuse; provider downtime and replay; missed invoices and reconciliation; currencies with different minor-unit conventions; invoice-host redirect safety.

**Operations:** forbidden admin API without MFA/recent authentication; banning an active user; self-ban rejection; revenue separated by currency and net of refunds; mailbox failure/retry; SMTP accepted then worker crash; export excludes secrets; provider cancellation fails during account deletion; backup restore; deleting a user with active subscriptions or pending mail; trusted-proxy misconfiguration; CSRF absent/mismatched/cross-origin; stored XSS strings; SQL-injection payloads; cache leakage; direct navigation to protected frontend/API routes.
