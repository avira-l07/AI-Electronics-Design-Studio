# Project status audit — 24 October 2026

Follow-up: [v15.3 zero-cost beta delivery](FREE_BETA_DELIVERY.md) corrects the lock-order and owner-cache issues identified here and adds runnable local beta/server preparation. This audit records the earlier v15.2 baseline and its verification; use the follow-up for current completion boundaries.

Baseline: application release v15.2, Git revision `647d8a4`.

The product is a working local engineering concept workspace with a substantial
tested account-server implementation. It is not yet an operational paid cloud
service, an exact general-purpose CAD system or a manufacturing-certified tool.
No percentage is assigned: these are different acceptance boundaries.

## Workflows used

- **GSD local workflow:** compared the roadmap, checklist, current source and
  deployment boundaries; ordered remaining work by dependency and risk.
- **Ralph local workflow:** ran verification and inspected results against the
  requested status check. No unattended loop or scheduler was started.
- **CodeRabbit local workflow:** reviewed the recent security/recovery changes
  and relevant callers. No CodeRabbit CLI/integration is available, so this is an
  assistant source review, not a CodeRabbit service scan.
- **Sites:** read-only publication metadata check. The existing site is active,
  latest version 18, with `custom` access. No deployment/access change occurred.

## Fresh verification

| Check | Result | Limit |
| --- | --- | --- |
| Full API suite | **142 passed** in 75.30 seconds | Isolated SQLite; not PostgreSQL production/concurrency acceptance |
| JavaScript regression suites | **All 12 passed** | Includes real Manifold modelling and deterministic worker resource/recovery checks |
| Full browser suite | **97 passed, 1 expected skip** in 6.5 minutes | Chrome desktop/phone contexts and loopback servers; not physical devices or hosted accounts |
| Actual application export files | **14 passed** independent Trimesh 5.1.1 checks | Seven STL/OBJ pairs; not actual slicer/toolpath or physical acceptance |
| Public asset guard | **47 assets passed** | Filename/symlink policy; not a semantic secret scanner for every possible asset |
| npm advisory audit | **0 reported vulnerabilities** | Known npm advisories at audit time; not a complete security guarantee |
| Python dependency compatibility | `pip check` passed | Python package advisory scanning still remains |
| Frontend syntax / Python compilation | Passed | Syntax does not establish behavioral correctness |
| Deployment preflight | Development configuration valid; production acceptance **not ready** | PostgreSQL, SMTP and Stripe missing; live AI disabled/missing |

The skipped browser case is native HTML library dragging on the phone layout;
pointer drag-and-snap and two-face attachment passed on both layouts.
The API run reported one existing Starlette/httpx deprecation warning. Browser
execution reports a terminal color-environment warning. These are distinct from
functional failures.

## Source-review findings

### P2 — inconsistent account/token lock order before PostgreSQL deployment

`api/security.py:74` (`principal`) takes the User lock before Session; authenticated
revocation then updates Token rows in `revoke_all` at line 98. Conversely,
`api/app.py:163` (`finish_mfa`) locks the MFA Token before taking the User lock.
Verification at line 118 and reset at line 201 also consume a Token before
locking its User.

For example, an MFA request can hold token T while waiting for user U, while a
concurrent logout-everywhere request holds U and waits to update T. This is a
source-backed deadlock risk; it was **not reproduced against PostgreSQL here**.
Its expected impact is an aborted/failed concurrent request, not a demonstrated
authentication bypass. SQLite serialization in the local suite does not prove
this row-lock ordering safe.

Next action: use a consistent account-first/token-second order in these paths
and verify simultaneous MFA/reset/verification/revocation/account deletion on
PostgreSQL, including token single-use and revocation behavior. The newer
confirm-login endpoint already uses account-first ordering.

The risk assessment follows PostgreSQL's documented row-lock and deadlock
behavior: [explicit locking guidance](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-DEADLOCKS).

### P2 — owner preview can outgrow the retained custom-solid cache

This is an existing, disclosed v15.2 limitation. The solid cache retains at most
32 MiB, while `enterEditor` at `dist/studio-3d.js:1477` prepares all custom solids
before scene construction. A sufficiently large set of distinct valid recipes
can evict an earlier prepared mesh before construction uses it. `evaluate` then
reports that the solid needs rebuilding. The JSON recovery/export path remains
available; the scene is not silently replaced with fabricated geometry.

Next action: build/dispose incrementally or otherwise coordinate required
geometry lifetimes with the cache budget, then exercise a representative
assembly above the cache budget and lower-memory device behavior. This audit
did not force an actual browser/GPU out-of-memory condition.

### P2 — delivery documentation lagged behind the source

The roadmap and checklist led with v14 and older test/migration counts even
though v15.2 and migration 0005 were implemented. Corrected the current status
documents and linked this audit. Earlier milestone reports remain historical
evidence rather than cumulative current test totals.

No new authentication bypass or data-exfiltration exploit was established by
this targeted review. This is not an independent penetration test or a review
of every possible execution path.

## Delivered

| Area | Verified implementation |
| --- | --- |
| Product interface | Landing/account/pricing/billing navigation, dashboard/library/templates, profile/settings and admin interfaces; static account/billing screens explicitly remain previews |
| Appearance and usability | Forest/cobalt light/dark palettes, reduced motion, workbench tool groups/search, part thumbnails and size/material preview, responsive panels and focus/isolation |
| Local design tools | Sketches, bounded constraints/analytic curves, editable solid recipes, catalogue/drone assembly, both face attachment and drag-and-snap, groups/alignment/measurement, simple joints |
| Portability and recovery | STL/OBJ and personal part import/export, project JSON/revisions/Trash/backups, safe recovery on failed solids, deliberate device-data clearing |
| Engineering | BOM/costing, mesh/mass/clearance/wall/tolerance screening and bounded analytical mechanics/electrical/thermal/flight models with stated assumptions |
| Account backend source | Password hashing, verification/reset, sessions/refresh/revocation, MFA/OAuth adapters, per-plan profiles, ownership checks, audit/notifications/export/deletion and admin controls |
| Team backend/source UI | Private pending invitations and consent, roles/revocation, presence and two-second polled transform/name/visibility merges with conflict-draft preservation |
| Billing and AI source | Server-authoritative entitlements, Stripe checkout/webhook/reconciliation adapters, optional AI explanations and Pro modelling proposals; providers inactive |

The Free/Pro scope remains in [FREE_AND_PRO.md](FREE_AND_PRO.md). Existing local
engineering tools remain Free. Commercial prices and live payment acceptance
remain unset.

## Remaining work in order

1. **Local reliability before deployment:** resolve the account/token lock order
   and large-assembly cache lifecycle; add appropriate regression coverage and a
   reproducible PostgreSQL concurrency acceptance setup.
2. **Production operations — held by owner:** after the owner supplies host/domain,
   deploy HTTPS, PostgreSQL with migrations 0001–0005 and the operational worker;
   verify mail delivery, monitoring, backups/restoration, proxy/cookies and
   multi-device/account behavior. Docker is unavailable on this development host.
3. **Provider/commercial acceptance:** configure real SMTP/OAuth/AI as selected;
   set Stripe test prices and test webhook replay, renewal, cancellation, refund,
   outage and downgrade behavior. Confirm prices/terms before explicit live billing.
4. **Manufacturing acceptance:** open exports in actual CAD/slicer software, review
   units/toolpaths and manufacture/measure the reference coupon with chosen
   process/material/tolerances. Parser success alone is insufficient.
5. **Performance/accessibility/security:** lower-memory devices, larger assemblies,
   production PostgreSQL load, broader accessibility evaluation, Python advisory
   scanning, independent security review and remote CI acceptance.
6. **Deeper CAD:** general curve constraints, associative topology references,
   arbitrary 3D fillets/chamfers/shells, curved sweeps/multisection lofts and exact
   STEP/BREP. Existing operations are bounded mesh/concept implementations.
7. **Richer collaboration:** shared geometry/joint authoring, live handles and
   transport/load improvements beyond two-second polling.
8. **Broader validated engineering:** mesh-linked FEA/thermal, fatigue life/load
   spectra, nonlinear/SPICE circuits and full flight/control dynamics.
9. **Portability/design follow-up:** cloud personal-part sync and persisted
   calculation/density inputs; integrate an actual approved Stitch redesign.
   The existing frontend ZIP/Stitch reference bundle is a v15.0 snapshot and
   would need refreshing for a v15.2 handoff.

## Changes from this audit

Only status documentation is being updated. No application behavior, billing,
provider configuration, live site audience or backend deployment is changed.
Checks use synthetic isolated data; the user's saved projects are untouched.
An unchecked work item does not indicate that a background job is running.

The audit is complete; no implementation or deployment job remains running.
The browser test server shut down after the run. The tracked application files
remain unchanged; the working tree contains the status documentation updates.

## Reproduction commands

From `D:/AI Electronics Design Studio/engineering-studio`:

```powershell
npm.cmd test
.venv\Scripts\python.exe -m pytest api/tests -q --basetemp=tmp/status-audit-api-20261024 --tb=short
$env:STUDIO_BROWSER_CHANNEL = 'chrome'
node node_modules/@playwright/test/cli.js test --config=tmp/status-audit.playwright.cjs --workers=1 --reporter=line
$env:STUDIO_EXPORT_FIXTURES = '1'
node tests/assembly.cjs
.venv\Scripts\python.exe tests/check-exports.py
npm.cmd audit --json
.venv\Scripts\python.exe -m pip check
.venv\Scripts\python.exe scripts/deployment-check.py
```

The ignored audit Playwright config uses loopback port 4201 and its own output
directory. The redacted preflight intentionally returns a nonzero status until
production prerequisites are configured. These commands do not deploy services.
