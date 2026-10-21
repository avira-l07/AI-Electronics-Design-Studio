# Validation record — 22 October 2026

## Completed in this workspace

- 25 Python integration/edge-case tests passed against isolated SQLite databases, using real Argon2id, JWTs, cookies, CSRF checks, database queries and actual Stripe webhook signature verification.
- Concurrent profile creation was exercised with two in-process clients: only one request obtained the remaining slot.
- Payment tests used signed synthetic events and mocked provider reads. They covered duplicate event/invoice IDs, pending/failed/paid state, refunds, late events, unknown prices, period expiry, cancellation and durable checkout retries.
- Authentication tests covered email verification, reset expiry/reuse, logout-everywhere, refresh rotation/replay, lockout, persistent rate limits, TOTP/recovery replay and per-challenge attempt limits.
- Project tests covered cross-account isolation, malformed nested revisions, dangerous imported keys, and export without authentication secrets.
- Streamed request bodies without Content-Length were rejected above 1 MiB.
- JavaScript syntax checks and the existing mechanics tests passed, including 71 analytic-velocity checks against numerical derivatives.
- Browser QA used an isolated local review account, not the user's production identity: secure login, dashboard authorization, database project creation, parameter persistence across reload, security settings and the Free-plan profile limit worked.
- PyPA `pip-audit` checked all 44 pinned packages in `requirements.lock`: no known vulnerabilities were reported. The raw result is `dependency-audit.json`. This is an advisory snapshot, not proof of absence of vulnerabilities or supply-chain integrity.

The test runner emitted one upstream Starlette warning that httpx-based TestClient usage is deprecated in favor of httpx2. It did not invalidate tests; review that migration with future framework updates.

## Still required before a public/paid release

- PostgreSQL execution and concurrent transaction tests, migration rehearsal, backups and restore verification.
- Actual Stripe test-mode customer/checkout/webhook/renewal/refund/portal workflows with the pinned API version and configured prices.
- Real SMTP delivery and retries, Google OIDC exchanges and provider outages.
- Approved Premium engineering features, pricing, merchant eligibility, tax/invoice, cancellation, refund and retention policies.
- Production hosting, HTTPS/proxy/header/cookie inspection, monitoring, secret rotation, incident response and independent penetration testing.
- Dependency artifact hashes/reproducible installation and continued advisory monitoring. The present lock pins versions but is not hash-locked.

Paid billing defaults off. The current Sites publication is still a private static preview; uploading Python source alongside it does not deploy an API or activate payments.
