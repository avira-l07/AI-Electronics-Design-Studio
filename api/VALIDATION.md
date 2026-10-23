v11 follow-up: **104 API tests passed**, with role/revocation/downgrade/Trash checks, privacy deletion, AI quota/schema controls, live-billing guards and repeatable migration 0003. All JS suites, 40 local browser cases and independent STL/OBJ parser checks pass. Cloud activation is held; real providers remain unconfigured. See `../V11_AUDIT.md`.

v10 follow-up, 23 October 2026: **92 API tests passed**. Added imported-mesh/group/joint project and snapshot round-trip plus malformed asset, graph, constraint and modifier rejection. All JavaScript suites and 32 local desktop/phone browser tests passed. Remote CI and real production services remain separate. See `../V10_WORKSPACE_REVIEW.md`.

Custom modelling follow-up: **66 API tests passed** on 23 October 2026. See `../V9_MODELLING_REVIEW.md` for the current scope and verification boundaries.

# Validation record — 22 October 2026

Latest follow-up: **35 API tests passed**. New cases reject blank project names, non-finite circuit results and integer-overflow inputs. Frontend save/recovery regressions and verification limits are recorded in `../QUALITY_REVIEW.md`.

3D follow-up: **47 API tests passed** with validated portable assemblies, nested snapshots and empty-scene persistence. See `../V8_REVIEW.md` for the latest frontend and operational limits.

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


## Gap update validation

- **32 API tests passed** after the gap update. Extended API coverage includes optimistic project version checks, recoverable trash/restore, ownership isolation, snapshot sharing expiry/revocation, share revocation on trash, opt-in AI context and limits, extended sketch/network validation, and a repeatable legacy-schema upgrade preserving project contents.
- Additional JavaScript checks validate series/parallel conservation of power and voltage/current, 71 analytic acceleration comparisons against numerical velocity derivatives, motion sampling bounds and DXF output entities.
- Interactive browser checks exercise electronic design selection, network calculations, undo/redo, keyboard tabs, currency labels, sketch object property edits, dark theme persistence, local Trash/restore and real API parameter persistence. Optional AI calls use a mocked provider; no real model key or paid service has been used.
- The standalone Playwright suite defines six desktop/phone test cases. Dependency installation and test discovery were checked here; the standalone runner was not executed on this Windows host. Equivalent interactive flows were checked using the supported browser tool. Remote GitHub Actions execution remains unverified.
- Docker is unavailable on this host. Container builds, Caddy TLS, PostgreSQL concurrency, SMTP delivery, live provider calls and operational backup/restore remain staging acceptance requirements.
