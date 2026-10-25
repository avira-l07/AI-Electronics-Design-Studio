# AI Engineering Design Studio

Current v15.7: [FPV showcase drone](V15_7_DRONE_SHOWCASE.md). Adds a 136-component editable drone with three-blade propellers, camera, antennas, routed cable envelopes and coordinated finishes; a 41-part library; and a presentation view. Material reload consistency and circular export triangles are fixed. New starters preserve existing projects. No new Premium rules or paid services. Verification: 187 API tests; 144 browser checks with two expected skips; four final targeted drone checks; all 12 JavaScript suites; 53 public assets.

Future business features and the first pilot milestone are saved in the [project bucket list](PROJECT_BUCKET_LIST.md). Premium assignments and prices remain for the owner's later decision.

Current v15.6: [3D project-type options](V15_6_PROJECT_OPTIONS.md). Adds twelve searchable project directions, including engines, ships and LoRa devices, with component descriptions and links to the existing manual workspace. Category-specific generation and new Premium assignments await the owner's decisions. Existing Free/Pro rules and billing remain unchanged. Verification passed: 140 browser checks, two expected skips, all 12 JavaScript suites and the 51-asset guard.

Current v15.5: [verified security audit and fixes](api/SECURITY_AUDIT_2026-10-25.md). Adds anonymous snapshot throttling, rolling recipient invitation limits, defensive exports, background manufacturing review, once-only replay alerts and Stripe schema/version checks. Verification: 186 API tests, 132 browser checks with two expected skips, all 12 JavaScript suites and the 49-asset guard passed. Backend changes require deployment; paid services remain disabled.

Current v15.4: [user-perspective UX audit and fixes](UX_AUDIT_2026-10-24.md). Restores project commands, fractional price entry, session form drafts, public account-mode resource browsing, embedded 3D page scrolling, sticky tables and clearer feedback. Separates confirmed findings from claims about overridden legacy code. Cloud activation and paid services remain unchanged.

Current v15.3: [zero-cost beta delivery and limitations](FREE_BETA_DELIVERY.md). Includes a loopback-only synthetic account demo, optional installed-model Ollama proposals, free-host preparation, HTTPS outbox delivery, expiring complimentary Pro access and account-lock/assembly-cache reliability fixes. Cloud/provider activation remains unverified until accounts are configured.

Current project status: [24 October 2026 audit](PROJECT_STATUS_AUDIT_2026-10-24.md) and [roadmap](PROJECT_STATUS_AND_ROADMAP.md). The audit distinguishes locally verified features from held cloud activation and remaining CAD/manufacturing acceptance.

Current follow-up v15.2: [residual-risk review](api/RESIDUAL_RISK_REVIEW.md). Adds deliberate device-data removal, bounded CAD cache/queue and shared preview recovery, configurable sign-in confirmation lifetime and public-file guards. Backend deployment remains held.

Current security follow-up v15.1: [submitted threat-report audit](api/THREAT_REPORT_AUDIT.md). Adds private pending invitations, owner sign-in recovery during lockout, explicit local-data notices and regression tests. Backend deployment remains held.

Current v15 appearance: [color combinations and effects](V15_COLOR_AND_EFFECTS.md). Shared evergreen/ivory/graphite and cobalt palettes, consistent light/dark editing panels, readable labels, restrained hover/dialog effects and reduced-motion support.

Previous v14 UI: [workbench review and guide](V14_WORKBENCH_REVIEW.md). Adds an organized CAD workbench, light/dark editing panels, card/list parts browsing, a keyboard-accessible tool finder, camera dock, clearer property controls and improved narrow layouts. All new local UI controls remain Free.

Previous v13 usability: [review and workflow](V13_USABILITY_REVIEW.md). Adds drag-and-snap and guided face attachment, actual part thumbnails, pre-insertion size/material previews, direct canvas selection, an expanded workspace and faster access to customization. All new local tools remain Free.

Previous v12 engineering milestone: [delivery audit](V12_AUDIT.md), [current checklist](PRIORITY_CHECKLIST.md) and [Free/Pro split](FREE_AND_PRO.md). Adds shared 3D presence/object merging, analytic curve recipes, nonlinear point/segment constraints, face-plane snapshots, bounded shell/sweep/loft/corner operations, manufacturing review tools and expanded analytical models. 52 browser cases and 108 API tests passed; 14 export files passed independent parsing. Cloud deployment is held; real devices, external CAD/slicers and physical acceptance remain unverified.

Historical milestone notes below describe their original scope; PROJECT_STATUS_AND_ROADMAP.md and the latest dated audit provide current status.

Browser-local engineering concept workspace. Serve `dist/` using any static HTTP server.

Current workspace tools v10: [V10_WORKSPACE_REVIEW.md](V10_WORKSPACE_REVIEW.md). Multi-select/groups, alignment, measurements, STL/OBJ import, personal reusable parts, basic sketch constraints and sampled curves, revolve/taper/twist/mirror/pattern, and fixed/hinge/slider joints. Run `npm test` and `npm run test:e2e`; on a local machine with installed Chrome, set `STUDIO_BROWSER_CHANNEL=chrome` if Playwright Chromium is unavailable. The browser suite uses `node scripts/preview.cjs` on port 4177.

Custom solid modelling v9: [V9_MODELLING_REVIEW.md](V9_MODELLING_REVIEW.md). Draw closed profiles, extrude, cut holes/pockets, join/intersect features, and save editable modelling history. The editor uses a dedicated Manifold JS/WASM worker. Move/Rotate handles provide optional snapping. Open the Custom solid modelling starter or choose Draw your own 3D part in the 3D editor.

Latest reliability and UI changes: [QUALITY_REVIEW.md](QUALITY_REVIEW.md). Run `npm test` for all JavaScript regressions. Site visibility is managed separately by the owner.

3D workspace v8.1: [V8_REVIEW.md](V8_REVIEW.md) documents the reviewed bugs, fixes, validation and CAD/export limitations. Open `#/workspace?tool=3d` to insert and customize concept parts. Assemblies are included in project JSON, history and backups.

## Version 0.2

- Parameter-driven 2D slider-crank scene with playback, angle scrubbing, wireframe and SVG export.
- Full-cycle displacement chart and CSV samples with analytic velocity.
- Concept sketch canvas: rectangles, circles, lines, undo and SVG export; coordinates in mm.
- Ideal DC resistive circuit calculator with user-entered power-rating comparison.
- Original project creation, JSON import/export, editable BOM and CSV export.
- Revision snapshots, restore and parameter comparison.
- Evidence records with change-dependent outdated markers.
- Fabrication checklist, batch planning costs and standalone HTML project report.
- Quick-action palette, keyboard shortcut and responsive layouts.

Data remains in this browser's localStorage; export project JSON for backup or migration. The existing hosted audience is preserved. The current custom modeller uses a Manifold mesh kernel; cloud project synchronization, live AI, exact BREP CAD, finite-element simulation and fabrication certification are not provided by the static publication.

## Checks

Run `node tests/calculations.cjs` from this directory. Numerical checks cover full-cycle displacement and analytic velocity against finite differences; additional checks cover cost arithmetic, import validation and evidence invalidation. Browser QA covers parameter editing, electrical feedback, revisions, sketch pointer drawing and the build planner.

## Mechanics assumptions

Ideal rigid slider-crank with zero offset, no friction, loading, deformation or clearances. Stroke = 2r; full rotation requires L > r. Displacement from outer dead center is `r(1-cos θ) + L - sqrt(L²-r² sin² θ)`. Playback is deliberately slowed and independent of the operating RPM used in calculations. Generated SVGs are conceptual illustrations.

## Product pages (v0.3)

The default route is the landing page. Routes use URL fragments so direct links work on static hosting:

- `#/landing` — product introduction and capability overview
- `#/signup` — device-local preview profile creation
- `#/login` — local profile email matching, explicitly not secure authentication
- `#/dashboard` — project search, project summaries, and workspace entry
- `#/profile` — editable local profile and session controls
- `#/pricing` — free plan and unpriced premium placeholder
- `#/upgrade` — premium upgrade overview
- `#/checkout` — no-charge simulation without payment fields
- `#/confirmation` — demo receipt and premium-preview navigation
- `#/billing` — free-plan status and demo receipt history
- `#/premium` — premium dashboard preview with undefined feature areas
- `#/workspace` — existing engineering workspace

No password, card, bank or UPI data is collected. The local profile is not an authentication or authorization boundary. Demo orders never grant paid entitlements; all financial screens label records as simulations. The existing owner-private Sites access policy is preserved. Live accounts, payment collection, webhooks, subscription lifecycle and server-side entitlements require a production backend and payment provider, confirmed prices, and the user's premium feature definitions.

Browser validation covers profile create/edit, email mismatch feedback, session exit/resume, billing period selection, demo checkout/confirmation/history, premium navigation, project search/entry, and phone/desktop layouts.

## Secure server implementation (v0.4)

See [api/REFINED_BRIEF.md](api/REFINED_BRIEF.md), [api/README.md](api/README.md), and [api/SECURITY_REVIEW.md](api/SECURITY_REVIEW.md).

The same frontend now supports a same-origin FastAPI API with Argon2id passwords, verified accounts, revocable sessions, TOTP/Google adapters, account-owned profiles and projects, Stripe-hosted checkout, signature-verified/idempotent webhooks, billing history, security settings, notifications, data export/deletion and admin APIs/UI. The PostgreSQL migration and dependency lock are in `api/`.

Static Sites hosting still serves the explicitly labeled account/payment preview. It does not run Python, provision PostgreSQL, deliver email or process payments. Serve the frontend through the API (or a same-origin reverse proxy) to activate server mode. Paid billing defaults off. The release checklist distinguishes tested code from provider and production validation still required.


## Interface update (v5)

The overview now has direct tool links and a project checklist. Project library supports search, discipline filters, pinned projects, name/revision sorting, grid/list views, duplication and individual JSON exports. Four starters create editable mechanism, DC circuit, enclosure and actuator-planning projects. Preferences include forest/cobalt accents, comfortable/compact density and reduced decorative motion. The Studio guide explains tools and their limits.

New routes: `#/library`, `#/templates`, `#/settings`, `#/guide`. In API mode they pass through the same authentication gate as other account pages. New project copies and templates use the server project API; the hosted static preview continues using browser storage. Pins and appearance preferences are device-local in both modes. No paid capability or payment service was enabled by this UI update.

Validation: JavaScript syntax checks; `node tests/calculations.cjs`; `node tests/templates.cjs`; all four template payloads checked with `api.project_data.project_data`; browser checks of template creation, calculated results, duplication, search, filters, layout preferences and responsive navigation.


## Gap improvements (v6)

See [GAP_CLOSURE.md](GAP_CLOSURE.md) for completed work and remaining gaps. The update adds project Trash/restore, edit undo/redo, design models, an expanded sketch editor, DC resistor networks, motion acceleration plots, dark mode, currency labels, workspace search and notifications. API saves now use version checks and pause on conflicts. Optional AI/share endpoints default off.

Backend upgrades require `python -m api.migrate` before starting the new API. Existing browser-local projects remain compatible. Production setup, HTTPS/proxy configuration, the mail/reconciliation worker and external-service acceptance checks are documented in [deploy/README.md](deploy/README.md). The Sites preview does not run the Python backend.

Additional checks: `node tests/engineering.cjs`, `python -m pytest api/tests -q`. Browser test source: `tests/browser/studio.spec.cjs`; install with `npm ci`, install the CI Chromium browser with `npx playwright install chromium`, then run `npm run test:e2e`. The test runner serves a disposable static origin and uses isolated browser contexts. The GitHub Actions workflow runs these checks; no remote CI run has been triggered from this chat.
