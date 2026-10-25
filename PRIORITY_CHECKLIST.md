# Engineering Studio — current delivery checklist

Current v15.8: [category workspace isolation fix](V15_8_PROJECT_WORKSPACES.md). Start a new named category project or explicitly resume the current one. Engine, ship and LoRa projects start empty; Drone uses the real FPV starter. Existing assemblies are preserved, and login retains the selected category. Verified: 30 targeted desktop/phone browser checks, all 12 JavaScript suites and 53 public assets. Ready-made engine geometry remains unimplemented.

Current v15.7: [FPV showcase drone](V15_7_DRONE_SHOWCASE.md). Adds a 136-component editable drone with three-blade propellers, camera, antennas, routed cable envelopes and coordinated finishes; a 41-part library; and a presentation view. Material reload consistency and circular export triangles are fixed. New starters preserve existing projects. No new Premium rules or paid services. Verification: 187 API tests; 144 browser checks with two expected skips; four final targeted drone checks; all 12 JavaScript suites; 53 public assets.

Business expansion ideas and the pilot experiment are tracked separately in the [project bucket list](PROJECT_BUCKET_LIST.md). This delivery checklist continues to distinguish completed work from outstanding implementation and acceptance.

Latest v15.6: [3D project-type options](V15_6_PROJECT_OPTIONS.md). Twelve illustrated, searchable directions are available, with manual-editor navigation and project preservation. Category-specific generation and future Free/Premium assignments remain pending owner input. 140 browser checks passed with two expected skips; all 12 JavaScript suites and the 51-asset guard passed. Existing backend activation and CAD acceptance work below remain outstanding.

Latest v15.5: [submitted security audit](api/SECURITY_AUDIT_2026-10-25.md). Confirmed gaps fixed: pre-database snapshot limits, persistent rolling recipient quotas, export validation, background manufacturing review, replay alerts and Stripe schema/version drift. 186 API tests and 132 desktop/phone browser checks passed, with two expected browser skips; all 12 JavaScript suites and the 49-asset guard passed. Backend source fixes are not live until deployment. No paid services were activated.

Latest v15.4: [verified UX audit](UX_AUDIT_2026-10-24.md). Fixes command actions, fractional prices, unapplied form retention, public template/guide browsing, 3D scrolling, table headers, circuit contrast, inspector stacking, export feedback and empty BOM guidance. Account project routes remain protected; deeper CAD and cloud dependencies below remain outstanding.

Latest v15.3: [free-beta delivery and outstanding items](FREE_BETA_DELIVERY.md). Delivered: account-first token locks, incremental custom-solid loading, HTTPS outbox adapter, opt-in request-triggered delivery, expiring complimentary Pro and a one-command local synthetic demo. Free cloud deployment is authorized but not yet configured; no paid service or live billing is enabled.

Optional local AI now uses the installed phi4-mini:3.8b model with explicit opt-in. Actual recipe, kernel and browser preview/apply/save acceptance passed; hosted AI and broader quality acceptance remain outstanding.

Reviewed 24 October 2026 against v15.2. Current evidence and review findings: [status audit](PROJECT_STATUS_AUDIT_2026-10-24.md), [v15.2 recovery/security](api/RESIDUAL_RISK_REVIEW.md) and [v15 appearance](V15_COLOR_AND_EFFECTS.md). Previous milestone reports remain historical evidence. Completed means the bounded implementation below; it does not mean professional CAD, operational cloud services or manufacturing certification.

## Delivered and locally verified

- [x] v15.4 UX audit: 125 browser checks passed, one expected phone skip; 22 new cases; all 12 JavaScript suites and the 48-public-asset guard passed. Active code was checked against every supplied finding.

- [x] v15.3: 169 API checks; 103 browser checks with one expected phone skip (two selector failures corrected and rerun); all 12 JavaScript suites and 14 independent export parser checks. Actual installed-model inference and browser review/apply/save passed. No paid provider was called.

- [x] v15.2: deliberate device-data clearing/archive, bounded CAD cache/queue, failed-solid/shared preview recovery, configurable sign-in confirmation expiry and public-file guards.
- [x] v15.1: private pending invitations, owner recovery during account step-up, explicit preview privacy notices and injection/proxy regression checks.
- [x] v15: coordinated forest/cobalt light/dark palettes, readable panels/labels, restrained effects and saved/system reduced-motion support.
- [x] Fresh status audit: 142 API tests, 97 browser cases (one expected phone skip), all 12 JavaScript suites, 14 independent STL/OBJ parser checks and the 47-asset public-file guard passed. npm reported zero known advisories; Python dependency compatibility passed.

- [x] v14 UI: named tool groups, light/dark panels, card/list catalogue views, independently scrolling parts, searchable keyboard tool finder, floating camera controls, workspace help and responsive expanded editing. Full browser regression: 71 passed, 1 desktop-only library drag case skipped on phone; all JavaScript suites passed.

- [x] v13 usability: direct mesh selection in Orbit mode, actual part thumbnails, category/search filters, sizing/material previews before insertion, guided face attachment, drag-and-snap, fixed connections/Detach, expanded workspace and selection focus/isolation. Full browser regression: 63 passed, 1 desktop-only drag case skipped on phone.

- [x] Local projects, recovery/Trash, backups, undo/revisions, BOM, reports and product navigation.
- [x] Editable custom solids, catalogue/drone concept assembly, imports/exports, personal part library, groups/alignment/measurement and fixed/hinge/slider joints.
- [x] Saved analytic arc/quadratic definitions with tessellation; bounded nonlinear point/segment constraints and local freedom/redundancy diagnostics.
- [x] Face-plane snapshots; rectangle profile corner fillets/chamfers; extrusion shells, parallel-section sweeps and convex two-profile lofts.
- [x] Manufacturing topology/mass checks, detailed triangle distances/containment screen, sampled walls, conservative repaired copies, worst-case fit and evidence exports.
- [x] Beam, shaft, thrust/energy, fatigue-screen, steady thermal, RC and constant-thrust point-mass motion calculations with explicit assumptions.
- [x] Shared 3D transform/name/visibility workspace with presence, unrelated-object merging, retained same-object conflicts and viewer restrictions.
- [x] Actual loopback three-account browser workflow, using isolated synthetic accounts and desktop/phone contexts. Fixed blocking database access in async rate-limit middleware.
- [x] 52 full browser cases, 108 API cases, all JS suites and 14 independently parsed STL/OBJ exports passed. A further 20 targeted browser cases passed after final dialog changes.
- [x] Additive presence migration 0004 and private-invitation migration 0005, schema-health/preflight agreement, role/revocation/expiry/privacy checks and portable recipe validation.
- [x] CAD/slicer/physical acceptance coupon, editable acceptance record and instructions.

## External setup and acceptance still required

1. Free Render/Neon account access, verified sender and proxy configuration, HTTPS deployment and backup/restore acceptance. Free beta is authorized; paid hosting and live billing remain held. A purchased domain and a separate worker are not required for the prepared beta configuration.
2. Real-device/account cloud checks, PostgreSQL concurrency/load testing, monitoring and backup/restore rehearsal.
3. Stripe test account/prices and sandbox lifecycle acceptance; final commercial terms before explicit live enablement.
4. Live AI/OAuth configuration and provider/outage/budget acceptance.

## Remaining engineering work, in priority order

1. Verify the v15.3 account-lock fix on actual PostgreSQL and the incremental assembly loader on physical lower-memory devices. The source corrections and deterministic regressions are delivered; native memory exhaustion and production concurrency are not certified.
2. External CAD/slicer/toolpath review and physically manufactured/measured coupon, with chosen tolerances and material/process evidence. No suitable executable or physical equipment was available here.
3. Independent security/dependency review, production accessibility/performance and remote CI acceptance.
4. Richer collaborative geometry/joint authoring, live transform handles and transport/load improvements. Current shared edits are polled; joint-linked parts are protected from unsupported edits.
5. General curve constraints, associative face/edge references, arbitrary 3D fillets/chamfers/shells, curved-frame sweeps, multi-section lofts and STEP/BREP.
6. General intersection/mesh repair and union validation, guaranteed wall minima, material/tolerance/process validation.
7. Mesh-linked structural/thermal simulation, fatigue life/load spectra, broader nonlinear/SPICE circuit solving and full flight/control dynamics.
8. Cloud personal-part sync and project-persisted calculation/density inputs; current separate library/report exports remain the portable record.

No background implementation or deployment is implied by an unfinished item. Free/Pro scope is in [FREE_AND_PRO.md](FREE_AND_PRO.md).
