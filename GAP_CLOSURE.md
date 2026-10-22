# Gap closure record — 22 October 2026

Follow-up reliability/UI work and current validation are recorded in [QUALITY_REVIEW.md](QUALITY_REVIEW.md).

## Implemented in the website

- Recoverable project Trash with restore controls in Library and Workspace. Browser-local trash stays on its device. Server trash belongs to the active account profile. There is no irreversible purge button.
- Session undo/redo for project edits, including dimensions, components, sketches and circuit settings. Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y work outside text fields. Revision snapshots remain the durable history mechanism.
- Three explicit design models: slider-crank, electronics and concept sketch. Templates and new-project forms select a relevant design screen. Only the slider-crank model claims motion calculations; arbitrary mechanical mechanisms are not implemented.
- Sketch selection, dragging, inspector position/size edits, individual object deletion, labels, measured dimension annotations, named layers and visibility controls. SVG and DXF exports include annotations. Dimensions are descriptive, not constraints. Layer visibility is a view preference; exports include all objects.
- Ideal DC series and parallel networks of 1–20 resistors with equivalent resistance and per-resistor voltage/current/power.
- Motion study with configurable 0–360° angle range and 0.25–90° step, displacement/velocity/analytic-acceleration plots, CSV export and evidence recording.
- Dark/light/system themes, workspace project search, keyboard tab navigation with ARIA tab semantics, Dashboard import, and a workspace notification inbox with unread counts in API mode.
- Project currency labels for INR/USD/EUR/GBP/JPY across planning values, BOM CSV and reports. Switching currencies does not convert existing prices.
- Project-specific reports/revision comparison and evidence signatures covering circuit, sketch, cost and specification changes.

## Implemented in backend/source; external deployment required

- Version numbers on project updates and trash/restore operations. Stale writes return HTTP 409. The frontend saves only the edited project and stops writes after failure/conflict, keeping edits available for export. Local-mode tabs also detect storage changes and pause instead of overwriting newer browser data. Export/reload is the recovery path; automatic merging is not implemented.
- Optional live AI guide: authenticated, ownership checked, rate limited, server-only credentials, explicit question/context controls, provider timeouts, plain-text rendering. It defaults off and has mocked-provider tests. Actual OpenAI access requires operator configuration.
- Optional immutable read-only share snapshots: random tokens hashed at rest, expiry, revocation, ownership checks and revocation on trash. It defaults off. No user project has been published through this feature.
- Admin email search/pagination, bounded audit export and a link to Stripe's merchant payment-support interface. Impersonation is not enabled. Profile deletion is exposed with an explicit permanent-deletion confirmation; account/profile deletion remains different from recoverable project Trash.
- Explicit additive migration, Docker image, Compose/PostgreSQL/Caddy configuration, separate retrying email/reconciliation worker, health check and GitHub Actions checks.
- Browser test source for desktop and phone flows with a pinned Playwright dependency, plus engineering calculation tests. The standalone Playwright suite is configured for CI; interactive browser validation here uses the supported browser tool.

## Validation and remaining work

32 API tests passed. JavaScript calculation, template, numerical-derivative and syntax checks passed. See `api/VALIDATION.md` and `deploy/README.md` for executed checks and staging requirements. Container/TLS/PostgreSQL behavior, SMTP, Google sign-in and live Stripe/OpenAI requests need the actual external environment and credentials. The private hosted Sites publication continues to serve browser-local mode; storing Python source does not deploy it.

Premium engineering capabilities/prices remain awaiting the owner's definitions. Real-time team editing, invitations/presence, public galleries/embeds, general schematic capture, AC analysis, motor sizing, force/torque models, FEA, arbitrary mechanism solvers and a geometric constraint solver remain future development. The website does not present them as working tools.
