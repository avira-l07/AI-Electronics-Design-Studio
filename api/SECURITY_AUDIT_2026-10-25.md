# Submitted security audit — verified findings and fixes (v15.5)

Reviewed 25 October 2026 against the actual v15.4 source and active browser handlers. The supplied report is evidence to investigate, not proof that each scenario is exploitable. No real customer, payment, email provider or public attack traffic was used.

## Findings and dispositions

| Supplied finding | Verdict | Change or reason |
| --- | --- | --- |
| Anonymous `GET /api/shared` has no request quota | Confirmed resource-consumption gap. High-entropy tokens prevent practical enumeration, not database exhaustion. | Added an ASGI limiter before dependency/database work: 60 requests per client per fixed minute and 1,200 total per process. Excess requests receive 429 and Retry-After. It counts invalid tokens too, stores only bounded HMAC client keys in memory, and creates no anonymous quota rows in PostgreSQL. |
| Invitations can repeatedly target the same recipient | Confirmed in-app harassment gap; this endpoint does not send invitation email. | Added three persistent recipient slots, each expiring 24 hours after use. This enforces at most three invitation creations/renewals in any rolling 24 hours across owners and projects. Canceling an invitation does not refund a slot. Atomic conditional upserts prevent concurrent senders taking the same slot. Already accepted member role changes do not consume delivery slots. Registered and unregistered recipients have identical responses. No schema migration is required; existing Rate rows hold the slots. |
| Legacy BOM CSV permits spreadsheet formulas | The unsafe retained handler exists, but the full application replaces it with a safe handler; the claimed exploitable basic-mode route was not established. | Hardened the legacy binder anyway. Both handlers use StudioProjectData.csvCell and are exercised by actual browser downloads. CSV quoting alone is not formula neutralization. |
| Download names contain unsafe characters | Confirmed missing centralized normalization. Browser download hints alone are not arbitrary filesystem traversal or demonstrated code execution. | Central downloadFilename removes path/OS-invalid characters, control/bidi characters, leading/trailing dots/spaces, handles reserved DOS names and caps UTF-8 bytes while retaining ordinary Unicode and file extensions. All callers of download inherit this. |
| Triangle clearance can block the UI | Confirmed bounded but expensive synchronous work. The report's title about unbounded polygon repair misidentifies the actual operation. | Clearance, sampled walls and conservative repair now run in a separate worker. One job runs per review, controls show busy state, a 20-second watchdog terminates stalled work, and closing the dialog cancels it. Errors restore retry controls; canceled, timed-out or context-stale results are not recorded/applied. There is no synchronous fallback. Pair counts are rejected before costly mesh inspection. |
| DXF can emit invalid/missing numeric coordinates | Confirmed missing defense in the exporter itself; normal import already validates these fields. | Validate supported shape types, required finite numeric dimensions, nonnegative sizes, coordinate bounds, array/text limits and layer/text control characters. Invalid data stops the entire download with a visible explanation, avoiding an incomplete fabrication file. Valid drawings still export in millimetres. This was malformed output, not a demonstrated out-of-bounds memory access. |
| Stripe endpoint/API version drift | Confirmed operational integrity risk. Pinning API requests does not pin separately configured webhook event versions. | Centralized the existing 2024-06-20 version, require it on signed webhook events, and validate the authoritative fetched invoice schema before entitlement/payment writes. A missing subscription field is rejected; an explicit null for a one-off invoice is allowed. Unsupported events receive non-2xx without being marked processed. Schema errors are retryable 502s. Refund/dispute invoice processing uses the same validation. |
| Refresh replay should revoke every account session | Optional policy, not a missing replay defense. Current sessions represent separate token families. | Retained affected-family revocation, corrected account-before-session locking in the replay path, and added one audit/security notification per affected family. Repeating the old token cannot spam notices or revoke unrelated/new sessions. Log out everywhere and password reset remain account-wide. Broader compromise requires those actions and device investigation. |
| Lockout can require email for a password-only account | Real availability tradeoff, partly overstated as an unhandled lockout. | Existing correct-password step-up supports email confirmation, enabled TOTP and single-use recovery codes. Added a regression proving a recovery code works during lockout and cannot be reused. Wrong passwords cannot generate confirmation mail. Global account failure tracking and persistent IP throttles already apply. SMS was never configured. A new account-only hard deny would worsen targeted lockout; authentication is not bypassed when email is delayed. Reliable provider delivery and enabling MFA remain operational requirements. |
| Missing authenticated Google linking | Product feature gap, not an account pre-hijacking vulnerability in this code. | Existing identity collisions fail closed with 409; no automatic email-based linking was added. A deliberate linking feature needs recent authentication, provider subject verification, unlink/recovery policy and real-provider acceptance. |
| Forwarded client IP is not trusted correctly | Not confirmed in supplied deployment configuration. | The free-host entrypoint already requires a verified proxy IP/CIDR allowlist and rejects wildcard/Internet-wide trust; Docker trusts only its private proxy/loopback. Added tests proving trusted proxy headers select client quotas and untrusted spoofed headers do not. Operators must verify the allowlist on the eventual host. |
| Missing Origin should fall back to Referer | Compatibility concern, not a demonstrated CSRF hole. | Preserved strict Origin plus session-bound signed CSRF validation. Mutating clients must send the configured Origin; an extension/proxy stripping it can cause an intentional 403. No silent compatibility bypass was introduced. |
| All responses already have security headers | Not completely accurate: early middleware rejections bypassed header assignment. | Moved response headers into an outer middleware so CSRF, invalid Content-Length, oversized bodies and rate-limit rejections also carry CSP, anti-framing, nosniff and no-store headers. |

The share token has **384 random bits** (`secrets.token_urlsafe(48)`), not the report's 288-bit estimate. The full UI already escapes names, labels and annotations; existing injection/import tests still pass. This review did not establish cross-tenant IDOR, arbitrary filename writes, forged payment upgrades or exploitable mesh parser overflow.

## Verification

- Full API suite: **186 passed** (17 added cases; isolated SQLite databases, synthetic identities, real signature verification with a synthetic secret). One existing Starlette/httpx deprecation warning remains; dependency replacement was outside this focused fix.
- Full desktop/phone browser suite: **132 passed, 2 expected skips**, from 134 cases. Skips are the phone-native library-drag case and a duplicate heavy worker timing check on phone. The actual 300,000-pair desktop calculation completed while the UI timer continued ticking.
- All **12 JavaScript suites** passed, including formula/filename/DXF rejection checks, exact numeric geometry checks and CAD worker recovery. The public-asset guard passed for **49 assets**, including the new manufacturing worker.
- Focused manufacturing/browser checks verify clearance/wall/repair output, repaired-copy undo, cancellation, timeout/retry, malformed DXF feedback, and safe downloads from both CSV binders.
- API regressions verify no database work after snapshot throttling, bounded limiter state/window recovery, trusted/untrusted proxy behavior, recipient limits across accounts/projects/cancellation, concurrent quota claims, once-only replay alerts, recovery-code consumption, version drift, incomplete invoices, valid one-off invoices and headers on early errors.

The first focused browser run exposed an incorrect helper name in two new test cases. Corrected the test and ran the complete suite successfully. No product assertion was weakened to hide a failure.

## Security boundaries and rollout

These frontend fixes ship in the static Sites update with the existing audience preserved. **FastAPI/backend fixes are tested source changes, not live server protection until the backend is deployed.** No paid resources, live charges, real mail or new account integrations were activated.

The anonymous limiter is deliberately process-local with a fixed one-minute window; up to two windows' quota can occur around a boundary. The prepared free host uses one worker. A multi-worker/replica deployment needs a shared edge quota, and connection/distributed volumetric attacks still need host protection. The global cap can temporarily deny all anonymous snapshot reads under attack; it protects the database, not guaranteed availability of the share service.

Recipient slots enforce a rolling day in persistent storage; ongoing pending invitations can live longer than a day under the existing seven-day invitation lifetime. This is an invitation-frequency limit, not a universal three-pending-invitations account capacity. The PostgreSQL conditional-upsert path is implemented; its concurrent behavior still needs acceptance on the selected hosted PostgreSQL service. Local concurrency tests use SQLite.

Background review keeps the UI responsive but does not make geometric checks exact or certify a part. Worker-unavailable environments receive an explanation. Extremely complex valid geometry can hit the watchdog and require simplification. A malicious model cannot silently apply a repair result.

Stripe accepts only the pinned snapshot event version. Before enabling its test endpoint, explicitly configure **2024-06-20**, verify sample invoices/refunds/cancellations, and monitor delivery failures. Version upgrades require coordinated schema changes/tests. Existing idempotency/customer binding/server-authoritative entitlement checks are retained. Real sandbox/provider acceptance remains pending configuration.

## Release and future acceptance checklist

- [x] Current active and retained export handlers both neutralize formulas.
- [x] Shared request limits reject excess traffic before database transactions.
- [x] Recipient quotas survive cancellation and serialize concurrent claims.
- [x] Replay revokes the affected family once, with a security notice.
- [x] Recovery codes remain single-use and available during MFA step-up.
- [x] Manufacturing jobs cancel/timeout and never fall back to blocking UI computation.
- [x] Invalid DXF data produces an error, not a malformed/partial export.
- [x] Unsupported billing versions/schemas do not enter the processed-event ledger.
- [x] Early application rejections retain security headers.
- [ ] Deploy HTTPS backend, verify real proxy identity, mail, monitoring and backup/restore.
- [ ] Test PostgreSQL races under real concurrent owners, refresh/reset/logout and webhook delivery.
- [ ] Exercise Stripe sandbox invoice failure, duplicate delivery, renewal, refund, dispute and cancellation against the pinned endpoint before enabling billing.
- [ ] Verify worker performance on physical low-memory devices and manufacturing files in actual CAD/slicer/physical workflows.
- [ ] Design/accept explicit Google linking only if the product requires it.

References: [Stripe webhook endpoint version](https://docs.stripe.com/api/webhook_endpoints/object), [RFC 9700 refresh-token protection](https://www.rfc-editor.org/rfc/rfc9700.html#name-refresh-token-protection), [Uvicorn trusted proxy configuration](https://uvicorn.dev/settings/). RFC 9700 describes revocation of the active refresh grant/family on replay; it does not require logging out every independent device session.
