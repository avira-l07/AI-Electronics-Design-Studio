# AI Engineering Design Studio

Browser-local engineering concept workspace. Serve `dist/` using any static HTTP server.

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

Data remains in this browser's localStorage; export project JSON for backup or migration. Hosted access is owner-private. No cloud project synchronization, live AI, CAD kernel, finite-element solver or fabrication certification is included.

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
